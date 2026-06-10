import os
import sys
import logging
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict

# Set up paths relative to this file
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scanner import scan_all
from wled import WLEDClient
from wiz import WiZClient
from pc_lights import OpenRGBPCClient
from screen_sync import ScreenSyncWorker

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("main")

app = FastAPI(title="SpectraStrike Hub - Tactical Ambient Sync")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global stores
DEVICES = {}
CLIENTS = {}
LAYOUT = {} # Maps device_id -> "left" | "top" | "right" | "bottom" | "center" | "all"
SEGMENTS = {} # Maps device_id -> list of dicts [{"start": int, "end": int, "zone": str}, ...]
CALIBRATION = {} # Maps device_id -> {"r_seen": [R,G,B], "g_seen": [R,G,B], "b_seen": [R,G,B]}

def get_client(device_id: str):
    """Retrieves or creates a cached client instance for WLED, WiZ, or OpenRGB."""
    if device_id in CLIENTS:
        return CLIENTS[device_id]
        
    if device_id not in DEVICES:
        return None
        
    dev = DEVICES[device_id]
    is_mock = dev.get("is_mock", False)
    
    if dev["type"] == "wled":
        client = WLEDClient(dev["ip"], led_count=dev.get("led_count", 30), is_mock=is_mock)
    elif dev["type"] == "wiz":
        client = WiZClient(dev["ip"], is_mock=is_mock)
    elif dev["type"] == "openrgb":
        client = OpenRGBPCClient(dev["ip"], is_mock=is_mock)
    elif dev["type"] == "wdl":
        from windows_dynamic_lighting import WindowsDynamicLightingClient
        client = WindowsDynamicLightingClient()
    else:
        return None
        
    client.type = dev["type"]
    
    # Apply calibration if exists
    if device_id in CALIBRATION:
        cal = CALIBRATION[device_id]
        mat = get_calibration_matrix(cal["r_seen"], cal["g_seen"], cal["b_seen"])
        gamma = cal.get("gamma", 2.2)
        min_r = cal.get("min_r", 0)
        min_g = cal.get("min_g", 0)
        min_b = cal.get("min_b", 0)
        max_r = cal.get("max_r", 255)
        max_g = cal.get("max_g", 255)
        max_b = cal.get("max_b", 255)
        temp_k = cal.get("temp", 6500)
        temp_mults = get_temp_multipliers(temp_k)
        client.set_calibration(
            mat,
            gamma=gamma,
            min_r=min_r,
            min_g=min_g,
            min_b=min_b,
            max_r=max_r,
            max_g=max_g,
            max_b=max_b,
            temp_mults=temp_mults
        )
        
    CLIENTS[device_id] = client
    return client

class DeviceResolver:
    def get(self, device_id):
        return get_client(device_id)

device_resolver = DeviceResolver()
sync_worker = ScreenSyncWorker(device_resolver)

# Pydantic Request Models
class ControlRequest(BaseModel):
    on: Optional[bool] = None
    bri: Optional[int] = None       # 0-255
    color: Optional[List[int]] = None # [R, G, B]
    fx: Optional[int] = None        # WLED Effect
    sx: Optional[int] = None        # WLED Speed
    ix: Optional[int] = None        # WLED Intensity
    temp: Optional[int] = None      # WiZ Temp

class PaintRequest(BaseModel):
    colors: List[List[int]]         # List of [R, G, B] for WLED paint

class LayoutRequest(BaseModel):
    layout_mapping: Dict[str, str]  # {device_id: "left" | "top" | ...}

class ScreenSyncRequest(BaseModel):
    device_ids: List[str]
    active: bool
    mode: Optional[str] = "average" # "average" or "border"
    fps: Optional[int] = 20
    monitor_idx: Optional[int] = 1

class AddDeviceRequest(BaseModel):
    ip: str
    type: str                       # "wled" or "wiz"
    name: Optional[str] = None
    led_count: Optional[int] = 30

class SegmentItem(BaseModel):
    start: int
    end: int
    zone: str

class SegmentRequest(BaseModel):
    device_id: str
    segments: List[SegmentItem]

class CalibrationRequest(BaseModel):
    r_seen: List[int]
    g_seen: List[int]
    b_seen: List[int]
    gamma: float = 2.2
    min_r: int = 0
    min_g: int = 0
    min_b: int = 0
    max_r: int = 255
    max_g: int = 255
    max_b: int = 255
    temp: int = 6500

def get_temp_multipliers(k):
    """Computes fast linear warm/cool multipliers relative to D65 (6500K)."""
    if k < 6500:
        # Warm: reduce blue, slightly reduce green
        p = (k - 2000) / 4500.0 # 0.0 to 1.0
        return 1.0, 0.7 + 0.3 * p, 0.4 + 0.6 * p
    else:
        # Cool: reduce red, slightly reduce green
        p = (10000 - k) / 3500.0 # 0.0 to 1.0
        return 0.6 + 0.4 * p, 0.8 + 0.2 * p, 1.0

def get_calibration_matrix(r_seen, g_seen, b_seen):
    """Computes the inverse of the perceived RGB matrix to produce a calibration correction matrix."""
    # Columns of M are the normalized seen colors
    m = [
        [r_seen[0] / 255.0, g_seen[0] / 255.0, b_seen[0] / 255.0],
        [r_seen[1] / 255.0, g_seen[1] / 255.0, b_seen[1] / 255.0],
        [r_seen[2] / 255.0, g_seen[2] / 255.0, b_seen[2] / 255.0]
    ]
    # Invert 3x3 matrix
    det = (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
           m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
           m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
    if abs(det) < 1e-5:
        # Singular matrix, fallback to identity
        return [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0], [0.0, 0.0, 1.0]]
    
    invdet = 1.0 / det
    inv = [
        [
            (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invdet,
            (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invdet,
            (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invdet
        ],
        [
            (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invdet,
            (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invdet,
            (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invdet
        ],
        [
            (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invdet,
            (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invdet,
            (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invdet
        ]
    ]
    return inv

# API Endpoints
@app.get("/api/devices")
async def list_devices():
    """Lists discovered devices and returns cached runtime state."""
    output = []
    for dev_id, dev in DEVICES.items():
        client = get_client(dev_id)
        state = {}
        if client:
            state = client.get_state()
            
        output.append({
            "id": dev["id"],
            "ip": dev["ip"],
            "type": dev["type"],
            "name": dev["name"],
            "led_count": dev.get("led_count"),
            "model": dev.get("model"),
            "is_mock": dev.get("is_mock", False),
            "state": state
        })
    return output

@app.post("/api/scan")
async def scan_network():
    """Triggers local scanning for physical WLED, WiZ, and OpenRGB devices."""
    try:
        discovered = await scan_all()
        # Keep existing mock devices but overwrite with any discovered physical devices
        for dev in discovered:
            DEVICES[dev["id"]] = dev
            if dev["id"] in CLIENTS:
                del CLIENTS[dev["id"]]
                
        return {
            "status": "success",
            "message": f"Scan complete. Registered {len(discovered)} physical devices.",
            "devices": list(DEVICES.values())
        }
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/devices/add")
async def add_device_manually(req: AddDeviceRequest):
    """Registers a WLED or WiZ device manually by its IP address."""
    ip = req.ip.strip()
    if not ip:
        raise HTTPException(status_code=400, detail="IP address is required")
        
    dev_id = f"{req.type}_{ip.replace('.', '_')}"
    
    # Try verifying WLED
    if req.type == "wled":
        from scanner import check_wled_ip
        # Check on port 80 with slightly longer timeout for manual check
        dev_info = await check_wled_ip(ip, timeout=1.0)
        if dev_info:
            DEVICES[dev_id] = dev_info
        else:
            # Fallback to force registration if WLED is offline during adding
            DEVICES[dev_id] = {
                "id": dev_id,
                "ip": ip,
                "type": "wled",
                "name": req.name or f"Manual WLED ({ip})",
                "led_count": req.led_count or 30,
                "version": "Unknown (Manual)",
                "is_mock": False
            }
    elif req.type == "wiz":
        DEVICES[dev_id] = {
            "id": dev_id,
            "ip": ip,
            "type": "wiz",
            "name": req.name or f"Manual WiZ ({ip})",
            "model": "Unknown WiZ (Manual)",
            "is_mock": False
        }
    else:
        raise HTTPException(status_code=400, detail="Device type must be 'wled' or 'wiz'")
        
    # Clear client cache to force recreate
    if dev_id in CLIENTS:
        del CLIENTS[dev_id]
        
    logger.info(f"Manually registered device {dev_id} at IP {ip}")
    return DEVICES[dev_id]

@app.get("/api/devices/{device_id}/calibration")
async def get_device_calibration(device_id: str):
    """Retrieves calibration settings for a device."""
    return CALIBRATION.get(device_id, {
        "r_seen": [255, 0, 0],
        "g_seen": [0, 255, 0],
        "b_seen": [0, 0, 255],
        "gamma": 2.2,
        "min_r": 0,
        "min_g": 0,
        "min_b": 0,
        "max_r": 255,
        "max_g": 255,
        "max_b": 255,
        "temp": 6500
    })

@app.post("/api/devices/{device_id}/calibration")
async def save_device_calibration(device_id: str, req: CalibrationRequest):
    """Saves calibration settings for a device and updates the client's matrix."""
    global CALIBRATION
    CALIBRATION[device_id] = {
        "r_seen": req.r_seen,
        "g_seen": req.g_seen,
        "b_seen": req.b_seen,
        "gamma": req.gamma,
        "min_r": req.min_r,
        "min_g": req.min_g,
        "min_b": req.min_b,
        "max_r": req.max_r,
        "max_g": req.max_g,
        "max_b": req.max_b,
        "temp": req.temp
    }
    # Update cached client if exists
    client = CLIENTS.get(device_id)
    if client:
        mat = get_calibration_matrix(req.r_seen, req.g_seen, req.b_seen)
        temp_mults = get_temp_multipliers(req.temp)
        client.set_calibration(
            mat,
            gamma=req.gamma,
            min_r=req.min_r,
            min_g=req.min_g,
            min_b=req.min_b,
            max_r=req.max_r,
            max_g=req.max_g,
            max_b=req.max_b,
            temp_mults=temp_mults
        )
        # Apply instantly if possible
        if hasattr(client, "_apply_state"):
            client._apply_state()
    return CALIBRATION[device_id]

@app.post("/api/devices/{device_id}/control")
async def control_device(device_id: str, req: ControlRequest):
    """Sends immediate state changes to WLED, WiZ, or OpenRGB clients."""
    client = get_client(device_id)
    if not client:
        raise HTTPException(status_code=404, detail="Device not found")
        
    try:
        if req.on is not None:
            if req.on:
                client.turn_on()
            else:
                client.turn_off()
                
        if req.bri is not None:
            client.set_brightness(req.bri)
            
        if req.color is not None and len(req.color) == 3:
            client.set_color(req.color[0], req.color[1], req.color[2])
            
        if DEVICES[device_id]["type"] == "wled":
            if req.fx is not None:
                speed = req.sx if req.sx is not None else 128
                intensity = req.ix if req.ix is not None else 128
                client.set_effect(req.fx, speed, intensity)
                
        if DEVICES[device_id]["type"] == "wiz":
            if req.temp is not None:
                client.set_temp(req.temp)
                
        return client.get_state()
    except Exception as e:
        logger.error(f"Control failure for {device_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/devices/{device_id}/paint")
async def paint_device_leds(device_id: str, req: PaintRequest):
    """Allows painting individual LEDs for a WLED device."""
    client = get_client(device_id)
    if not client:
        raise HTTPException(status_code=404, detail="Device not found")
        
    if DEVICES[device_id]["type"] != "wled":
        raise HTTPException(status_code=400, detail="Only WLED lightstrips support pixel-level painting")
        
    try:
        client.stream_udp(req.colors)
        
        if req.colors:
            total_r = sum(c[0] for c in req.colors)
            total_g = sum(c[1] for c in req.colors)
            total_b = sum(c[2] for c in req.colors)
            n = len(req.colors)
            client.state["color"] = [int(total_r/n), int(total_g/n), int(total_b/n)]
            
        return client.get_state()
    except Exception as e:
        logger.error(f"Paint failed for {device_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/sync/layout")
async def save_layout_mapping(req: LayoutRequest):
    """Saves screen layout mappings."""
    global LAYOUT
    LAYOUT = req.layout_mapping
    if sync_worker.running:
        sync_worker.layout_mapping = LAYOUT
    return LAYOUT

@app.get("/api/sync/layout")
async def get_layout_mapping():
    """Retrieves current layout mappings."""
    return LAYOUT

@app.post("/api/sync/segments")
async def save_segments_mapping(req: SegmentRequest):
    """Saves segments mappings for a specific WLED controller."""
    global SEGMENTS
    SEGMENTS[req.device_id] = [
        {"start": s.start, "end": s.end, "zone": s.zone}
        for s in req.segments
    ]
    if sync_worker.running:
        sync_worker.segments_mapping = SEGMENTS
    return SEGMENTS

@app.get("/api/sync/segments")
async def get_segments_mapping():
    """Retrieves all segments mappings."""
    return SEGMENTS

@app.post("/api/sync/screen")
async def set_screen_sync(req: ScreenSyncRequest):
    """Starts or stops real-time screen ambient synchronization."""
    if req.active:
        if not req.device_ids:
            raise HTTPException(status_code=400, detail="Provide at least one device ID to sync")
            
        for d_id in req.device_ids:
            if d_id not in DEVICES:
                raise HTTPException(status_code=400, detail=f"Device {d_id} does not exist")
                
        sync_worker.start(
            device_ids=req.device_ids,
            layout_mapping=LAYOUT,
            segments_mapping=SEGMENTS,
            mode=req.mode,
            fps=req.fps,
            monitor_idx=req.monitor_idx
        )
    else:
        sync_worker.stop()
        
    return {
        "active": sync_worker.running,
        "device_ids": sync_worker.active_device_ids,
        "mode": sync_worker.mode,
        "fps": sync_worker.fps
    }

@app.get("/api/sync/screen/status")
async def get_screen_sync_status():
    """Returns the current status of the screen sync thread."""
    return {
        "active": sync_worker.running,
        "device_ids": sync_worker.active_device_ids,
        "mode": sync_worker.mode,
        "fps": sync_worker.fps,
        "monitor_idx": sync_worker.monitor_idx,
        "segments_mapping": sync_worker.segments_mapping
    }

# Mount static files.
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dist_dir = os.path.join(parent_dir, "frontend", "dist")
frontend_dir = dist_dir if os.path.exists(dist_dir) else os.path.join(parent_dir, "frontend")
os.makedirs(frontend_dir, exist_ok=True)
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
