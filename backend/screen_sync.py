import threading
import time
import logging
from PIL import Image
import mss

logger = logging.getLogger("screen_sync")

class ScreenSyncWorker:
    def __init__(self, device_manager):
        self.device_manager = device_manager
        self.active_device_ids = []
        self.layout_mapping = {}  # dict: {device_id: "left" | "top" | ...}
        self.segments_mapping = {} # dict: {device_id: [{"start": 0, "end": 10, "zone": "left"}, ...]}
        self.mode = "average"     # "average" or "border" (only for WLED)
        self.fps = 20
        self.running = False
        self.thread = None
        self.stop_event = threading.Event()
        self.monitor_idx = 1
        
    def start(self, device_ids, layout_mapping=None, segments_mapping=None, mode="average", fps=20, monitor_idx=1):
        """Starts the screen capture and sync thread."""
        if self.running:
            self.stop()
            
        self.active_device_ids = device_ids
        self.layout_mapping = layout_mapping or {}
        self.segments_mapping = segments_mapping or {}
        self.mode = mode
        self.fps = max(1, min(60, fps))
        self.monitor_idx = monitor_idx
        self.stop_event.clear()
        
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"ScreenSync started: devices={device_ids}, layout={self.layout_mapping}, segments={self.segments_mapping}, mode={mode}, fps={fps}")
        
    def stop(self):
        """Stops the sync thread."""
        if not self.running:
            return
            
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2.0)
            self.thread = None
        self.running = False
        logger.info("ScreenSync stopped.")

    def _get_zone_crop(self, img, zone):
        """Helper to crop the image based on the mapped screen zone."""
        w, h = img.size
        
        if zone == "left":
            # Left 15% width of the screen
            return img.crop((0, 0, int(w * 0.15), h))
        elif zone == "right":
            # Right 15% width of the screen
            return img.crop((int(w * 0.85), 0, w, h))
        elif zone == "top":
            # Top 15% height of the screen
            return img.crop((0, 0, w, int(h * 0.15)))
        elif zone == "bottom":
            # Bottom 15% height of the screen
            return img.crop((0, int(h * 0.85), w, h))
        elif zone == "center":
            # Center rectangle (25% to 75% region)
            return img.crop((int(w * 0.25), int(h * 0.25), int(w * 0.75), int(h * 0.75)))
        else:
            # Full screen
            return img

    def _run(self):
        delay = 1.0 / self.fps
        
        with mss.mss() as sct:
            monitors = sct.monitors
            m_idx = self.monitor_idx
            if m_idx >= len(monitors):
                m_idx = 1 if len(monitors) > 1 else 0
                
            monitor = monitors[m_idx]
            
            while not self.stop_event.is_set():
                start_time = time.perf_counter()
                
                try:
                    # Capture screen
                    sct_img = sct.grab(monitor)
                    img = Image.frombytes("RGB", sct_img.size, sct_img.bgra, "raw", "BGRX")
                    
                    for dev_id in self.active_device_ids:
                        dev = self.device_manager.get(dev_id)
                        if not dev:
                            continue
                            
                        dev_segments = self.segments_mapping.get(dev_id, [])
                        
                        if dev.type == "wled" and dev_segments:
                            # Segment-based multi-zone sync
                            n = dev.led_count
                            led_colors = [(0, 0, 0)] * n
                            for seg in dev_segments:
                                start = max(0, min(n - 1, int(seg["start"])))
                                end = max(start + 1, min(n, int(seg["end"])))
                                zone = seg["zone"]
                                cropped = self._get_zone_crop(img, zone)
                                
                                if self.mode == "average":
                                    img_tiny = cropped.resize((1, 1), Image.Resampling.BILINEAR)
                                    r, g, b = img_tiny.getpixel((0, 0))
                                    for idx in range(start, end):
                                        led_colors[idx] = (r, g, b)
                                elif self.mode == "border":
                                    seg_len = end - start
                                    img_grid = cropped.resize((32, 32), Image.Resampling.BILINEAR)
                                    for idx in range(seg_len):
                                        p = idx / max(1, seg_len - 1)
                                        if zone == "left":
                                            x, y = 1, int(31 - p * 31)
                                        elif zone == "right":
                                            x, y = 30, int(p * 31)
                                        elif zone == "top":
                                            x, y = int(p * 31), 1
                                        elif zone == "bottom":
                                            x, y = int((1.0 - p) * 31), 30
                                        else:
                                            x, y = 15, 15
                                        x = max(0, min(31, x))
                                        y = max(0, min(31, y))
                                        led_colors[start + idx] = img_grid.getpixel((x, y))
                            dev.stream_udp(led_colors)
                        else:
                            # Standard single-zone mapping (default fallback)
                            zone = self.layout_mapping.get(dev_id, "all")
                            cropped = self._get_zone_crop(img, zone)
                            
                            if dev.type == "wled":
                                if self.mode == "average":
                                    # Stream average color of the zone
                                    img_tiny = cropped.resize((1, 1), Image.Resampling.BILINEAR)
                                    r, g, b = img_tiny.getpixel((0, 0))
                                    dev.stream_udp([[r, g, b]] * dev.led_count)
                                    
                                elif self.mode == "border":
                                    # Border mapping depending on the zone
                                    img_grid = cropped.resize((32, 32), Image.Resampling.BILINEAR)
                                    n = dev.led_count
                                    led_colors = []
                                    for i in range(n):
                                        p = i / max(1, n - 1)
                                        if zone == "left":
                                            x, y = 1, int(31 - p * 31)
                                        elif zone == "right":
                                            x, y = 30, int(p * 31)
                                        elif zone == "top":
                                            x, y = int(p * 31), 1
                                        elif zone == "bottom":
                                            x, y = int((1.0 - p) * 31), 30
                                        else:
                                            if p < 0.25:
                                                x, y = 1, int(31 - (p / 0.25) * 31)
                                            elif p < 0.50:
                                                x, y = int(((p - 0.25) / 0.25) * 31), 1
                                            elif p < 0.75:
                                                x, y = 30, int(((p - 0.50) / 0.25) * 31)
                                            else:
                                                x, y = int((1.0 - (p - 0.75) / 0.25) * 31), 30
                                        x = max(0, min(31, x))
                                        y = max(0, min(31, y))
                                        led_colors.append(img_grid.getpixel((x, y)))
                                    dev.stream_udp(led_colors)
                                    
                            elif dev.type in ["wiz", "openrgb", "wdl"]:
                                # Bulbs and PC components represent single zones, compute average
                                img_tiny = cropped.resize((1, 1), Image.Resampling.BILINEAR)
                                r, g, b = img_tiny.getpixel((0, 0))
                                dev.stream_color(r, g, b)
                            
                except Exception as e:
                    logger.error(f"Error in screen sync capture loop: {e}")
                    
                elapsed = time.perf_counter() - start_time
                sleep_time = delay - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
