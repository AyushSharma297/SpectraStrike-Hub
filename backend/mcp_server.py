import sys
import logging

# Ensure httpx is imported. FastMCP will use it under the hood.
try:
    import httpx
except ImportError:
    print("Error: 'httpx' is required for the MCP server. Please install it using 'pip install httpx'.", file=sys.stderr)
    sys.exit(1)

try:
    from mcp.server.fastmcp import FastMCP
except ImportError:
    print("Error: 'mcp' SDK is required. Please install it using 'pip install mcp'.", file=sys.stderr)
    sys.exit(1)

logging.basicConfig(level=logging.WARNING)

mcp = FastMCP("SpectraStrike Hub")
API_URL = "http://127.0.0.1:8000/api"

@mcp.tool()
async def scan_lights() -> str:
    """Scans the local network for WLED and Philips WiZ lights."""
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(f"{API_URL}/scan", timeout=10.0)
            return f"Network scan triggered. Found devices: {r.json()}"
        except Exception as e:
            return f"Error triggering network scan. Make sure backend is running at http://127.0.0.1:8000. Details: {e}"

@mcp.tool()
async def get_lights() -> str:
    """Retrieves all discovered WLED and WiZ lights and their current status (power, brightness, color, type)."""
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(f"{API_URL}/devices", timeout=5.0)
            devices = r.json()
            if not devices:
                return "No light devices registered. Try running 'scan_lights' first."
            
            lines = ["Discovered Light Devices:"]
            for d in devices:
                pwr = "ON" if d['state'].get('on') else "OFF"
                bri = d['state'].get('bri', 0)
                col = d['state'].get('color', [255, 255, 255])
                lines.append(f"- ID: {d['id']} | Name: {d['name']} | Type: {d['type'].upper()} | IP: {d['ip']} | Power: {pwr} | Brightness: {bri} | Color: {col}")
            return "\n".join(lines)
        except Exception as e:
            return f"Error listing devices: {e}"

@mcp.tool()
async def control_light(
    device_id: str, 
    power: bool = None, 
    brightness: int = None, 
    r: int = None, 
    g: int = None, 
    b: int = None, 
    effect_id: int = None, 
    temp: int = None
) -> str:
    """Controls properties of a specific light device.
    
    Arguments:
    - device_id: The ID of the light to control (e.g. 'mock_wled_tv', 'wiz_192_168_1_50')
    - power: True to turn on, False to turn off
    - brightness: Brightness level from 0 (off) to 255 (maximum brightness)
    - r: Red color value (0-255)
    - g: Green color value (0-255)
    - b: Blue color value (0-255)
    - effect_id: (WLED only) Numerical ID of WLED animation effect (0 = Solid)
    - temp: (WiZ only) Color temperature in Kelvin (2200 to 6500)
    """
    payload = {}
    if power is not None:
        payload["on"] = power
    if brightness is not None:
        payload["bri"] = brightness
    if r is not None and g is not None and b is not None:
        payload["color"] = [r, g, b]
    if effect_id is not None:
        payload["fx"] = effect_id
    if temp is not None:
        payload["temp"] = temp

    async with httpx.AsyncClient() as client:
        try:
            r_post = await client.post(f"{API_URL}/devices/{device_id}/control", json=payload, timeout=5.0)
            if r_post.status_code == 200:
                return f"Successfully controlled device '{device_id}'. Updated state: {r_post.json()}"
            else:
                return f"Failed to control device. Code: {r_post.status_code}. Response: {r_post.text}"
        except Exception as e:
            return f"Network communication error: {e}"

@mcp.tool()
async def configure_screen_sync(
    device_ids: list[str], 
    active: bool, 
    mode: str = "average", 
    fps: int = 20
) -> str:
    """Starts or stops syncing the selected light devices to the computer screen.
    
    Arguments:
    - device_ids: List of device IDs to include in the screen synchronization.
    - active: True to start sync, False to stop sync.
    - mode: "average" (full screen average) or "border" (strip mapping for WLED edges)
    - fps: Screen capture frame rate (1 to 60)
    """
    payload = {
        "device_ids": device_ids,
        "active": active,
        "mode": mode,
        "fps": fps
    }
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(f"{API_URL}/sync/screen", json=payload, timeout=5.0)
            status = "enabled" if active else "disabled"
            return f"Screen synchronization {status} successfully: {r.json()}"
        except Exception as e:
            return f"Error configuring screen sync: {e}"

@mcp.tool()
async def get_segments() -> str:
    """Retrieves all registered WLED multi-zone LED segment divisions."""
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(f"{API_URL}/sync/segments", timeout=5.0)
            segments = r.json()
            if not segments:
                return "No multi-zone LED segments configured."
            
            lines = ["Active WLED Segments Mappings:"]
            for dev_id, seg_list in segments.items():
                if not seg_list:
                    continue
                lines.append(f"Device {dev_id}:")
                for idx, seg in enumerate(seg_list):
                    lines.append(f"  - Segment {idx + 1}: LEDs {seg['start']}-{seg['end']} mapped to zone '{seg['zone']}'")
            return "\n".join(lines)
        except Exception as e:
            return f"Error retrieving segments: {e}"

@mcp.tool()
async def configure_segments(
    device_id: str,
    segments: list[dict]
) -> str:
    """Configures multi-zone LED segments for a WLED device.
    
    Arguments:
    - device_id: The WLED device ID to update (e.g. 'wled_192_168_1_50')
    - segments: List of dicts, each containing: 'start' (int), 'end' (int), and 'zone' ('left'|'top'|'right'|'bottom'|'center')
      Example: [{"start": 0, "end": 15, "zone": "left"}, {"start": 15, "end": 30, "zone": "top"}]
    """
    payload = {
        "device_id": device_id,
        "segments": segments
    }
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(f"{API_URL}/sync/segments", json=payload, timeout=5.0)
            if r.status_code == 200:
                return f"Successfully configured segments for '{device_id}'. Updated mappings: {r.json()}"
            else:
                return f"Failed to save segments mapping. Code: {r.status_code}. Response: {r.text}"
        except Exception as e:
            return f"Error configuring segments: {e}"

@mcp.tool()
async def get_calibration(device_id: str) -> str:
    """Retrieves the current color calibration settings for a light device.
    
    Arguments:
    - device_id: The ID of the device to query (e.g. 'wled_192_168_1_50')
    """
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(f"{API_URL}/devices/{device_id}/calibration", timeout=5.0)
            cal = r.json()
            return f"Color Calibration for '{device_id}':\n- Red channel perceived color: {cal['r_seen']}\n- Green channel perceived color: {cal['g_seen']}\n- Blue channel perceived color: {cal['b_seen']}"
        except Exception as e:
            return f"Error retrieving calibration: {e}"

@mcp.tool()
async def configure_calibration(
    device_id: str,
    r_seen: list[int],
    g_seen: list[int],
    b_seen: list[int],
    gamma: float = 2.2,
    min_r: int = 0,
    min_g: int = 0,
    min_b: int = 0,
    max_r: int = 255,
    max_g: int = 255,
    max_b: int = 255,
    temp: int = 6500
) -> str:
    """Configures manual color calibration settings for a device to improve color accuracy.
    
    Arguments:
    - device_id: The ID of the device to calibrate (e.g. 'wiz_192_168_1_150')
    - r_seen: Perceived RGB value when Red (255,0,0) is commanded (e.g. [255, 15, 0])
    - g_seen: Perceived RGB value when Green (0,255,0) is commanded (e.g. [5, 255, 10])
    - b_seen: Perceived RGB value when Blue (0,0,255) is commanded (e.g. [0, 10, 255])
    - gamma: Gamma correction factor (1.0 to 3.0, default 2.2)
    - min_r: Minimum red output channel offset for black level calibration (0 to 100, default 0)
    - min_g: Minimum green output channel offset for black level calibration (0 to 100, default 0)
    - min_b: Minimum blue output channel offset for black level calibration (0 to 100, default 0)
    - max_r: Maximum red output channel limit for white balance calibration (100 to 255, default 255)
    - max_g: Maximum green output channel limit for white balance calibration (100 to 255, default 255)
    - max_b: Maximum blue output channel limit for white balance calibration (100 to 255, default 255)
    - temp: Color Temperature in Kelvin (2000 to 10000, default 6500)
    """
    payload = {
        "r_seen": r_seen,
        "g_seen": g_seen,
        "b_seen": b_seen,
        "gamma": gamma,
        "min_r": min_r,
        "min_g": min_g,
        "min_b": min_b,
        "max_r": max_r,
        "max_g": max_g,
        "max_b": max_b,
        "temp": temp
    }
    async with httpx.AsyncClient() as client:
        try:
            r = await client.post(f"{API_URL}/devices/{device_id}/calibration", json=payload, timeout=5.0)
            if r.status_code == 200:
                return f"Successfully saved calibration for '{device_id}': {r.json()}"
            else:
                return f"Failed to save calibration. Code: {r.status_code}. Response: {r.text}"
        except Exception as e:
            return f"Error saving calibration: {e}"

if __name__ == "__main__":
    mcp.run()
