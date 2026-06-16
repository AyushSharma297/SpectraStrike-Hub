import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Music, Play, Square, Radio, BarChart3, Palette, Zap, Volume2, Waves } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const MODES = [
  { id: 'beat_pulse',       label: 'Beat Pulse',       icon: '💥', desc: 'Flashes your chosen color on bass kicks. Best for EDM & hip-hop.' },
  { id: 'sound_bar',        label: 'Sound Bar',        icon: '📊', desc: '8-band spectrum analyzer — each band lights up like a graphic equalizer.' },
  { id: 'spectrum_divider',  label: 'Spectrum Split',   icon: '🌈', desc: 'Splits your strip into Bass / Mid / Treble sections with palette colors.' },
  { id: 'energy_vu',        label: 'VU Meter',         icon: '📈', desc: 'Classic volume meter that fills LEDs left-to-right with palette gradient.' },
  { id: 'color_organ',      label: 'Color Organ',      icon: '🎨', desc: 'Hue shifts smoothly with the dominant pitch of the music.' },
  { id: 'bass_strobe',      label: 'Bass Strobe',      icon: '⚡', desc: 'Hard strobe flash on heavy bass drops — dim glow between hits.' },
  { id: 'single_pulse',     label: 'Single Pulse',     icon: '🫀', desc: 'A single color breathes and pulses with the overall energy.' },
  { id: 'spectrum_wave',    label: 'Spectrum Wave',     icon: '🌊', desc: 'Rainbow wave scrolls across LEDs — speed follows the beat.' },
];

const DEFAULT_PALETTE = [
  [0, 173, 181],    // Cyan
  [129, 140, 248],  // Purple
  [253, 164, 175],  // Rose
  [251, 191, 36],   // Amber
  [52, 211, 153],   // Emerald
  [239, 68, 68],    // Red
  [99, 102, 241],   // Indigo
  [236, 72, 153],   // Pink
];

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

// ── Live Spectrum Visualizer Bar ──
function SpectrumVisualizer({ active }) {
  const canvasRef = useRef(null);
  const levelsRef = useRef({ bands: [0, 0, 0, 0, 0, 0, 0, 0], bass: 0, mid: 0, treble: 0, is_beat: false, overall: 0 });
  const animFrameRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    // Poll live levels from backend at ~30fps
    intervalRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/sync/music/levels');
        if (res.ok) {
          levelsRef.current = await res.json();
        }
      } catch (e) { /* ignore */ }
    }, 33);

    // Canvas rendering loop
    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const levels = levelsRef.current;
      const bands = levels.bands || [];
      const barCount = bands.length || 8;
      const gap = 3;
      const barW = (W - gap * (barCount + 1)) / barCount;

      // Gradient colors for bars (spectrum)
      const barColors = [
        '#00ADB5', '#06d6a0', '#818cf8', '#a78bfa',
        '#fda4af', '#fb923c', '#f43f5e', '#ec4899'
      ];

      for (let i = 0; i < barCount; i++) {
        const level = Math.min(1, (bands[i] || 0));
        const barH = Math.max(2, level * (H - 4));
        const x = gap + i * (barW + gap);
        const y = H - barH;

        // Create gradient for each bar
        const grad = ctx.createLinearGradient(x, H, x, y);
        grad.addColorStop(0, barColors[i % barColors.length] + '33');
        grad.addColorStop(1, barColors[i % barColors.length]);
        ctx.fillStyle = grad;

        // Rounded bar
        const radius = Math.min(barW / 2, 4);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barW - radius, y);
        ctx.quadraticCurveTo(x + barW, y, x + barW, y + radius);
        ctx.lineTo(x + barW, H);
        ctx.lineTo(x, H);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();

        // Glow effect on top
        if (level > 0.5) {
          ctx.shadowColor = barColors[i % barColors.length];
          ctx.shadowBlur = 8;
          ctx.fillRect(x, y, barW, 2);
          ctx.shadowBlur = 0;
        }
      }

      // Beat flash overlay
      if (levels.is_beat) {
        ctx.fillStyle = 'rgba(0, 173, 181, 0.08)';
        ctx.fillRect(0, 0, W, H);
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [active]);

  return (
    <div className="spectrum-visualizer-container">
      <canvas
        ref={canvasRef}
        width={320}
        height={80}
        style={{
          width: '100%',
          height: '80px',
          borderRadius: '10px',
          background: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
        }}
      />
      {!active && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontSize: '0.75rem', color: 'var(--text-muted)',
          background: 'rgba(34, 40, 49, 0.8)', borderRadius: '10px'
        }}>
          <Volume2 size={14} style={{ marginRight: '0.4rem' }} /> Start sync to see live spectrum
        </div>
      )}
    </div>
  );
}

// ── Color Palette Editor ──
function PaletteEditor({ palette, onChange }) {
  const handleColorChange = (index, hex) => {
    const next = [...palette];
    next[index] = hexToRgb(hex);
    onChange(next);
  };

  const addColor = () => {
    if (palette.length < 12) {
      onChange([...palette, [255, 255, 255]]);
    }
  };

  const removeColor = (index) => {
    if (palette.length > 2) {
      onChange(palette.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="palette-editor">
      <div className="palette-swatches">
        {palette.map((col, i) => (
          <div key={i} className="palette-swatch-wrapper">
            <input
              type="color"
              value={rgbToHex(col[0], col[1], col[2])}
              onChange={(e) => handleColorChange(i, e.target.value)}
              className="palette-swatch-input"
              style={{ background: rgbToHex(col[0], col[1], col[2]) }}
            />
            {palette.length > 2 && (
              <button
                className="palette-swatch-remove"
                onClick={() => removeColor(i)}
                title="Remove color"
              >×</button>
            )}
          </div>
        ))}
        {palette.length < 12 && (
          <button className="palette-add-btn" onClick={addColor} title="Add color">
            +
          </button>
        )}
      </div>
      <div className="palette-gradient-preview" style={{
        background: `linear-gradient(90deg, ${palette.map((c, i) =>
          `rgb(${c[0]},${c[1]},${c[2]}) ${Math.round(i / (palette.length - 1) * 100)}%`
        ).join(', ')})`
      }} />
    </div>
  );
}


// ── Main Panel ──
export default function MusicSyncPanel({ devices }) {
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState('beat_pulse');
  const [sensitivity, setSensitivity] = useState(1.0);
  const [baseColor, setBaseColor] = useState('#a855f7');
  const [colorPalette, setColorPalette] = useState(DEFAULT_PALETTE);
  const [selectedDevices, setSelectedDevices] = useState([]);
  const [audioDevices, setAudioDevices] = useState([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [showPalette, setShowPalette] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchAudioDevices();
  }, []);

  const fetchAudioDevices = async () => {
    try {
      const res = await fetch('/api/sync/music/devices');
      if (res.ok) setAudioDevices(await res.json() || []);
    } catch (err) { console.error("Failed to fetch audio devices", err); }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/sync/music/status');
      if (res.ok) {
        const data = await res.json();
        setActive(data.active);
        if (data.mode) setMode(data.mode);
        if (data.sensitivity) setSensitivity(data.sensitivity);
        if (data.device_ids) setSelectedDevices(data.device_ids);
        if (data.audio_device_id) setSelectedAudioDevice(data.audio_device_id);
        if (data.color_palette) setColorPalette(data.color_palette);
        if (data.base_color) {
          setBaseColor(rgbToHex(data.base_color[0], data.base_color[1], data.base_color[2]));
        }
      }
    } catch (err) { console.error(err); }
  };

  const toggleSync = async () => {
    if (!active && selectedDevices.length === 0) {
      alert("Select at least one device to sync");
      return;
    }

    const [r, g, b] = hexToRgb(baseColor);

    const payload = {
      active: !active,
      device_ids: selectedDevices,
      mode,
      sensitivity,
      base_color: [r, g, b],
      audio_device_id: selectedAudioDevice || null,
      color_palette: colorPalette,
    };

    try {
      const res = await fetch('/api/sync/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setActive(data.active);
      }
    } catch (err) { console.error("Failed to toggle music sync", err); }
  };

  const toggleDevice = (id) => {
    setSelectedDevices(prev =>
      prev.includes(id) ? prev.filter(d => d !== id) : [...prev, id]
    );
  };

  const currentMode = MODES.find(m => m.id === mode) || MODES[0];
  const usesBaseColor = ['beat_pulse', 'bass_strobe', 'single_pulse'].includes(mode);
  const usesPalette = ['spectrum_divider', 'energy_vu', 'sound_bar'].includes(mode);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
        <div className="music-icon-pulse" style={{
          width: '3rem', height: '3rem', borderRadius: '12px',
          background: active ? 'linear-gradient(135deg, #00ADB5, #818cf8)' : 'linear-gradient(135deg, var(--bg-input), var(--bg-input))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.4s ease',
        }}>
          <Music size={24} color="white" />
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Music Sync Engine</h2>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            {active ? '🟢 Capturing system audio...' : 'FFT audio analysis via Windows Loopback'}
          </p>
        </div>
        {active && (
          <div className="status-badge active" style={{ fontSize: '0.7rem' }}>
            <Waves size={12} /> LIVE
          </div>
        )}
      </div>

      {/* Live Spectrum Visualizer */}
      <SpectrumVisualizer active={active} />

      <div className="responsive-grid-equal" style={{ gap: '1.5rem' }}>

        {/* Left Column: Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Mode Selector */}
          <div className="control-row">
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <BarChart3 size={14} /> Effect Mode
            </label>
            <div className="music-mode-grid">
              {MODES.map(m => (
                <button
                  key={m.id}
                  className={`music-mode-btn ${mode === m.id ? 'active' : ''}`}
                  onClick={() => setMode(m.id)}
                  title={m.desc}
                >
                  <span className="music-mode-icon">{m.icon}</span>
                  <span className="music-mode-label">{m.label}</span>
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.5 }}>
              {currentMode.desc}
            </p>
          </div>

          {/* Audio Driver */}
          <div className="control-row">
            <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Volume2 size={14} /> Audio Source
            </label>
            <select
              value={selectedAudioDevice}
              onChange={e => setSelectedAudioDevice(e.target.value)}
              className="select-dropdown"
              style={{ padding: '0.65rem', width: '100%' }}
            >
              <option value="">Default Speaker (Auto-Detect)</option>
              {audioDevices.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} {d.is_default ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Sensitivity Slider */}
          <div className="control-row">
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={14} /> Sensitivity
              </span>
              <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold', fontFamily: 'monospace' }}>{sensitivity.toFixed(1)}x</span>
            </div>
            <input
              type="range" min="0.1" max="3.0" step="0.1"
              value={sensitivity} onChange={e => setSensitivity(parseFloat(e.target.value))}
              style={{ width: '100%', marginTop: '0.5rem', accentColor: 'var(--accent-cyan)' }}
            />
          </div>

          {/* Base Color (for single-color modes) */}
          {usesBaseColor && (
            <div className="control-row">
              <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Base Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.4rem' }}>
                <input
                  type="color"
                  value={baseColor}
                  onChange={e => setBaseColor(e.target.value)}
                  style={{ width: '40px', height: '40px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: 'transparent' }}
                />
                <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{baseColor.toUpperCase()}</span>
              </div>
            </div>
          )}

          {/* Color Palette (for multi-color modes) */}
          {usesPalette && (
            <div className="control-row">
              <button
                className={`btn ${showPalette ? 'btn-palette-active' : ''}`}
                onClick={() => setShowPalette(!showPalette)}
                style={{ fontSize: '0.8rem', gap: '0.5rem', padding: '0.65rem 1rem' }}
              >
                <Palette size={16} />
                {showPalette ? 'Hide Palette Editor' : 'Customize Colors'}
              </button>
              <AnimatePresence>
                {showPalette && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden', marginTop: '0.5rem' }}
                  >
                    <PaletteEditor palette={colorPalette} onChange={setColorPalette} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Start / Stop Button */}
          <button
            onClick={toggleSync}
            className={`btn ${active ? 'btn-rose' : 'btn-primary'}`}
            style={{ padding: '1rem', marginTop: '0.5rem', fontSize: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
          >
            {active ? <Square size={18} /> : <Play size={18} />}
            {active ? 'Stop Music Sync' : 'Start Music Sync'}
          </button>
        </div>

        {/* Right Column: Target Devices */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.2)', borderRadius: '16px', padding: '1.25rem',
          border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column'
        }}>
          <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <Radio size={16} /> Target Devices
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '420px', overflowY: 'auto', flex: 1 }}>
            {devices.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>No devices found — run a scan first</p>
            ) : (
              devices.map(dev => (
                <div
                  key={dev.id}
                  onClick={() => toggleDevice(dev.id)}
                  className={`music-device-row ${selectedDevices.includes(dev.id) ? 'selected' : ''}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: selectedDevices.includes(dev.id) ? '#00ADB5' : '#64748b',
                      boxShadow: selectedDevices.includes(dev.id) ? '0 0 8px rgba(0, 173, 181, 0.5)' : 'none',
                      transition: 'all 0.2s ease',
                    }} />
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{dev.name || dev.ip}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', display: 'block' }}>{dev.ip}</span>
                    </div>
                  </div>
                  <span className="tag-active-info">{dev.type}</span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
}
