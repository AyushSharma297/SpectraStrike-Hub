import os
import sys
import warnings

# Suppress soundcard's data discontinuity warning which spams the console
warnings.filterwarnings("ignore", category=UserWarning, message=".*data discontinuity in recording.*")
warnings.filterwarnings("ignore", message=".*data discontinuity in recording.*")
import json
import time
import uuid
import colorsys
import threading
import logging
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

# Set up paths relative to this file
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scanner import scan_all
from wled import WLEDClient
from wiz import WiZClient
from pc_lights import OpenRGBPCClient
from screen_sync import ScreenSyncWorker
from hyperhdr import HyperHDRClient
from music_sync import MusicSyncWorker
from matter import MatterClient

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
SCENES = {}     # Maps scene_id -> {"id", "name", "icon", "states": {device_id: state_payload}}
GROUPS = {}     # Maps group_id -> {"id", "name", "device_ids": [...]}
SCHEDULES = {}  # Maps schedule_id -> {"id", "name", "time", "days", "action", "enabled", ...}
IGNORED_IPS = set()
CUSTOM_NAMES = {} # Maps device_id -> str
ZONE_CONFIGS = {
    "left": 15,
    "right": 15,
    "top": 15,
    "bottom": 15,
    "center_x_min": 25,
    "center_x_max": 75,
    "center_y_min": 25,
    "center_y_max": 75
}
SERVER_STARTED_AT = time.time()

# Persistence (scenes / groups / schedules survive restarts)
DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hub_data.json")

def load_persisted_data():
    global SCENES, GROUPS, SCHEDULES, IGNORED_IPS, CUSTOM_NAMES, ZONE_CONFIGS
    try:
        if os.path.exists(DATA_FILE):
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            SCENES = data.get("scenes", {})
            GROUPS = data.get("groups", {})
            SCHEDULES = data.get("schedules", {})
            CUSTOM_NAMES = data.get("custom_names", {})
            if "zone_configs" in data:
                ZONE_CONFIGS.update(data["zone_configs"])
            if "ignored_ips" in data:
                IGNORED_IPS.update(data["ignored_ips"])
            logger.info(f"Loaded {len(SCENES)} scenes, {len(GROUPS)} groups, {len(SCHEDULES)} schedules, {len(IGNORED_IPS)} ignored IPs, {len(CUSTOM_NAMES)} custom names, and customized zones from disk.")
    except Exception as e:
        logger.error(f"Failed to load persisted data: {e}")

def save_persisted_data():
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump({
                "scenes": SCENES, 
                "groups": GROUPS, 
                "schedules": SCHEDULES,
                "ignored_ips": list(IGNORED_IPS),
                "custom_names": CUSTOM_NAMES,
                "zone_configs": ZONE_CONFIGS
            }, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save persisted data: {e}")

load_persisted_data()

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
    elif dev["type"] == "hyperhdr":
        client = HyperHDRClient(dev["ip"], is_mock=is_mock)
    elif dev["type"] == "matter":
        client = MatterClient(dev.get("node_id", 0), is_mock=is_mock)
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
sync_worker.zone_configs = ZONE_CONFIGS
music_sync_worker = MusicSyncWorker(device_resolver)

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
    mode: Optional[str] = "average" # "average", "vibrant", "dominant", "spotlight", "movie", "gaming", "chill", "scifi_neon", or "border"
    fps: Optional[int] = 20
    monitor_idx: Optional[int] = 1
    flash_enabled: Optional[bool] = False
    flash_threshold: Optional[int] = 45
    flash_color: Optional[List[int]] = [255, 230, 180]
    flash_duration: Optional[int] = 3

class MusicSyncRequest(BaseModel):
    device_ids: List[str]
    active: bool
    mode: Optional[str] = "beat_pulse"  # beat_pulse, spectrum_divider, energy_vu, color_organ, sound_bar, bass_strobe, single_pulse, spectrum_wave
    sensitivity: Optional[float] = 1.0
    base_color: Optional[List[int]] = [168, 85, 247]
    audio_device_id: Optional[str] = None
    color_palette: Optional[List[List[int]]] = None  # List of [R,G,B] colors for multi-color modes

class ZoneConfigRequest(BaseModel):
    left: int
    right: int
    top: int
    bottom: int
    center_x_min: int
    center_x_max: int
    center_y_min: int
    center_y_max: int

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

class SceneRequest(BaseModel):
    name: str
    icon: Optional[str] = "sparkles"
    states: Dict[str, Dict[str, Any]]  # {device_id: {"on":..,"bri":..,"color":..,"fx":..,"temp":..}}

class GroupRequest(BaseModel):
    name: str
    device_ids: List[str]

class GroupUpdateRequest(BaseModel):
    name: Optional[str] = None
    device_ids: Optional[List[str]] = None

class ScheduleRequest(BaseModel):
    name: str
    time: str                          # "HH:MM" 24h format
    days: List[int] = [0, 1, 2, 3, 4, 5, 6]  # 0=Monday ... 6=Sunday
    action: str                        # "on" | "off" | "scene"
    target: Optional[str] = "all"      # device_id, group_id, or "all" (for on/off)
    scene_id: Optional[str] = None     # required when action == "scene"
    enabled: bool = True

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
    for dev_id, dev in list(DEVICES.items()):
        if dev["ip"] in IGNORED_IPS:
            continue
        client = get_client(dev_id)
        state = {}
        if client:
            state = client.get_state()
            
        name = CUSTOM_NAMES.get(dev_id, dev["name"])
        output.append({
            "id": dev["id"],
            "ip": dev["ip"],
            "type": dev["type"],
            "name": name,
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
            if dev["ip"] in IGNORED_IPS:
                continue
            if dev["id"] in CUSTOM_NAMES:
                dev["name"] = CUSTOM_NAMES[dev["id"]]
            DEVICES[dev["id"]] = dev
            if dev["id"] in CLIENTS:
                del CLIENTS[dev["id"]]
                
        active_devices = []
        for dev in DEVICES.values():
            if dev["ip"] in IGNORED_IPS:
                continue
            d_copy = dict(dev)
            d_copy["name"] = CUSTOM_NAMES.get(dev["id"], dev["name"])
            active_devices.append(d_copy)

        return {
            "status": "success",
            "message": f"Scan complete. Registered {len(active_devices)} devices.",
            "devices": active_devices
        }
    except Exception as e:
        logger.error(f"Scan failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class RenameDeviceRequest(BaseModel):
    name: str

@app.patch("/api/devices/{device_id}")
async def rename_device(device_id: str, req: RenameDeviceRequest):
    """Updates the user-defined reference name of a device."""
    if device_id not in DEVICES:
        raise HTTPException(status_code=404, detail="Device not found")
    new_name = req.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Device name cannot be empty")
    CUSTOM_NAMES[device_id] = new_name
    DEVICES[device_id]["name"] = new_name
    save_persisted_data()
    return {"status": "success", "device_id": device_id, "name": new_name}

@app.delete("/api/devices/{device_id}")
async def delete_device(device_id: str):
    """Deletes a device and adds its IP to the ignored list to prevent rediscovery."""
    if device_id not in DEVICES:
        raise HTTPException(status_code=404, detail="Device not found")
    ip = DEVICES[device_id]["ip"]
    IGNORED_IPS.add(ip)
    del DEVICES[device_id]
    if device_id in CLIENTS:
        del CLIENTS[device_id]
    save_persisted_data()
    return {"status": "success", "ignored_ip": ip}

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
            monitor_idx=req.monitor_idx,
            flash_enabled=req.flash_enabled,
            flash_threshold=req.flash_threshold,
            flash_color=req.flash_color,
            flash_duration=req.flash_duration
        )
    else:
        sync_worker.stop()
        
    return {
        "active": sync_worker.running,
        "device_ids": sync_worker.active_device_ids,
        "mode": sync_worker.mode,
        "fps": sync_worker.fps,
        "flash_enabled": sync_worker.flash_enabled,
        "flash_threshold": sync_worker.flash_threshold,
        "flash_color": sync_worker.flash_color,
        "flash_duration": sync_worker.flash_duration
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
        "segments_mapping": sync_worker.segments_mapping,
        "flash_enabled": sync_worker.flash_enabled,
        "flash_threshold": sync_worker.flash_threshold,
        "flash_color": sync_worker.flash_color,
        "flash_duration": sync_worker.flash_duration
    }

@app.get("/api/sync/zones")
async def get_zone_configs():
    """Retrieves screen detection zone boundaries."""
    return ZONE_CONFIGS

@app.post("/api/sync/zones")
async def save_zone_configs(req: ZoneConfigRequest):
    """Updates screen detection zone boundaries."""
    global ZONE_CONFIGS
    ZONE_CONFIGS = req.dict()
    sync_worker.zone_configs = ZONE_CONFIGS
    save_persisted_data()
    return ZONE_CONFIGS

@app.post("/api/sync/music")
async def set_music_sync(req: MusicSyncRequest):
    """Starts or stops real-time music synchronization."""
    if req.active:
        if not req.device_ids:
            raise HTTPException(status_code=400, detail="Provide at least one device ID to sync")
            
        for d_id in req.device_ids:
            if d_id not in DEVICES:
                raise HTTPException(status_code=400, detail=f"Device {d_id} does not exist")
                
        # Stop screen sync if it's running
        if sync_worker.running:
            sync_worker.stop()
            
        music_sync_worker.start(
            device_ids=req.device_ids,
            mode=req.mode,
            sensitivity=req.sensitivity,
            base_color=req.base_color,
            audio_device_id=req.audio_device_id,
            color_palette=req.color_palette
        )
    else:
        music_sync_worker.stop()
        
    return {
        "active": music_sync_worker.running,
        "device_ids": music_sync_worker.active_device_ids,
        "mode": music_sync_worker.mode,
        "sensitivity": music_sync_worker.sensitivity,
        "base_color": music_sync_worker.base_color,
        "audio_device_id": music_sync_worker.audio_device_id
    }

@app.get("/api/sync/music/status")
async def get_music_sync_status():
    """Returns the current status of the music sync thread."""
    return {
        "active": music_sync_worker.running,
        "device_ids": music_sync_worker.active_device_ids,
        "mode": music_sync_worker.mode,
        "sensitivity": music_sync_worker.sensitivity,
        "base_color": music_sync_worker.base_color,
        "audio_device_id": music_sync_worker.audio_device_id,
        "color_palette": music_sync_worker.color_palette
    }

@app.get("/api/sync/music/levels")
async def get_music_live_levels():
    """Returns real-time audio levels for the frontend spectrum visualizer."""
    return music_sync_worker.get_live_levels()

@app.get("/api/sync/music/devices")
async def list_audio_devices():
    """Returns a list of available speakers/output devices that support loopback capture."""
    import soundcard as sc
    try:
        speakers = sc.all_speakers()
        output = []
        default_spk = None
        try:
            default_spk = sc.default_speaker()
        except Exception:
            pass
            
        for s in speakers:
            is_default = default_spk and default_spk.id == s.id
            output.append({
                "id": s.id,
                "name": s.name,
                "is_default": bool(is_default)
            })
        return output
    except Exception as e:
        logger.error(f"Failed to list audio devices: {e}")
        return []

# ----------------------------------------------------------------------------
# Helpers for scenes / groups / schedules
# ----------------------------------------------------------------------------

def apply_control_payload(device_id: str, payload: dict):
    """Applies a control-style payload {on, bri, color, fx, sx, ix, temp} to one device."""
    client = get_client(device_id)
    if not client:
        return False
    try:
        if payload.get("on") is not None:
            if payload["on"]:
                client.turn_on()
            else:
                client.turn_off()
        if payload.get("bri") is not None:
            client.set_brightness(int(payload["bri"]))
        color = payload.get("color")
        if color is not None and len(color) == 3:
            client.set_color(int(color[0]), int(color[1]), int(color[2]))
        dev_type = DEVICES.get(device_id, {}).get("type")
        if dev_type == "wled" and payload.get("fx") is not None:
            speed = payload.get("sx", 128) or 128
            intensity = payload.get("ix", 128) or 128
            client.set_effect(int(payload["fx"]), int(speed), int(intensity))
        if dev_type == "wiz" and payload.get("temp") is not None:
            client.set_temp(int(payload["temp"]))
        return True
    except Exception as e:
        logger.error(f"Failed applying payload to {device_id}: {e}")
        return False

def apply_scene_by_id(scene_id: str):
    """Applies all device states stored in a scene. Returns count applied."""
    scene = SCENES.get(scene_id)
    if not scene:
        return 0
    applied = 0
    for dev_id, state in scene.get("states", {}).items():
        if dev_id in DEVICES and apply_control_payload(dev_id, state):
            applied += 1
    return applied

# ----------------------------------------------------------------------------
# Scenes API
# ----------------------------------------------------------------------------

@app.get("/api/scenes")
async def list_scenes():
    """Lists all saved scenes."""
    return list(SCENES.values())

@app.post("/api/scenes")
async def create_scene(req: SceneRequest):
    """Saves a snapshot of device states as a named scene."""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Scene name is required")
    scene_id = f"scene_{uuid.uuid4().hex[:8]}"
    SCENES[scene_id] = {
        "id": scene_id,
        "name": req.name.strip(),
        "icon": req.icon or "sparkles",
        "states": req.states,
        "created_at": datetime.now().isoformat(timespec="seconds")
    }
    save_persisted_data()
    return SCENES[scene_id]

@app.post("/api/scenes/{scene_id}/apply")
async def apply_scene(scene_id: str):
    """Recalls a saved scene across all its devices."""
    if scene_id not in SCENES:
        raise HTTPException(status_code=404, detail="Scene not found")
    applied = apply_scene_by_id(scene_id)
    return {"status": "success", "applied_devices": applied}

@app.delete("/api/scenes/{scene_id}")
async def delete_scene(scene_id: str):
    """Deletes a saved scene."""
    if scene_id not in SCENES:
        raise HTTPException(status_code=404, detail="Scene not found")
    del SCENES[scene_id]
    save_persisted_data()
    return {"status": "deleted"}

# ----------------------------------------------------------------------------
# Groups API
# ----------------------------------------------------------------------------

@app.get("/api/groups")
async def list_groups():
    """Lists all device groups."""
    return list(GROUPS.values())

@app.post("/api/groups")
async def create_group(req: GroupRequest):
    """Creates a named group of devices for unified control."""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Group name is required")
    if not req.device_ids:
        raise HTTPException(status_code=400, detail="Group needs at least one device")
    group_id = f"group_{uuid.uuid4().hex[:8]}"
    GROUPS[group_id] = {
        "id": group_id,
        "name": req.name.strip(),
        "device_ids": req.device_ids
    }
    save_persisted_data()
    return GROUPS[group_id]

@app.patch("/api/groups/{group_id}")
async def update_group(group_id: str, req: GroupUpdateRequest):
    """Renames a group and/or updates its device membership."""
    group = GROUPS.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if req.name is not None:
        if not req.name.strip():
            raise HTTPException(status_code=400, detail="Group name cannot be empty")
        group["name"] = req.name.strip()
    if req.device_ids is not None:
        if len(req.device_ids) == 0:
            raise HTTPException(status_code=400, detail="Group needs at least one device")
        group["device_ids"] = req.device_ids
    save_persisted_data()
    return group

@app.post("/api/groups/{group_id}/control")
async def control_group(group_id: str, req: ControlRequest):
    """Applies a control payload to every device in a group."""
    group = GROUPS.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    payload = req.model_dump(exclude_none=True)
    applied = 0
    for dev_id in group["device_ids"]:
        if dev_id in DEVICES and apply_control_payload(dev_id, payload):
            applied += 1
    return {"status": "success", "applied_devices": applied}

@app.delete("/api/groups/{group_id}")
async def delete_group(group_id: str):
    """Deletes a device group."""
    if group_id not in GROUPS:
        raise HTTPException(status_code=404, detail="Group not found")
    del GROUPS[group_id]
    save_persisted_data()
    return {"status": "deleted"}

# ----------------------------------------------------------------------------
# Built-in Presets API
# ----------------------------------------------------------------------------

BUILTIN_PRESETS = [
    {
        "id": "stealth_ops",
        "name": "Stealth Ops",
        "description": "Blackout. Turns off all lights.",
        "icon": "Power"
    },
    {
        "id": "breach_alert",
        "name": "Breach Alert",
        "description": "High-intensity flashing red alert across all zones.",
        "icon": "AlertCircle"
    },
    {
        "id": "cyberpunk",
        "name": "Cyberpunk District",
        "description": "Deep neon purple and cyan ambient glow.",
        "icon": "Zap"
    },
    {
        "id": "cozy_bunker",
        "name": "Cozy Command Bunker",
        "description": "Warm 2700K low-intensity cozy light for focused sessions.",
        "icon": "Sun"
    },
    {
        "id": "chroma_flow",
        "name": "Chroma Flow",
        "description": "Dynamic rainbow waves for WLED and soft purple on WiZ.",
        "icon": "Palette"
    }
]

def apply_preset_logic(preset_id: str, device_ids: list):
    """Executes the preset logic on a list of device IDs."""
    applied_count = 0
    if preset_id == "stealth_ops":
        for dev_id in device_ids:
            if dev_id in DEVICES and apply_control_payload(dev_id, {"on": False}):
                applied_count += 1
    elif preset_id == "breach_alert":
        for dev_id in device_ids:
            if dev_id in DEVICES:
                dev = DEVICES[dev_id]
                payload = {
                    "on": True,
                    "bri": 255,
                    "color": [255, 0, 0]
                }
                if dev["type"] == "wled":
                    payload["fx"] = 2  # Breathe / Blink effect
                    payload["sx"] = 220
                    payload["ix"] = 255
                if apply_control_payload(dev_id, payload):
                    applied_count += 1
    elif preset_id == "cyberpunk":
        for idx, dev_id in enumerate(device_ids):
            if dev_id in DEVICES:
                dev = DEVICES[dev_id]
                color = [168, 85, 247] if idx % 2 == 0 else [6, 182, 212]
                payload = {
                    "on": True,
                    "bri": 200,
                    "color": color
                }
                if dev["type"] == "wled":
                    payload["fx"] = 9  # Rainbow chase
                    payload["sx"] = 100
                    payload["ix"] = 128
                if apply_control_payload(dev_id, payload):
                    applied_count += 1
    elif preset_id == "cozy_bunker":
        for dev_id in device_ids:
            if dev_id in DEVICES:
                dev = DEVICES[dev_id]
                payload = {
                    "on": True,
                    "bri": 120,
                }
                if dev["type"] == "wiz":
                    payload["temp"] = 2700  # Warm White
                else:
                    payload["color"] = [255, 140, 45]  # Warm golden orange
                    if dev["type"] == "wled":
                        payload["fx"] = 0  # Solid Color
                if apply_control_payload(dev_id, payload):
                    applied_count += 1
    elif preset_id == "chroma_flow":
        for dev_id in device_ids:
            if dev_id in DEVICES:
                dev = DEVICES[dev_id]
                payload = {
                    "on": True,
                    "bri": 220,
                }
                if dev["type"] == "wled":
                    payload["fx"] = 9  # Rainbow chase
                    payload["sx"] = 150
                    payload["ix"] = 150
                    payload["color"] = [255, 255, 255]
                else:
                    payload["color"] = [168, 85, 247] # Purple base for WiZ
                if apply_control_payload(dev_id, payload):
                    applied_count += 1
    else:
        return None
    return applied_count

@app.get("/api/presets")
async def list_presets():
    """Lists all built-in group presets."""
    return BUILTIN_PRESETS

@app.post("/api/presets/{preset_id}/apply")
async def apply_preset(preset_id: str):
    """Applies a built-in preset globally to all devices."""
    if sync_worker.running:
        sync_worker.stop()
    all_dev_ids = list(DEVICES.keys())
    applied = apply_preset_logic(preset_id, all_dev_ids)
    if applied is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"status": "success", "applied_devices": applied}

@app.post("/api/groups/{group_id}/preset/{preset_id}/apply")
async def apply_preset_to_group(group_id: str, preset_id: str):
    """Applies a built-in preset to a specific group."""
    group = GROUPS.get(group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    group_dev_ids = group["device_ids"]
    applied = apply_preset_logic(preset_id, group_dev_ids)
    if applied is None:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"status": "success", "applied_devices": applied}

# ----------------------------------------------------------------------------
# Color Palette Generator API
# ----------------------------------------------------------------------------

@app.get("/api/palette/generate")
async def generate_palette(base: str = "a855f7", scheme: str = "analogous"):
    """Generates a color-harmony palette from a base hex color.
    Schemes: complementary, analogous, triadic, tetradic, monochrome."""
    base = base.lstrip("#")
    if len(base) != 6:
        raise HTTPException(status_code=400, detail="Base color must be a 6-digit hex")
    try:
        r, g, b = (int(base[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hex color")

    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    s = max(s, 0.45)  # keep palettes vivid
    v = max(v, 0.55)

    hue_offsets = {
        "complementary": [0.0, 0.5, 0.08, 0.58, 0.92],
        "analogous":     [0.0, 0.066, 0.133, -0.066, -0.133],
        "triadic":       [0.0, 1/3, 2/3, 0.05, 0.38],
        "tetradic":      [0.0, 0.25, 0.5, 0.75, 0.05],
        "monochrome":    [0.0, 0.0, 0.0, 0.0, 0.0],
    }
    if scheme not in hue_offsets:
        raise HTTPException(status_code=400, detail=f"Unknown scheme. Use one of: {', '.join(hue_offsets)}")

    colors = []
    for i, off in enumerate(hue_offsets[scheme]):
        nh = (h + off) % 1.0
        if scheme == "monochrome":
            nv = max(0.15, min(1.0, v - 0.18 * i + 0.18))
            ns = max(0.1, min(1.0, s - 0.1 * i + 0.1))
        else:
            nv = v
            ns = s
        nr, ng, nb = colorsys.hsv_to_rgb(nh, ns, nv)
        rgb = [int(nr * 255), int(ng * 255), int(nb * 255)]
        colors.append({
            "hex": "#{:02x}{:02x}{:02x}".format(*rgb),
            "rgb": rgb
        })
    return {"scheme": scheme, "base": f"#{base}", "colors": colors}

# ----------------------------------------------------------------------------
# Schedules API + background scheduler
# ----------------------------------------------------------------------------

@app.get("/api/schedules")
async def list_schedules():
    """Lists all automation schedules."""
    return list(SCHEDULES.values())

@app.post("/api/schedules")
async def create_schedule(req: ScheduleRequest):
    """Creates a time-based automation (turn on/off devices or apply a scene)."""
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Schedule name is required")
    try:
        datetime.strptime(req.time, "%H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="Time must be in HH:MM 24h format")
    if req.action not in ("on", "off", "scene"):
        raise HTTPException(status_code=400, detail="Action must be 'on', 'off', or 'scene'")
    if req.action == "scene" and req.scene_id not in SCENES:
        raise HTTPException(status_code=400, detail="Valid scene_id required for scene action")
    schedule_id = f"sched_{uuid.uuid4().hex[:8]}"
    SCHEDULES[schedule_id] = {
        "id": schedule_id,
        "name": req.name.strip(),
        "time": req.time,
        "days": req.days,
        "action": req.action,
        "target": req.target or "all",
        "scene_id": req.scene_id,
        "enabled": req.enabled,
        "last_run": None
    }
    save_persisted_data()
    return SCHEDULES[schedule_id]

@app.post("/api/schedules/{schedule_id}/toggle")
async def toggle_schedule(schedule_id: str):
    """Enables/disables a schedule."""
    if schedule_id not in SCHEDULES:
        raise HTTPException(status_code=404, detail="Schedule not found")
    SCHEDULES[schedule_id]["enabled"] = not SCHEDULES[schedule_id]["enabled"]
    save_persisted_data()
    return SCHEDULES[schedule_id]

@app.delete("/api/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str):
    """Deletes a schedule."""
    if schedule_id not in SCHEDULES:
        raise HTTPException(status_code=404, detail="Schedule not found")
    del SCHEDULES[schedule_id]
    save_persisted_data()
    return {"status": "deleted"}

def _resolve_schedule_targets(target: str):
    """Resolves a schedule target ('all', group_id, or device_id) to device IDs."""
    if target == "all" or not target:
        return list(DEVICES.keys())
    if target in GROUPS:
        return [d for d in GROUPS[target]["device_ids"] if d in DEVICES]
    if target in DEVICES:
        return [target]
    return []

def _scheduler_loop():
    """Background loop: fires enabled schedules at their HH:MM on matching weekdays."""
    while True:
        try:
            now = datetime.now()
            current_hhmm = now.strftime("%H:%M")
            today_key = now.strftime("%Y-%m-%d")
            weekday = now.weekday()
            for sched in list(SCHEDULES.values()):
                if not sched.get("enabled"):
                    continue
                if sched.get("time") != current_hhmm or weekday not in sched.get("days", []):
                    continue
                run_key = f"{today_key} {current_hhmm}"
                if sched.get("last_run") == run_key:
                    continue
                sched["last_run"] = run_key
                logger.info(f"Schedule '{sched['name']}' firing (action={sched['action']})")
                if sched["action"] == "scene" and sched.get("scene_id"):
                    apply_scene_by_id(sched["scene_id"])
                else:
                    payload = {"on": sched["action"] == "on"}
                    for dev_id in _resolve_schedule_targets(sched.get("target", "all")):
                        apply_control_payload(dev_id, payload)
                save_persisted_data()
        except Exception as e:
            logger.error(f"Scheduler loop error: {e}")
        time.sleep(20)

scheduler_thread = threading.Thread(target=_scheduler_loop, daemon=True)
scheduler_thread.start()

# ----------------------------------------------------------------------------
# Live Stats API
# ----------------------------------------------------------------------------

@app.get("/api/stats")
async def get_stats():
    """Returns live dashboard statistics."""
    devices_on = 0
    total_leds = 0
    type_counts = {}
    for dev_id, dev in DEVICES.items():
        type_counts[dev["type"]] = type_counts.get(dev["type"], 0) + 1
        total_leds += dev.get("led_count") or 0
        client = CLIENTS.get(dev_id)
        if client:
            try:
                if client.get_state().get("on"):
                    devices_on += 1
            except Exception:
                pass
    return {
        "device_count": len(DEVICES),
        "devices_on": devices_on,
        "total_leds": total_leds,
        "type_counts": type_counts,
        "scene_count": len(SCENES),
        "group_count": len(GROUPS),
        "schedule_count": len(SCHEDULES),
        "active_schedules": sum(1 for s in SCHEDULES.values() if s.get("enabled")),
        "sync": {
            "active": sync_worker.running,
            "fps_target": sync_worker.fps,
            "fps_actual": getattr(sync_worker, "actual_fps", 0.0),
            "frames": getattr(sync_worker, "frame_count", 0),
            "device_ids": sync_worker.active_device_ids if sync_worker.running else []
        },
        "uptime_seconds": int(time.time() - SERVER_STARTED_AT)
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
