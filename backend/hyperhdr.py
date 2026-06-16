import urllib.request
import json
import logging
import socket

logger = logging.getLogger("hyperhdr")

class HyperHDRClient:
    def __init__(self, ip, is_mock=False):
        self.ip = ip
        self.is_mock = is_mock
        self.state = {
            "on": True,
            "bri": 128,
            "color": [255, 255, 255],
            "fx": 0,
            "sx": 128,
            "ix": 128
        }
        self.calibration_matrix = None

    def _send_json_rpc(self, payload):
        """Helper to send JSON-RPC commands to HyperHDR."""
        if self.is_mock:
            if payload.get("command") == "componentstate":
                state = payload.get("componentstate", {}).get("state")
                if state is not None:
                    self.state["on"] = state
            elif payload.get("command") == "adjustment":
                bri = payload.get("adjustment", {}).get("brightness")
                if bri is not None:
                    self.state["bri"] = int((bri / 100.0) * 255)
            elif payload.get("command") == "color":
                col = payload.get("color")
                if col and len(col) >= 3:
                    self.state["color"] = col[:3]
            return self.state

        try:
            url = f"http://{self.ip}:8090/json-rpc"
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=1.0) as response:
                if response.status == 200:
                    return json.loads(response.read().decode())
        except Exception as e:
            logger.error(f"Failed to send JSON RPC to HyperHDR {self.ip}: {e}")
        return None

    def turn_on(self):
        self.state["on"] = True
        return self._send_json_rpc({
            "command": "componentstate", 
            "componentstate": {"component": "ALL", "state": True}
        })

    def turn_off(self):
        self.state["on"] = False
        return self._send_json_rpc({
            "command": "componentstate", 
            "componentstate": {"component": "ALL", "state": False}
        })

    def set_brightness(self, bri):
        # Convert 0-255 to 0-100%
        bri = max(0, min(255, int(bri)))
        self.state["bri"] = bri
        percent = int((bri / 255.0) * 100)
        return self._send_json_rpc({
            "command": "adjustment", 
            "adjustment": {"brightness": percent}
        })

    def set_calibration(self, matrix, gamma=2.2, min_r=0, min_g=0, min_b=0, max_r=255, max_g=255, max_b=255, temp_mults=None):
        self.calibration_matrix = matrix
        self.min_r = min_r
        self.min_g = min_g
        self.min_b = min_b
        self.max_r = max_r
        self.max_g = max_g
        self.max_b = max_b
        self.temp_mults = temp_mults
        self.gamma_lut = [max(0, min(255, int(255 * (i / 255.0) ** gamma))) for i in range(256)]

    def _calibrate_color(self, r, g, b):
        if hasattr(self, 'calibration_matrix') and self.calibration_matrix:
            m = self.calibration_matrix
            rc = m[0][0] * r + m[0][1] * g + m[0][2] * b
            gc = m[1][0] * r + m[1][1] * g + m[1][2] * b
            bc = m[2][0] * r + m[2][1] * g + m[2][2] * b
        else:
            rc, gc, bc = r, g, b

        min_r = getattr(self, 'min_r', 0)
        min_g = getattr(self, 'min_g', 0)
        min_b = getattr(self, 'min_b', 0)
        max_r = getattr(self, 'max_r', 255)
        max_g = getattr(self, 'max_g', 255)
        max_b = getattr(self, 'max_b', 255)

        rc = max(0.0, min(255.0, rc))
        gc = max(0.0, min(255.0, gc))
        bc = max(0.0, min(255.0, bc))

        rc = min_r + (rc * (max_r - min_r) / 255.0)
        gc = min_g + (gc * (max_g - min_g) / 255.0)
        bc = min_b + (bc * (max_b - min_b) / 255.0)

        if hasattr(self, 'temp_mults') and self.temp_mults:
            rc = rc * self.temp_mults[0]
            gc = gc * self.temp_mults[1]
            bc = bc * self.temp_mults[2]

        ir = max(0, min(255, int(rc)))
        ig = max(0, min(255, int(gc)))
        ib = max(0, min(255, int(bc)))

        if hasattr(self, 'gamma_lut') and self.gamma_lut:
            ir = self.gamma_lut[ir]
            ig = self.gamma_lut[ig]
            ib = self.gamma_lut[ib]

        return ir, ig, ib

    def set_color(self, r, g, b):
        rc, gc, bc = self._calibrate_color(r, g, b)
        self.state["color"] = [rc, gc, bc]
        return self._send_json_rpc({
            "command": "color",
            "color": [rc, gc, bc],
            "priority": 50,
            "origin": "SpectraStrike"
        })

    def get_state(self):
        """Fetches the current HyperHDR state."""
        if self.is_mock:
            return self.state
            
        try:
            url = f"http://{self.ip}:8090/json-rpc"
            payload = {"command": "serverinfo"}
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=1.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    if data.get("success"):
                        info = data.get("info", {})
                        
                        # Check components for power state
                        components = info.get("components", [])
                        is_on = True
                        for comp in components:
                            if comp.get("name") == "ALL":
                                is_on = comp.get("enabled", True)
                        self.state["on"] = is_on
                        
                        # Get brightness
                        adj = info.get("adjustment", [])
                        if adj and len(adj) > 0:
                            self.state["bri"] = int((adj[0].get("brightness", 50) / 100.0) * 255)
                            
                        # Try to get active color
                        active = info.get("activeLedColor", [])
                        if active and len(active) > 0:
                            rgb = active[0].get("RGB Value", [])
                            if len(rgb) >= 3:
                                self.state["color"] = rgb[:3]
                                
                    return self.state
        except Exception as e:
            logger.error(f"Failed to fetch state for HyperHDR {self.ip}: {e}")
        return self.state

    def stream_udp(self, rgb_list):
        """Sends real-time color stream. HyperHDR handles its own screen capture, so we send the average color via JSON if forced."""
        if self.is_mock:
            if rgb_list:
                total_r = sum(c[0] for c in rgb_list)
                total_g = sum(c[1] for c in rgb_list)
                total_b = sum(c[2] for c in rgb_list)
                n = len(rgb_list)
                self.state["color"] = [int(total_r/n), int(total_g/n), int(total_b/n)]
            return

        if not rgb_list:
            return

        # Calculate average color to send as solid background effect over JSON
        total_r = sum(c[0] for c in rgb_list)
        total_g = sum(c[1] for c in rgb_list)
        total_b = sum(c[2] for c in rgb_list)
        n = len(rgb_list)
        avg_r, avg_g, avg_b = int(total_r/n), int(total_g/n), int(total_b/n)
        
        self.set_color(avg_r, avg_g, avg_b)
        
    def close(self):
        pass
