import urllib.request
import json
import socket
import logging

logger = logging.getLogger("wled")

class WLEDClient:
    def __init__(self, ip, led_count=30, is_mock=False):
        self.ip = ip
        self.led_count = led_count
        self.is_mock = is_mock
        self.udp_sock = None
        self.calibration_matrix = None
        self.state = {
            "on": True,
            "bri": 128,
            "color": [255, 255, 255],
            "fx": 0, # Solid
            "sx": 128,
            "ix": 128
        }
        
    def _send_json_command(self, payload):
        """Helper to send JSON commands to WLED device."""
        if self.is_mock:
            # Update simulated state
            if "on" in payload:
                self.state["on"] = payload["on"]
            if "bri" in payload:
                self.state["bri"] = payload["bri"]
            if "seg" in payload and len(payload["seg"]) > 0:
                seg = payload["seg"][0]
                if "col" in seg and len(seg["col"]) > 0:
                    self.state["color"] = seg["col"][0][:3]
                if "fx" in seg:
                    self.state["fx"] = seg["fx"]
                if "sx" in seg:
                    self.state["sx"] = seg["sx"]
                if "ix" in seg:
                    self.state["ix"] = seg["ix"]
            return self.state

        try:
            url = f"http://{self.ip}/json/state"
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=1.0) as response:
                if response.status == 200:
                    res_data = json.loads(response.read().decode())
                    # Sync state from response
                    self.state["on"] = res_data.get("on", self.state["on"])
                    self.state["bri"] = res_data.get("bri", self.state["bri"])
                    return res_data
        except Exception as e:
            logger.error(f"Failed to send JSON state command to WLED {self.ip}: {e}")
        return self.state

    def turn_on(self):
        return self._send_json_command({"on": True})

    def turn_off(self):
        return self._send_json_command({"on": False})

    def set_brightness(self, bri):
        # WLED bri is 0-255
        bri = max(0, min(255, int(bri)))
        return self._send_json_command({"bri": bri})

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
        rc, gc, bc = self._calibrate_color(r, g, b)
        return self._send_json_command({
            "on": True,
            "seg": [{"col": [[rc, gc, bc]]}]
        })

    def set_effect(self, fx_id, speed=128, intensity=128):
        return self._send_json_command({
            "on": True,
            "seg": [{"fx": fx_id, "sx": speed, "ix": intensity}]
        })

    def get_state(self):
        """Fetches the current WLED state."""
        if self.is_mock:
            return self.state
            
        try:
            url = f"http://{self.ip}/json/state"
            with urllib.request.urlopen(url, timeout=1.0) as response:
                if response.status == 200:
                    data = json.loads(response.read().decode())
                    self.state["on"] = data.get("on", self.state["on"])
                    self.state["bri"] = data.get("bri", self.state["bri"])
                    # Parse color from active segment
                    segs = data.get("seg", [])
                    if segs:
                        cols = segs[0].get("col", [])
                        if cols:
                            self.state["color"] = cols[0][:3]
                        self.state["fx"] = segs[0].get("fx", self.state["fx"])
                        self.state["sx"] = segs[0].get("sx", self.state["sx"])
                        self.state["ix"] = segs[0].get("ix", self.state["ix"])
                    return self.state
        except Exception as e:
            logger.error(f"Failed to fetch state for WLED {self.ip}: {e}")
        return self.state

    def stream_udp(self, rgb_list):
        """Sends real-time DRGB stream packets to WLED UDP port 21324."""
        if self.is_mock:
            # We mock the live stream by updating the average color
            if rgb_list:
                total_r = sum(c[0] for c in rgb_list)
                total_g = sum(c[1] for c in rgb_list)
                total_b = sum(c[2] for c in rgb_list)
                n = len(rgb_list)
                self.state["color"] = [int(total_r/n), int(total_g/n), int(total_b/n)]
            return

        try:
            if not self.udp_sock:
                self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            
            # WLED real-time DRGB protocol packet:
            # [0] Protocol protocol: 2 (DRGB)
            # [1] Timeout in seconds (2s)
            # [2...] RGB data
            packet = bytearray()
            packet.append(2) # Protocol type DRGB
            packet.append(2) # Timeout in seconds before returning to default effect
            
            for color in rgb_list:
                rc, gc, bc = self._calibrate_color(color[0], color[1], color[2])
                packet.append(rc) # R
                packet.append(gc) # G
                packet.append(bc) # B
                
            self.udp_sock.sendto(packet, (self.ip, 21324))
        except Exception as e:
            logger.error(f"Failed WLED UDP stream to {self.ip}: {e}")

    def close(self):
        if self.udp_sock:
            self.udp_sock.close()
            self.udp_sock = None
