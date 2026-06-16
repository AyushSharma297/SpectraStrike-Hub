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
        self.frame_count = 0
        self.actual_fps = 0.0
        self.started_at = None
        
        # Muzzle Flash / Game Mode variables
        self.flash_enabled = False
        self.flash_threshold = 45
        self.flash_color = [255, 230, 180]
        self.flash_duration = 3
        
        # Customizable detection zone boundaries
        self.zone_configs = {
            "left": 15,
            "right": 15,
            "top": 15,
            "bottom": 15,
            "center_x_min": 25,
            "center_x_max": 75,
            "center_y_min": 25,
            "center_y_max": 75
        }
        
    def start(self, device_ids, layout_mapping=None, segments_mapping=None, mode="average", fps=20, monitor_idx=1,
              flash_enabled=False, flash_threshold=45, flash_color=None, flash_duration=3):
        """Starts the screen capture and sync thread."""
        if self.running:
            self.stop()
            
        self.active_device_ids = device_ids
        self.layout_mapping = layout_mapping or {}
        self.segments_mapping = segments_mapping or {}
        self.mode = mode
        self.fps = max(1, min(60, fps))
        self.monitor_idx = monitor_idx
        
        self.flash_enabled = flash_enabled
        self.flash_threshold = flash_threshold
        self.flash_color = flash_color or [255, 230, 180]
        self.flash_duration = flash_duration
        
        self.stop_event.clear()
        
        self.frame_count = 0
        self.actual_fps = 0.0
        self.started_at = time.time()
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        logger.info(f"ScreenSync started: devices={device_ids}, layout={self.layout_mapping}, mode={mode}, fps={fps}, flash_enabled={flash_enabled}")
        
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
        
        # Read customized zone margins/bounds
        zc = self.zone_configs
        left_pct = zc.get("left", 15) / 100.0
        right_pct = zc.get("right", 15) / 100.0
        top_pct = zc.get("top", 15) / 100.0
        bottom_pct = zc.get("bottom", 15) / 100.0
        cx_min = zc.get("center_x_min", 25) / 100.0
        cx_max = zc.get("center_x_max", 75) / 100.0
        cy_min = zc.get("center_y_min", 25) / 100.0
        cy_max = zc.get("center_y_max", 75) / 100.0
        
        if zone == "left":
            # Left edge margin crop
            return img.crop((0, 0, int(w * left_pct), h))
        elif zone == "right":
            # Right edge margin crop
            return img.crop((int(w * (1 - right_pct)), 0, w, h))
        elif zone == "top":
            # Top edge margin crop
            return img.crop((0, 0, w, int(h * top_pct)))
        elif zone == "bottom":
            # Bottom edge margin crop
            return img.crop((0, int(h * (1 - bottom_pct)), w, h))
        elif zone == "center":
            # Center rectangle detection zone bounds
            return img.crop((int(w * cx_min), int(h * cy_min), int(w * cx_max), int(h * cy_max)))
    def _get_mode_color(self, cropped, mode):
        """Helper to get a single color from cropped image according to sampling mode."""
        try:
            if mode == "vibrant":
                # Downsample to 8x8 to identify the most saturated and bright color
                img_tiny = cropped.resize((8, 8), Image.Resampling.BILINEAR)
                pixels = list(img_tiny.getdata())
                best_pixel = pixels[0]
                max_score = -1
                for r, g, b in pixels:
                    mx = max(r, g, b)
                    mn = min(r, g, b)
                    sat = mx - mn
                    val = mx
                    # Scoring heuristic: prioritizes saturation and brightness
                    score = sat * 0.7 + val * 0.3
                    if score > max_score:
                        max_score = score
                        best_pixel = (r, g, b)
                return best_pixel
            elif mode == "dominant":
                # Downsample to 8x8, then bin colors into quantized ranges
                img_tiny = cropped.resize((8, 8), Image.Resampling.BILINEAR)
                pixels = list(img_tiny.getdata())
                bins = {}
                for r, g, b in pixels:
                    # Group into bins of size 64 per channel
                    bin_key = (r // 64, g // 64, b // 64)
                    if bin_key not in bins:
                        bins[bin_key] = []
                    bins[bin_key].append((r, g, b))
                # Pick the most populated bin
                best_bin = max(bins.values(), key=len)
                # Return the average of the colors inside that bin
                r = int(sum(c[0] for c in best_bin) / len(best_bin))
                g = int(sum(c[1] for c in best_bin) / len(best_bin))
                b = int(sum(c[2] for c in best_bin) / len(best_bin))
                return (r, g, b)
            elif mode == "movie":
                # Movie friendly mode:
                # 1. First pixelate on screen colors (resize to 16x16)
                img_tiny = cropped.resize((16, 16), Image.Resampling.BILINEAR)
                pixels = list(img_tiny.getdata())
                
                # 2. Filter out letterbox black margins and gray/neutral pixels
                valid_pixels = []
                for r, g, b in pixels:
                    # Luminance calculation (0.299R + 0.587G + 0.114B)
                    lum = 0.299 * r + 0.587 * g + 0.114 * b
                    mx = max(r, g, b)
                    mn = min(r, g, b)
                    sat = mx - mn
                    
                    # Ignore very dark (luminance < 15) or low-saturation gray (saturation < 10)
                    if lum > 15 and sat > 10:
                        valid_pixels.append((r, g, b, lum, sat))
                
                # Fallback if no colorful/bright pixels exist (e.g. gray or dark scene)
                if not valid_pixels:
                    for r, g, b in pixels:
                        lum = 0.299 * r + 0.587 * g + 0.114 * b
                        if lum > 5:
                            valid_pixels.append((r, g, b, lum, 0))
                
                # Double fallback: use all pixels
                if not valid_pixels:
                    valid_pixels = [(r, g, b, 0.299*r + 0.587*g + 0.114*b, 0) for r, g, b in pixels]
                
                # 3. Take the dominant/more amount one from field
                bins = {}
                for r, g, b, lum, sat in valid_pixels:
                    # Group into bins of size 48 per channel
                    bin_key = (r // 48, g // 48, b // 48)
                    if bin_key not in bins:
                        bins[bin_key] = []
                    bins[bin_key].append((r, g, b, lum, sat))
                
                best_bin = max(bins.values(), key=len)
                
                # Average of the dominant color bin
                r_avg = sum(c[0] for c in best_bin) // len(best_bin)
                g_avg = sum(c[1] for c in best_bin) // len(best_bin)
                b_avg = sum(c[2] for c in best_bin) // len(best_bin)
                
                # 4. Max out the color for LEDs
                max_ch = max(r_avg, g_avg, b_avg)
                if max_ch > 0:
                    import colorsys
                    h, s, v = colorsys.rgb_to_hsv(r_avg / 255.0, g_avg / 255.0, b_avg / 255.0)
                    
                    # Boost saturation to enrich color vibrancy on LEDs
                    s = min(1.0, s ** 0.7)
                    
                    # Boost value for bright ambient feedback
                    v = min(1.0, v * 1.3)
                    
                    # Convert back
                    r_boost, g_boost, b_boost = colorsys.hsv_to_rgb(h, s, v)
                    r_avg, g_avg, b_avg = int(r_boost * 255), int(g_boost * 255), int(b_boost * 255)
                    
                    # Max out: boost the peak to a vibrant level
                    max_ch = max(r_avg, g_avg, b_avg)
                    if max_ch > 0:
                        boost_factor = max(1.2, 220.0 / max_ch)
                        # Don't blow up extremely dim scenes into full bright glow
                        original_max = max(1, max_ch)
                        if original_max < 30:
                            boost_factor = 2.0
                        
                        r_avg = min(255, int(r_avg * boost_factor))
                        g_avg = min(255, int(g_avg * boost_factor))
                        b_avg = min(255, int(b_avg * boost_factor))
                
                # Apply mild gamma correction (1.8) for LED color representation
                r_final = int(((r_avg / 255.0) ** 1.8) * 255)
                g_final = int(((g_avg / 255.0) ** 1.8) * 255)
                b_final = int(((b_avg / 255.0) ** 1.8) * 255)
                
                # Maintain output capability for colors supported by LEDs (avoiding complete zero flickering)
                # If there's color on screen, ensure a minimum PWM value of 10 so the LEDs stay lit smoothly
                if max(r_avg, g_avg, b_avg) > 10:
                    r_final = max(10, r_final)
                    g_final = max(10, g_final)
                    b_final = max(10, b_final)
                
                return (r_final, g_final, b_final)
            elif mode == "gaming":
                # High-responsiveness, fast-paced tactical gaming mode
                # 1. First pixelate on screen colors (resize to 8x8 for speed and contrast)
                img_tiny = cropped.resize((8, 8), Image.Resampling.BILINEAR)
                pixels = list(img_tiny.getdata())
                
                # 2. Prioritize high-saturation, high-brightness trigger pixels (muzzle flashes, spells, damage)
                best_pixel = pixels[0]
                max_score = -1
                for r, g, b in pixels:
                    mx = max(r, g, b)
                    mn = min(r, g, b)
                    sat = mx - mn
                    val = mx
                    # Gaming heuristic: prioritizes extreme contrast and saturation spikes
                    score = sat * 0.8 + val * 0.2
                    if score > max_score:
                        max_score = score
                        best_pixel = (r, g, b)
                
                # 3. Max out color output to 255 peak to deliver high-impact tactical glow
                r_game, g_game, b_game = best_pixel
                mx_game = max(r_game, g_game, b_game)
                if mx_game > 0:
                    factor = 255.0 / mx_game
                    r_game = min(255, int(r_game * factor))
                    g_game = min(255, int(g_game * factor))
                    b_game = min(255, int(b_game * factor))
                
                # Ensure a strong minimum ambient backlight during gaming
                if max(r_game, g_game, b_game) > 15:
                    r_game = max(15, r_game)
                    g_game = max(15, g_game)
                    b_game = max(15, b_game)
                
                return (r_game, g_game, b_game)
            elif mode == "chill":
                # Relaxing Warm Chill mode: filters cool light, biased toward sunset warmth (cozy ambers/golds)
                # 1. First pixelate to a soft 4x4 layout
                img_tiny = cropped.resize((4, 4), Image.Resampling.BILINEAR)
                pixels = list(img_tiny.getdata())
                
                # 2. Compute average color
                r_avg = sum(c[0] for c in pixels) // len(pixels)
                g_avg = sum(c[1] for c in pixels) // len(pixels)
                b_avg = sum(c[2] for c in pixels) // len(pixels)
                
                # 3. Apply color temperature shift in HSV space
                import colorsys
                h, s, v = colorsys.rgb_to_hsv(r_avg / 255.0, g_avg / 255.0, b_avg / 255.0)
                
                # If the color falls into cool colors (green/blue/purple: hue 0.25 to 0.82),
                # shift it to cozy sunset orange-amber (hue 0.08) and guarantee a soft saturation
                if 0.25 < h < 0.82:
                    h = 0.08
                    s = max(s, 0.45)
                
                # Re-synthesize RGB from cozy HSV
                r_c, g_c, b_c = colorsys.hsv_to_rgb(h, s, v)
                
                # 4. Filter blue light manually for night comfort, keep light warm and gentle
                r_final = int(r_c * 255)
                g_final = int(g_c * 210) # soft green
                b_final = int(b_c * 130) # heavily dampened blue
                
                # Clamp minimum to cozy low glow (8, 6, 4) rather than turning off
                return (max(8, r_final), max(6, g_final), max(4, b_final))
            elif mode == "scifi_neon":
                # Sci-Fi Neon (Cyberpunk) mode: snaps screen colors to electric neon accents
                # 1. First pixelate on screen colors (8x8)
                img_tiny = cropped.resize((8, 8), Image.Resampling.BILINEAR)
                pixels = list(img_tiny.getdata())
                
                # 2. Extract dominant color bin
                bins = {}
                for r, g, b in pixels:
                    bin_key = (r // 64, g // 64, b // 64)
                    if bin_key not in bins:
                        bins[bin_key] = []
                    bins[bin_key].append((r, g, b))
                
                best_bin = max(bins.values(), key=len)
                r_dom = sum(c[0] for c in best_bin) // len(best_bin)
                g_dom = sum(c[1] for c in best_bin) // len(best_bin)
                b_dom = sum(c[2] for c in best_bin) // len(best_bin)
                
                # 3. Check saturation and map to cyberpunk hues
                import colorsys
                h, s, v = colorsys.rgb_to_hsv(r_dom / 255.0, g_dom / 255.0, b_dom / 255.0)
                
                # Cyberpunk neon hues: Neon Orange (~0.06), Acid Green (~0.33), Electric Cyan (~0.5), Violet/Purple (~0.75), Hot Pink/Magenta (~0.9)
                neon_hues = [0.06, 0.33, 0.5, 0.75, 0.9]
                
                # Only shift if there is some color, otherwise keep neutral gray/white soft
                if s > 0.15:
                    # Find closest neon hue
                    h = min(neon_hues, key=lambda nh: min(abs(h - nh), abs(h + 1 - nh), abs(h - 1 - nh)))
                    s = 1.0  # Lock to maximum neon saturation
                    v = max(v, 0.6)  # Maintain high impact brightness
                
                r_n, g_n, b_n = colorsys.hsv_to_rgb(h, s, v)
                return (int(r_n * 255), int(g_n * 255), int(b_n * 255))
            elif mode in ["spotlight", "center"]:
                # Focus strictly on the inner 20% center area of the zone
                zw, zh = cropped.size
                sub_crop = cropped.crop((int(zw * 0.4), int(zh * 0.4), int(zw * 0.6), int(zw * 0.6)))
                img_tiny = sub_crop.resize((1, 1), Image.Resampling.BILINEAR)
                return img_tiny.getpixel((0, 0))
            else: # Default/fallback: "average"
                img_tiny = cropped.resize((1, 1), Image.Resampling.BILINEAR)
                return img_tiny.getpixel((0, 0))
        except Exception as e:
            logger.error(f"Error computing mode color ({mode}): {e}")
            # Fallback to simple average
            try:
                img_tiny = cropped.resize((1, 1), Image.Resampling.BILINEAR)
                return img_tiny.getpixel((0, 0))
            except:
                return (0, 0, 0)

    def _run(self):
        delay = 1.0 / self.fps
        brightness_history = []
        flash_frames_left = 0
        flash_color_tuple = tuple(self.flash_color)
        
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
                    
                    # Compute muzzle flash logic
                    if self.flash_enabled:
                        center_crop = self._get_zone_crop(img, "center")
                        img_center_tiny = center_crop.resize((1, 1), Image.Resampling.BILINEAR)
                        cr, cg, cb = img_center_tiny.getpixel((0, 0))
                        center_brightness = 0.299 * cr + 0.587 * cg + 0.114 * cb
                        
                        if len(brightness_history) >= 4:
                            avg_history = sum(brightness_history) / len(brightness_history)
                            if center_brightness - avg_history > self.flash_threshold and flash_frames_left == 0:
                                flash_frames_left = self.flash_duration
                                logger.info(f"Muzzle flash trigger detected! Delta: {center_brightness - avg_history:.1f}")
                        
                        brightness_history.append(center_brightness)
                        if len(brightness_history) > 8:
                            brightness_history.pop(0)
                    
                    # Stream state to active controllers
                    for dev_id in self.active_device_ids:
                        dev = self.device_manager.get(dev_id)
                        if not dev:
                            continue
                            
                        # If muzzle flash override is active, output flash color instantly
                        if flash_frames_left > 0:
                            if dev.type == "wled":
                                dev.stream_udp([flash_color_tuple] * dev.led_count)
                            elif dev.type in ["wiz", "openrgb", "wdl"]:
                                dev.stream_color(flash_color_tuple[0], flash_color_tuple[1], flash_color_tuple[2])
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
                                
                                if self.mode in ["average", "vibrant", "dominant", "spotlight", "movie", "gaming", "chill", "scifi_neon"]:
                                    r, g, b = self._get_mode_color(cropped, self.mode)
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
                                if self.mode in ["average", "vibrant", "dominant", "spotlight", "movie", "gaming", "chill", "scifi_neon"]:
                                    # Stream average/mode color of the zone
                                    r, g, b = self._get_mode_color(cropped, self.mode)
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
                                # Bulbs and PC components represent single zones, compute according to mode
                                r, g, b = self._get_mode_color(cropped, self.mode)
                                dev.stream_color(r, g, b)
                    
                    if flash_frames_left > 0:
                        flash_frames_left -= 1
                            
                except Exception as e:
                    logger.error(f"Error in screen sync capture loop: {e}")
                    
                elapsed = time.perf_counter() - start_time
                self.frame_count += 1
                if elapsed > 0:
                    self.actual_fps = round(min(1.0 / elapsed, float(self.fps)), 1)
                sleep_time = delay - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
