import socket
import json
import logging

logger = logging.getLogger("wiz")

class WiZClient:
    def __init__(self, ip, is_mock=False):
        self.ip = ip
        self.is_mock = is_mock
        self.calibration_matrix = None
        self.state = {
            "on": True,
            "bri": 128,          # 0-255 range for internal unified control
            "color": [255, 255, 255],
            "temp": 4000         # Color temperature (Kelvin)
        }
        
    def _send_udp_command(self, method, params=None):
        """Sends a JSON-RPC UDP packet to the WiZ bulb on port 38899."""
        payload = {
            "method": method,
            "params": params or {}
        }
        
        if self.is_mock:
            # Update local mock state based on commands
            if method == "setPilot":
                if "state" in payload["params"]:
                    self.state["on"] = payload["params"]["state"]
                if "dimming" in payload["params"]:
                    # WiZ dimming is 10-100%, map to 0-255
                    dim = payload["params"]["dimming"]
                    self.state["bri"] = int((dim / 100.0) * 255)
                if "r" in payload["params"]:
                    self.state["color"] = [
                        payload["params"]["r"],
                        payload["params"]["g"],
                        payload["params"]["b"]
                    ]
                if "temp" in payload["params"]:
                    self.state["temp"] = payload["params"]["temp"]
            return self.state

        # Physical WiZ UDP send
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(0.5)
        try:
            msg = json.dumps(payload).encode('utf-8')
            sock.sendto(msg, (self.ip, 38899))
            
            # Receive response (optional, but good for validation)
            data, addr = sock.recvfrom(1024)
            res = json.loads(data.decode('utf-8'))
            if "result" in res:
                return res["result"]
        except Exception as e:
            logger.error(f"WiZ UDP command failed for {self.ip}: {e}")
        finally:
            sock.close()
        return None

    def turn_on(self):
        return self._send_udp_command("setPilot", {"state": True})

    def turn_off(self):
        return self._send_udp_command("setPilot", {"state": False})

    def set_brightness(self, bri_255):
        """Sets brightness (maps 0-255 to WiZ 10-100% dimming)."""
        # WiZ dimming limit: 10% min, 100% max
        dimming = max(10, min(100, int((bri_255 / 255.0) * 100)))
        return self._send_udp_command("setPilot", {"state": True, "dimming": dimming})

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
        # 1. Matrix correction (crosstalk)
        if hasattr(self, 'calibration_matrix') and self.calibration_matrix:
            m = self.calibration_matrix
            rc = m[0][0] * r + m[0][1] * g + m[0][2] * b
            gc = m[1][0] * r + m[1][1] * g + m[1][2] * b
            bc = m[2][0] * r + m[2][1] * g + m[2][2] * b
        else:
            rc, gc, bc = r, g, b

        # 2. Black and White range mapping (linear mapping)
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

        # 3. Temp multipliers
        if hasattr(self, 'temp_mults') and self.temp_mults:
            rc = rc * self.temp_mults[0]
            gc = gc * self.temp_mults[1]
            bc = bc * self.temp_mults[2]

        ir = max(0, min(255, int(rc)))
        ig = max(0, min(255, int(gc)))
        ib = max(0, min(255, int(bc)))

        # 4. Gamma LUT correction
        if hasattr(self, 'gamma_lut') and self.gamma_lut:
            ir = self.gamma_lut[ir]
            ig = self.gamma_lut[ig]
            ib = self.gamma_lut[ib]

        return ir, ig, ib

    def set_color(self, r, g, b):
        """Sets RGB color."""
        rc, gc, bc = self._calibrate_color(r, g, b)
        return self._send_udp_command("setPilot", {
            "state": True,
            "r": rc,
            "g": gc,
            "b": bc
        })

    def set_temp(self, temp_kelvin):
        """Sets color temperature (2200K - 6500K)."""
        temp = max(2200, min(6500, int(temp_kelvin)))
        return self._send_udp_command("setPilot", {"state": True, "temp": temp})

    def get_state(self):
        """Requests current state from WiZ bulb."""
        if self.is_mock:
            return self.state
            
        result = self._send_udp_command("getPilot")
        if result:
            self.state["on"] = result.get("state", self.state["on"])
            if "dimming" in result:
                self.state["bri"] = int((result["dimming"] / 100.0) * 255)
            if "r" in result:
                self.state["color"] = [result["r"], result["g"], result["b"]]
            if "temp" in result:
                self.state["temp"] = result["temp"]
        return self.state

    def stream_color(self, r, g, b):
        """Real-time fast streaming wrapper for WiZ bulbs."""
        # For real-time sync, WiZ can process fast setPilot packets, but is limited by UDP capacity.
        # We send a standard setPilot packet but without waiting for a reply to avoid latency.
        if self.is_mock:
            self.state["color"] = [r, g, b]
            return
            
        rc, gc, bc = self._calibrate_color(r, g, b)
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            payload = {
                "method": "setPilot",
                "params": {
                    "state": True,
                    "r": rc,
                    "g": gc,
                    "b": bc
                }
            }
            msg = json.dumps(payload).encode('utf-8')
            sock.sendto(msg, (self.ip, 38899))
        except Exception:
            pass
        finally:
            sock.close()
