import threading
import time
import logging
import colorsys
import numpy as np
import traceback
import warnings

# Suppress soundcard's data discontinuity warning which spams the console
warnings.filterwarnings("ignore", message="data discontinuity in recording")

logger = logging.getLogger("music_sync")


class MusicSyncWorker:
    """
    Real-time music-reactive LED engine.
    
    Captures system audio via loopback, performs FFT analysis,
    and streams color data to WLED/WiZ devices at ~40fps.
    
    Modes:
      - beat_pulse:       Flash base color on bass kicks
      - spectrum_divider: Split strip into Bass(R)/Mid(G)/Treble(B) sections
      - energy_vu:        Classic VU meter fill from left to right
      - color_organ:      Hue shifts with dominant frequency
      - sound_bar:        Spectrum analyzer bar graph (8-band)
      - bass_strobe:      Hard white strobe on heavy bass
      - single_pulse:     Single color breathes with overall energy
      - spectrum_wave:    Rainbow wave whose speed follows the beat
    """

    def __init__(self, device_resolver):
        self.device_resolver = device_resolver
        self.running = False
        self.thread = None

        self.active_device_ids = []
        self.mode = "beat_pulse"
        self.sensitivity = 1.0
        self.base_color = [168, 85, 247]  # Purple default

        # Custom color palette for multi-color modes
        # Default: Cyan -> Purple -> Rose -> Orange -> Green
        self.color_palette = [
            [0, 173, 181],    # Cyan
            [129, 140, 248],  # Purple
            [253, 164, 175],  # Rose
            [251, 191, 36],   # Amber
            [52, 211, 153],   # Emerald
            [239, 68, 68],    # Red
            [99, 102, 241],   # Indigo
            [236, 72, 153],   # Pink
        ]

        self.sample_rate = 44100
        self.chunk_size = 1024  # ~23ms latency

        # ── Audio analysis state ──
        # 3-band envelopes
        self.bass_envelope = 0.0
        self.mid_envelope = 0.0
        self.treble_envelope = 0.0

        # 8-band spectrum for sound_bar mode
        self.band_levels = [0.0] * 8
        self.band_peaks = [0.1] * 8

        # Peak amplitudes for Automatic Gain Control (AGC)
        self.bass_peak = 0.05
        self.mid_peak = 0.05
        self.treble_peak = 0.05
        self.peak_decay = 0.997  # Slow decay to keep AGC stable

        # Beat detection
        self.last_beat_time = 0
        self.beat_threshold = 1.3
        self.beat_cooldown = 0.06  # 60ms minimum between beats
        self.is_beat = False
        self.beat_intensity = 0.0  # 0-1 strength of last beat

        # Color organ hue tracking
        self.current_hue = 0.0

        # Spectrum wave phase
        self.wave_phase = 0.0

        # Audio device selection
        self.audio_device_id = None

        # Live levels for frontend visualization (thread-safe read)
        self._live_levels = {
            "bass": 0.0, "mid": 0.0, "treble": 0.0,
            "is_beat": False, "overall": 0.0,
            "bands": [0.0] * 8,
        }

    def start(self, device_ids, mode="beat_pulse", sensitivity=1.0,
              base_color=None, audio_device_id=None, color_palette=None):
        self.active_device_ids = device_ids
        self.mode = mode
        self.sensitivity = sensitivity
        self.audio_device_id = audio_device_id
        if base_color:
            self.base_color = base_color
        if color_palette and len(color_palette) >= 2:
            self.color_palette = color_palette

        if not self.running:
            self.running = True
            self.thread = threading.Thread(target=self._sync_loop, daemon=True)
            self.thread.start()
            logger.info(
                f"Music Sync started: mode={mode}, sensitivity={sensitivity}, "
                f"devices={len(device_ids)}, audio={audio_device_id or 'Auto'}"
            )

    def stop(self):
        if self.running:
            self.running = False
            if self.thread:
                self.thread.join(timeout=2.0)
            logger.info("Music Sync stopped")

    def get_live_levels(self):
        """Thread-safe snapshot of current audio levels for the frontend visualizer."""
        return dict(self._live_levels)

    # ──────────────────────────────────────────────────────────
    # Core audio capture loop
    # ──────────────────────────────────────────────────────────

    def _sync_loop(self):
        import soundcard as sc

        # Reset AGC peaks
        self.bass_peak = 0.05
        self.mid_peak = 0.05
        self.treble_peak = 0.05
        self.band_peaks = [0.05] * 8

        while self.running:
            try:
                # 1. Resolve playback speaker
                target_id = self.audio_device_id
                if not target_id:
                    try:
                        speaker = sc.default_speaker()
                        target_id = speaker.id
                    except Exception as e:
                        logger.error(f"Failed to resolve default speaker: {e}")
                        time.sleep(1.0)
                        continue

                # 2. Open Loopback Microphone
                mic = sc.get_microphone(id=target_id, include_loopback=True)
                logger.info(f"Loopback started on: {mic.name}")

                # 3. Stream recording
                with mic.recorder(samplerate=self.sample_rate, channels=1,
                                  blocksize=self.chunk_size) as recorder:
                    loop_count = 0
                    while self.running:
                        data = recorder.record(numframes=self.chunk_size)
                        self._process_audio_chunk(data[:, 0])
                        self._update_devices()

                        # Minimal sleep to prevent CPU spin
                        time.sleep(0.003)

                        # Poll for audio device changes every ~2 seconds
                        loop_count += 1
                        if loop_count % 80 == 0 and not self.audio_device_id:
                            try:
                                current_default = sc.default_speaker()
                                if current_default.id != mic.id:
                                    logger.info(
                                        f"Default speaker changed to '{current_default.name}'. Reconnecting..."
                                    )
                                    break
                            except Exception:
                                pass

            except Exception as e:
                logger.error(f"Music sync error (retrying in 1s): {e}")
                time.sleep(1.0)

    # ──────────────────────────────────────────────────────────
    # FFT Analysis
    # ──────────────────────────────────────────────────────────

    def _process_audio_chunk(self, data):
        if len(data) == 0 or np.all(data == 0):
            # Decay envelopes toward zero on silence
            self.bass_envelope *= 0.85
            self.mid_envelope *= 0.85
            self.treble_envelope *= 0.85
            self.band_levels = [l * 0.85 for l in self.band_levels]
            self.is_beat = False
            self._publish_levels()
            return

        # ── Windowed FFT ──
        windowed = data * np.hanning(len(data))
        fft_result = np.abs(np.fft.rfft(windowed))
        freqs = np.fft.rfftfreq(len(data), 1.0 / self.sample_rate)

        # ── 3-band analysis ──
        bass_idx = np.where((freqs >= 20) & (freqs <= 250))[0]
        mid_idx = np.where((freqs > 250) & (freqs <= 2000))[0]
        treble_idx = np.where((freqs > 2000) & (freqs <= 16000))[0]

        bass_energy = np.mean(fft_result[bass_idx]) if len(bass_idx) > 0 else 0
        mid_energy = np.mean(fft_result[mid_idx]) if len(mid_idx) > 0 else 0
        treble_energy = np.mean(fft_result[treble_idx]) if len(treble_idx) > 0 else 0

        # AGC peak tracking (slow decay)
        self.bass_peak = max(0.005, self.bass_peak * self.peak_decay, bass_energy)
        self.mid_peak = max(0.005, self.mid_peak * self.peak_decay, mid_energy)
        self.treble_peak = max(0.005, self.treble_peak * self.peak_decay, treble_energy)

        # Normalize to [0, 1]
        bass_norm = min(1.0, bass_energy / self.bass_peak)
        mid_norm = min(1.0, mid_energy / self.mid_peak)
        treble_norm = min(1.0, treble_energy / self.treble_peak)

        # ── Fast-attack / medium-decay envelope ──
        # This makes the lights respond INSTANTLY to transients
        # but smoothly fade out, which is the "sound bar" feel
        attack = 0.65   # Jump fast to new highs
        decay = 0.60    # Fade moderately fast

        self.bass_envelope = max(bass_norm * attack + self.bass_envelope * (1 - attack),
                                 self.bass_envelope * decay)
        self.mid_envelope = max(mid_norm * attack + self.mid_envelope * (1 - attack),
                                self.mid_envelope * decay)
        self.treble_envelope = max(treble_norm * attack + self.treble_envelope * (1 - attack),
                                   self.treble_envelope * decay)

        # Clamp
        self.bass_envelope = min(1.0, self.bass_envelope)
        self.mid_envelope = min(1.0, self.mid_envelope)
        self.treble_envelope = min(1.0, self.treble_envelope)

        # ── 8-band spectrum analysis for sound_bar mode ──
        band_edges = [20, 60, 160, 400, 1000, 2500, 6300, 12000, 20000]
        for i in range(8):
            lo, hi = band_edges[i], band_edges[i + 1]
            band_idx = np.where((freqs >= lo) & (freqs < hi))[0]
            if len(band_idx) > 0:
                energy = np.mean(fft_result[band_idx])
                self.band_peaks[i] = max(0.005, self.band_peaks[i] * self.peak_decay, energy)
                norm = min(1.0, energy / self.band_peaks[i])
                # Same fast-attack/decay for bands
                self.band_levels[i] = max(
                    norm * attack + self.band_levels[i] * (1 - attack),
                    self.band_levels[i] * decay
                )
                self.band_levels[i] = min(1.0, self.band_levels[i])

        # ── Beat detection ──
        now = time.time()
        if bass_norm > self.beat_threshold and (now - self.last_beat_time) > self.beat_cooldown:
            self.last_beat_time = now
            self.is_beat = True
            self.beat_intensity = min(1.0, bass_norm)
        else:
            self.is_beat = False

        # ── Dominant frequency for color organ ──
        if np.max(fft_result) > 0.01:
            dom_idx = np.argmax(fft_result)
            dom_freq = freqs[dom_idx]
            freq_log = np.log10(max(20, min(12000, dom_freq)))
            min_log = np.log10(20)
            max_log = np.log10(12000)
            target_hue = (freq_log - min_log) / (max_log - min_log)
            self.current_hue = self.current_hue * 0.85 + target_hue * 0.15

        # ── Wave phase accumulator ──
        overall = (self.bass_envelope + self.mid_envelope + self.treble_envelope) / 3.0
        self.wave_phase += 0.02 + overall * 0.08  # Faster when louder
        if self.wave_phase > 1.0:
            self.wave_phase -= 1.0

        # ── Publish for frontend ──
        self._publish_levels()

    def _publish_levels(self):
        overall = (self.bass_envelope + self.mid_envelope + self.treble_envelope) / 3.0
        self._live_levels = {
            "bass": round(self.bass_envelope, 3),
            "mid": round(self.mid_envelope, 3),
            "treble": round(self.treble_envelope, 3),
            "is_beat": self.is_beat,
            "overall": round(overall, 3),
            "bands": [round(b, 3) for b in self.band_levels],
        }

    # ──────────────────────────────────────────────────────────
    # Device output dispatch
    # ──────────────────────────────────────────────────────────

    def _lerp_color(self, c1, c2, t):
        """Linear interpolate between two RGB colors."""
        t = max(0.0, min(1.0, t))
        return [
            int(c1[0] + (c2[0] - c1[0]) * t),
            int(c1[1] + (c2[1] - c1[1]) * t),
            int(c1[2] + (c2[2] - c1[2]) * t),
        ]

    def _palette_color(self, t):
        """Sample a color from the palette at position t (0.0–1.0)."""
        palette = self.color_palette
        n = len(palette)
        if n == 0:
            return self.base_color
        if n == 1:
            return list(palette[0])
        t = max(0.0, min(1.0, t))
        idx_f = t * (n - 1)
        lo = int(idx_f)
        hi = min(lo + 1, n - 1)
        frac = idx_f - lo
        return self._lerp_color(palette[lo], palette[hi], frac)

    def _send_to_device(self, client, r, g, b, colors=None):
        """Send color(s) to a device using the best available method."""
        try:
            if colors and hasattr(client, "stream_udp"):
                client.stream_udp(colors)
            elif hasattr(client, "stream_color"):
                client.stream_color(r, g, b)
            elif hasattr(client, "stream_udp"):
                led_count = getattr(client, "led_count", 30)
                client.stream_udp([[r, g, b]] * led_count)
        except Exception as e:
            logger.debug(f"Device send error: {e}")

    def _update_devices(self):
        sens = self.sensitivity

        for dev_id in self.active_device_ids:
            client = self.device_resolver.get(dev_id)
            if not client:
                continue

            try:
                led_count = getattr(client, "led_count", 30)

                # ─── Mode 1: Beat Pulse ───
                if self.mode == "beat_pulse":
                    bri = min(255, int(self.bass_envelope * sens * 255))
                    if self.is_beat:
                        bri = 255
                    r = int(self.base_color[0] * bri / 255)
                    g = int(self.base_color[1] * bri / 255)
                    b = int(self.base_color[2] * bri / 255)
                    self._send_to_device(client, r, g, b)

                # ─── Mode 2: Spectrum Divider ───
                elif self.mode == "spectrum_divider":
                    # Use palette colors for the 3 bands instead of hardcoded R/G/B
                    bass_col = self.color_palette[0] if len(self.color_palette) > 0 else [255, 0, 0]
                    mid_col = self.color_palette[1] if len(self.color_palette) > 1 else [0, 255, 0]
                    treb_col = self.color_palette[2] if len(self.color_palette) > 2 else [0, 0, 255]

                    b_val = min(1.0, self.bass_envelope * sens)
                    m_val = min(1.0, self.mid_envelope * sens)
                    t_val = min(1.0, self.treble_envelope * sens)

                    third = led_count // 3
                    colors = []
                    for i in range(led_count):
                        if i < third:
                            colors.append([int(bass_col[j] * b_val) for j in range(3)])
                        elif i < third * 2:
                            colors.append([int(mid_col[j] * m_val) for j in range(3)])
                        else:
                            colors.append([int(treb_col[j] * t_val) for j in range(3)])

                    mix_r = int((bass_col[0] * b_val + mid_col[0] * m_val + treb_col[0] * t_val) / 3)
                    mix_g = int((bass_col[1] * b_val + mid_col[1] * m_val + treb_col[1] * t_val) / 3)
                    mix_b = int((bass_col[2] * b_val + mid_col[2] * m_val + treb_col[2] * t_val) / 3)
                    self._send_to_device(client, mix_r, mix_g, mix_b, colors)

                # ─── Mode 3: Energy VU Meter ───
                elif self.mode == "energy_vu":
                    total = (self.bass_envelope + self.mid_envelope + self.treble_envelope) / 3.0
                    fill = int(min(1.0, total * sens) * led_count)
                    colors = []
                    for i in range(led_count):
                        if i < fill:
                            t = i / max(1, led_count - 1)
                            colors.append(self._palette_color(t))
                        else:
                            colors.append([0, 0, 0])

                    # Single-color fallback: use palette color at fill ratio
                    fill_ratio = fill / max(1, led_count)
                    fc = self._palette_color(fill_ratio)
                    self._send_to_device(client, fc[0], fc[1], fc[2], colors)

                # ─── Mode 4: Color Organ ───
                elif self.mode == "color_organ":
                    total = (self.bass_envelope + self.mid_envelope + self.treble_envelope) / 3.0
                    bri = min(1.0, total * sens)
                    rgb = colorsys.hsv_to_rgb(self.current_hue, 1.0, bri)
                    r, g, b = int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255)
                    self._send_to_device(client, r, g, b)

                # ─── Mode 5: Sound Bar (8-band spectrum analyzer) ───
                elif self.mode == "sound_bar":
                    leds_per_band = max(1, led_count // 8)
                    colors = []
                    for band_i in range(8):
                        level = min(1.0, self.band_levels[band_i] * sens)
                        band_color = self._palette_color(band_i / 7.0)
                        fill_leds = int(level * leds_per_band)

                        for led_j in range(leds_per_band):
                            if led_j < fill_leds:
                                # Brighter toward top
                                bri = 0.5 + 0.5 * (led_j / max(1, leds_per_band - 1))
                                colors.append([int(band_color[k] * bri) for k in range(3)])
                            else:
                                # Dim background glow
                                colors.append([int(band_color[k] * 0.03) for k in range(3)])

                    # Pad or trim to exact led_count
                    while len(colors) < led_count:
                        colors.append([0, 0, 0])
                    colors = colors[:led_count]

                    # Single-color mix for bulbs
                    avg_level = sum(self.band_levels) / 8.0
                    fc = self._palette_color(avg_level)
                    bri_s = min(1.0, avg_level * sens)
                    self._send_to_device(
                        client,
                        int(fc[0] * bri_s), int(fc[1] * bri_s), int(fc[2] * bri_s),
                        colors
                    )

                # ─── Mode 6: Bass Strobe ───
                elif self.mode == "bass_strobe":
                    if self.is_beat and self.beat_intensity > 0.5:
                        # Hard flash in base_color
                        r, g, b = self.base_color
                        self._send_to_device(client, r, g, b)
                    else:
                        # Dim glow at ~5% brightness
                        dim = max(0, int(self.bass_envelope * 15 * sens))
                        r = int(self.base_color[0] * dim / 255)
                        g = int(self.base_color[1] * dim / 255)
                        b = int(self.base_color[2] * dim / 255)
                        self._send_to_device(client, r, g, b)

                # ─── Mode 7: Single Pulse (breathe with energy) ───
                elif self.mode == "single_pulse":
                    total = (self.bass_envelope + self.mid_envelope + self.treble_envelope) / 3.0
                    bri = min(1.0, total * sens)
                    # Smooth sine-like breathing curve for a premium feel
                    bri = bri ** 0.7  # Gamma lift for more visible low-level changes
                    r = int(self.base_color[0] * bri)
                    g = int(self.base_color[1] * bri)
                    b = int(self.base_color[2] * bri)
                    self._send_to_device(client, r, g, b)

                # ─── Mode 8: Spectrum Wave (rainbow scrolls with beat) ───
                elif self.mode == "spectrum_wave":
                    colors = []
                    for i in range(led_count):
                        t = (i / max(1, led_count - 1) + self.wave_phase) % 1.0
                        total = (self.bass_envelope + self.mid_envelope + self.treble_envelope) / 3.0
                        bri = min(1.0, 0.15 + total * sens * 0.85)
                        rgb = colorsys.hsv_to_rgb(t, 1.0, bri)
                        colors.append([int(rgb[0] * 255), int(rgb[1] * 255), int(rgb[2] * 255)])

                    mid_led = colors[led_count // 2] if led_count > 0 else [0, 0, 0]
                    self._send_to_device(client, mid_led[0], mid_led[1], mid_led[2], colors)

            except Exception as e:
                logger.debug(f"Device update failed for {dev_id}: {e}")
