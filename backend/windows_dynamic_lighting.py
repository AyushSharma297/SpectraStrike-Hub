import logging
import asyncio

logger = logging.getLogger("windows_dynamic_lighting")

try:
    from winsdk.windows.devices.lights import LampArray
    from winsdk.windows.devices.enumeration import DeviceInformation
    from winsdk.windows.ui import Color
    HAS_WINSDK = True
except ImportError:
    HAS_WINSDK = False
    logger.warning("winsdk not available. Windows Dynamic Lighting will run in stub mode.")

class WindowsDynamicLightingClient:
    def __init__(self):
        self.lamp_arrays = []
        self.calibration_matrix = None
        self.state = {
            "on": True,
            "bri": 255,
            "color": [139, 92, 246]  # Default purple accent
        }
        if HAS_WINSDK:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._init_devices())
            except RuntimeError:
                asyncio.run(self._init_devices())

    async def _init_devices(self):
        if not HAS_WINSDK:
            return
        try:
            selector = LampArray.get_device_selector()
            devices = await DeviceInformation.find_all_async(selector)
            for d_info in devices:
                logger.info(f"Connecting to Windows Dynamic Lighting device: {d_info.name}")
                lamp_array = await LampArray.from_id_async(d_info.id)
                if lamp_array:
                    self.lamp_arrays.append(lamp_array)
            logger.info(f"Initialized {len(self.lamp_arrays)} LampArrays via Windows Dynamic Lighting.")
        except Exception as e:
            logger.error(f"Failed to query Windows Dynamic Lighting devices: {e}")

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
        if not HAS_WINSDK or not self.lamp_arrays:
            return
            
        r, g, b = self.state["color"]
        rc, gc, bc = self._calibrate_color(r, g, b)
        factor = (self.state["bri"] / 255.0) if self.state["on"] else 0.0
        
        c = Color()
        c.r = int(rc * factor)
        c.g = int(gc * factor)
        c.b = int(bc * factor)
        c.a = 255
        
        for la in self.lamp_arrays:
            try:
                la.set_all_colors(c)
            except Exception as e:
                logger.warning(f"Failed to set colors on LampArray: {e}")

    def turn_on(self):
        self.state["on"] = True
        self._apply_state()
        return self.state

    def turn_off(self):
        self.state["on"] = False
        self._apply_state()
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
        return self.state

    def stream_color(self, r, g, b):
        """Streams real-time color changes directly to the LampArray (skips state updates for performance)."""
        if not HAS_WINSDK or not self.lamp_arrays:
            return
            
        rc, gc, bc = self._calibrate_color(r, g, b)
        factor = (self.state["bri"] / 255.0) if self.state["on"] else 0.0
        
        c = Color()
        c.r = int(rc * factor)
        c.g = int(gc * factor)
        c.b = int(bc * factor)
        c.a = 255
        
        for la in self.lamp_arrays:
            try:
                la.set_all_colors(c)
            except Exception:
                pass
