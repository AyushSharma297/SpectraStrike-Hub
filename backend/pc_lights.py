import logging

logger = logging.getLogger("pc_lights")

# Try importing OpenRGB library
try:
    from openrgb import OpenRGBClient
    from openrgb.utils import RGBColor
    HAS_OPENRGB = True
except ImportError:
    HAS_OPENRGB = False
    logger.warning("openrgb-python package not installed. Running OpenRGB in mock mode only.")

class OpenRGBPCClient:
    def __init__(self, ip="127.0.0.1", port=6742, is_mock=False):
        self.ip = ip
        self.port = port
        self.is_mock = is_mock or not HAS_OPENRGB
        self.client = None
        self.devices = []
        self.calibration_matrix = None
        self.state = {
            "on": True,
            "bri": 128,
            "color": [139, 92, 246] # Purple accent default
        }
        
        if not self.is_mock:
            self._connect()
            
    def _connect(self):
        try:
            self.client = OpenRGBClient(self.ip, self.port)
            self.devices = self.client.devices
            logger.info(f"Connected to OpenRGB server. Discovered {len(self.devices)} PC lighting devices.")
        except Exception as e:
            logger.warning(f"Could not connect to OpenRGB server at {self.ip}:{self.port}: {e}. Falling back to mock mode.")
            self.is_mock = True

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

    def _apply_state(self):
        """Applies the current RGB state to all OpenRGB devices."""
        if self.is_mock:
            return
            
        try:
            if not self.client:
                self._connect()
                if not self.client:
                    return
                    
            r, g, b = self.state["color"]
            rc, gc, bc = self._calibrate_color(r, g, b)
            # Scale by brightness
            factor = self.state["bri"] / 255.0
            sr = int(rc * factor)
            sg = int(gc * factor)
            sb = int(bc * factor)
            
            # OpenRGB set colors
            color_obj = RGBColor(sr, sg, sb)
            for device in self.devices:
                try:
                    device.set_color(color_obj)
                except Exception as ex:
                    logger.debug(f"Failed to set color on OpenRGB device {device.name}: {ex}")
        except Exception as e:
            logger.warning(f"OpenRGB command application failed: {e}")
            self.client = None # Reset connection to retry later

    def turn_on(self):
        self.state["on"] = True
        self._apply_state()
        return self.state

    def turn_off(self):
        self.state["on"] = False
        if not self.is_mock:
            # Send dark/off color
            try:
                if self.client:
                    color_obj = RGBColor(0, 0, 0)
                    for device in self.devices:
                        device.set_color(color_obj)
            except Exception:
                pass
        return self.state

    def set_brightness(self, bri):
        self.state["bri"] = max(0, min(255, int(bri)))
        self._apply_state()
        return self.state

    def set_color(self, r, g, b):
        self.state["on"] = True
        self.state["color"] = [int(r), int(g), int(b)]
        self._apply_state()
        return self.state

    def get_state(self):
        """Returns the current state cache."""
        if not self.is_mock and not self.client:
            self._connect() # Try reconnecting in background
        return self.state

    def stream_color(self, r, g, b):
        """Streams color directly for real-time synchronization."""
        if self.is_mock:
            self.state["color"] = [r, g, b]
            return
            
        try:
            if not self.client:
                self._connect()
                if not self.client:
                    return
            
            rc, gc, bc = self._calibrate_color(r, g, b)
            # Apply brightness factor
            factor = self.state["bri"] / 255.0
            sr = int(rc * factor)
            sg = int(gc * factor)
            sb = int(bc * factor)
            
            color_obj = RGBColor(sr, sg, sb)
            for device in self.devices:
                device.set_color(color_obj)
        except Exception:
            pass
            
    def close(self):
        if self.client:
            self.client = None
            self.devices = []
