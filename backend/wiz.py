"""
Philips WiZ Light UDP JSON-RPC Client

Implements the WiZ bulb communication protocol:
- Stateless UDP JSON-RPC messaging on port 38899
- No persistent TCP connections required
- Methods: setPilot (control), getPilot (state query)
- Supports RGB color, dimming, temperature control
"""

import socket
import json
import logging
import time

logger = logging.getLogger("wiz")


class WiZClient:
    """
    WiZ Smart Bulb UDP JSON-RPC Client.
    
    Communication Architecture:
    1. Destination: UDP <bulb_ip>:38899
    2. Protocol: JSON-RPC over UDP (stateless)
    3. Methods: setPilot, getPilot
    4. No connection handshake required
    """

    # WiZ protocol constants
    WIZ_PORT = 38899
    UDP_TIMEOUT = 1.0
    DIMMING_MIN = 10  # WiZ minimum: 10%
    DIMMING_MAX = 100  # WiZ maximum: 100%
    TEMP_MIN = 2200   # Kelvin (warm white)
    TEMP_MAX = 6500   # Kelvin (cool white)

    def __init__(self, ip, is_mock=False):
        """Initialize WiZ client for a specific bulb IP."""
        self.ip = ip
        self.is_mock = is_mock
        
        # Internal state cache
        self.state = {
            "on": True,
            "bri": 128,              # 0-255 brightness
            "color": [255, 255, 255],  # [R, G, B]
            "temp": 4000             # Color temperature in Kelvin
        }
        
        # Calibration matrix and LUT
        self.calibration_matrix = None
        self.gamma_lut = None
        self.temp_mults = None
        self.min_r = self.min_g = self.min_b = 0
        self.max_r = self.max_g = self.max_b = 255

    def _send_udp_command(self, method, params=None, expect_response=True):
        """
        Send JSON-RPC command to WiZ bulb via UDP.
        
        Args:
            method: RPC method name (setPilot, getPilot, etc.)
            params: Dict of parameters for the method
            expect_response: Whether to wait for and parse response
            
        Returns:
            Response dict if expect_response=True, else None
        """
        if self.is_mock:
            return self._handle_mock_command(method, params)

        payload = {
            "method": method,
            "params": params or {}
        }

        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.settimeout(self.UDP_TIMEOUT)

        try:
            # Send JSON-RPC request
            msg = json.dumps(payload).encode('utf-8')
            logger.debug(f"[{self.ip}] Sending {method}: {payload}")
            sock.sendto(msg, (self.ip, self.WIZ_PORT))

            # Try to receive response if expected
            if expect_response:
                try:
                    data, addr = sock.recvfrom(2048)
                    response = json.loads(data.decode('utf-8', errors='ignore'))
                    logger.debug(f"[{self.ip}] Response: {response}")
                    
                    # Cache state from getPilot responses
                    if method == "getPilot" and isinstance(response, dict) and "result" in response:
                        self._update_state_from_response(response["result"])
                    
                    return response
                except socket.timeout:
                    logger.debug(f"[{self.ip}] No response to {method} (timeout)")
                    return None
                except json.JSONDecodeError as e:
                    logger.warning(f"[{self.ip}] Invalid JSON response: {e}")
                    return None
            return None

        except socket.error as e:
            logger.error(f"[{self.ip}] UDP error: {e}")
            return None
        finally:
            sock.close()

    def _handle_mock_command(self, method, params):
        """Handle commands in mock mode (for testing)."""
        logger.debug(f"[{self.ip}] Mock: {method} {params}")
        
        if method == "setPilot":
            # Update mock state
            if params.get("state") is not None:
                self.state["on"] = params["state"]
            if params.get("dimming") is not None:
                # Convert dimming % to brightness 0-255
                self.state["bri"] = int((params["dimming"] / 100.0) * 255)
            if params.get("r") is not None:
                self.state["color"] = [
                    params.get("r", 255),
                    params.get("g", 255),
                    params.get("b", 255)
                ]
            if params.get("temp") is not None:
                self.state["temp"] = params["temp"]
            
            return {"result": {"success": True}}
        
        elif method == "getPilot":
            # Return current mock state
            return {
                "result": {
                    "state": self.state["on"],
                    "dimming": int((self.state["bri"] / 255.0) * 100),
                    "r": self.state["color"][0],
                    "g": self.state["color"][1],
                    "b": self.state["color"][2],
                    "temp": self.state["temp"]
                }
            }
        
        return None

    def _update_state_from_response(self, result):
        """Update internal state cache from getPilot response."""
        if not isinstance(result, dict):
            return
        
        if result.get("state") is not None:
            self.state["on"] = result["state"]
        if result.get("dimming") is not None:
            self.state["bri"] = int((result["dimming"] / 100.0) * 255)
        if result.get("r") is not None and result.get("g") is not None and result.get("b") is not None:
            self.state["color"] = [result["r"], result["g"], result["b"]]
        if result.get("temp") is not None:
            self.state["temp"] = result["temp"]

    def turn_on(self):
        """Turn the bulb on."""
        logger.info(f"[{self.ip}] Turning ON")
        return self._send_udp_command("setPilot", {"state": True})

    def turn_off(self):
        """Turn the bulb off."""
        logger.info(f"[{self.ip}] Turning OFF")
        return self._send_udp_command("setPilot", {"state": False})

    def set_brightness(self, bri_255):
        """
        Set brightness.
        
        Args:
            bri_255: Brightness 0-255 (unified control interface)
            
        Maps to WiZ dimming 10-100%
        """
        # Convert 0-255 to 10-100% dimming
        dimming = max(self.DIMMING_MIN, min(self.DIMMING_MAX, int((bri_255 / 255.0) * 100)))
        logger.info(f"[{self.ip}] Setting brightness {bri_255}/255 (dimming {dimming}%)")
        return self._send_udp_command("setPilot", {"state": True, "dimming": dimming})

    def set_color(self, r, g, b):
        """
        Set RGB color.
        
        Args:
            r, g, b: Color channels 0-255
        """
        # Apply color calibration if configured
        rc, gc, bc = self._calibrate_color(r, g, b)
        logger.info(f"[{self.ip}] Setting color RGB({r},{g},{b}) -> calibrated RGB({rc},{gc},{bc})")
        return self._send_udp_command("setPilot", {
            "state": True,
            "r": rc,
            "g": gc,
            "b": bc
        })

    def set_temp(self, temp_kelvin):
        """
        Set color temperature.
        
        Args:
            temp_kelvin: Color temperature in Kelvin (2200-6500)
        """
        temp = max(self.TEMP_MIN, min(self.TEMP_MAX, int(temp_kelvin)))
        logger.info(f"[{self.ip}] Setting temperature {temp}K")
        return self._send_udp_command("setPilot", {"state": True, "temp": temp})

    def get_state(self):
        """
        Query and return current bulb state.
        
        Returns:
            Dict with keys: on, bri (0-255), color ([R,G,B]), temp (Kelvin)
        """
        logger.debug(f"[{self.ip}] Querying state...")
        response = self._send_udp_command("getPilot")
        
        if response and isinstance(response, dict) and "result" in response:
            self._update_state_from_response(response["result"])
        
        return self.state

    def stream_color(self, r, g, b):
        """
        Real-time color streaming (fire-and-forget).
        
        Sends setPilot packet without waiting for response to minimize latency.
        Suitable for rapid screen sync updates.
        
        Args:
            r, g, b: Color channels 0-255
        """
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
            sock.sendto(msg, (self.ip, self.WIZ_PORT))
            # Don't wait for response - fire and forget for low latency
        except Exception as e:
            logger.debug(f"[{self.ip}] Stream send error: {e}")
        finally:
            sock.close()

    def set_calibration(self, matrix, gamma=2.2, min_r=0, min_g=0, min_b=0, 
                       max_r=255, max_g=255, max_b=255, temp_mults=None):
        """
        Configure TrueColor calibration matrix.
        
        Args:
            matrix: 3x3 inverse color correction matrix
            gamma: Gamma curve exponent (default 2.2)
            min_r/g/b: Minimum output levels for each channel
            max_r/g/b: Maximum output levels for each channel
            temp_mults: Temperature multiplier adjustments [r, g, b]
        """
        self.calibration_matrix = matrix
        self.min_r = min_r
        self.min_g = min_g
        self.min_b = min_b
        self.max_r = max_r
        self.max_g = max_g
        self.max_b = max_b
        self.temp_mults = temp_mults
        
        # Pre-compute gamma lookup table for efficiency
        self.gamma_lut = [
            max(0, min(255, int(255 * (i / 255.0) ** gamma)))
            for i in range(256)
        ]
        logger.info(f"[{self.ip}] Calibration matrix set: gamma={gamma}")

    def _calibrate_color(self, r, g, b):
        """
        Apply TrueColor calibration to RGB values.
        
        Calibration pipeline:
        1. Matrix correction (3x3 crosstalk correction)
        2. Black/white range mapping
        3. Temperature multiplier adjustment
        4. Gamma LUT correction
        
        Args:
            r, g, b: Input color 0-255
            
        Returns:
            Tuple of calibrated (r, g, b) values 0-255
        """
        # Step 1: Matrix correction (crosstalk)
        if self.calibration_matrix:
            m = self.calibration_matrix
            rc = m[0][0] * r + m[0][1] * g + m[0][2] * b
            gc = m[1][0] * r + m[1][1] * g + m[1][2] * b
            bc = m[2][0] * r + m[2][1] * g + m[2][2] * b
        else:
            rc, gc, bc = float(r), float(g), float(b)

        # Step 2: Black and white range mapping
        rc = max(0.0, min(255.0, rc))
        gc = max(0.0, min(255.0, gc))
        bc = max(0.0, min(255.0, bc))

        rc = self.min_r + (rc * (self.max_r - self.min_r) / 255.0)
        gc = self.min_g + (gc * (self.max_g - self.min_g) / 255.0)
        bc = self.min_b + (bc * (self.max_b - self.min_b) / 255.0)

        # Step 3: Temperature multiplier adjustment
        if self.temp_mults:
            rc = rc * self.temp_mults[0]
            gc = gc * self.temp_mults[1]
            bc = bc * self.temp_mults[2]

        ir = max(0, min(255, int(rc)))
        ig = max(0, min(255, int(gc)))
        ib = max(0, min(255, int(bc)))

        # Step 4: Gamma LUT correction
        if self.gamma_lut:
            ir = self.gamma_lut[ir]
            ig = self.gamma_lut[ig]
            ib = self.gamma_lut[ib]

        return ir, ig, ib
