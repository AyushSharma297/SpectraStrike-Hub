import React from 'react';
import { 
  Power, 
  Sliders, 
  Wand2, 
  ChevronDown, 
  Sun, 
  Activity
} from 'lucide-react';

export default function ControlPanel({ 
  selectedDev, 
  activeTab, 
  setActiveTab, 
  controlDeviceState, 
  selectedDeviceId,
  bri, 
  color, 
  fx, 
  temp, 
  PRESET_EFFECTS,
  calRedSeen, calGreenSeen, calBlueSeen,
  calGamma, setCalGamma,
  calMinR, setCalMinR, calMinG, setCalMinG, calMinB, setCalMinB,
  calMaxR, setCalMaxR, calMaxG, setCalMaxG, calMaxB, setCalMaxB,
  calTemp, setCalTemp,
  showAdvancedSettings, setShowAdvancedSettings,
  saveDeviceCalibration,
  resetDeviceCalibration,
  ledColors,
  paintColor,
  setPaintColor,
  handlePaintPixel,
  handlePixelMouseEnter,
  fillAllPixels,
  clearAllPixels,
  isDrawing,
  setIsDrawing,
}) {
  const [calStep, setCalStep] = React.useState(0);

  if (!selectedDev) {
    return (
      <div className="customizer-empty-panel">
        <Sliders style={{ width: '3rem', height: '3rem', color: '#475569', marginBottom: '1rem' }} />
        <h3>No Device Selected</h3>
        <p>Select a controller from the sidebar to adjust its lighting and effects.</p>
      </div>
    );
  }

  const rgbToHexLocal = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  return (
    <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* HEADER */}
      <div className="customizer-header" style={{ flexShrink: 0 }}>
        <div className="customizer-title-area">
          <h2 style={{ fontFamily: 'var(--font-family-header)', fontSize: '1.25rem', fontWeight: '800' }}>
            {selectedDev.name || `Device ${selectedDev.id}`}
          </h2>
          <p>{selectedDev.type === 'wled' ? 'WLED Advanced Controller' : 'WiZ Smart Lighting'}</p>
        </div>
        <div className="customizer-toggle-controls">
          <div className="toggle-switch-tab-bar">
            <button 
              className={`toggle-tab-btn ${activeTab === 'control' ? 'active' : ''}`}
              onClick={() => setActiveTab('control')}
            >
              Control
            </button>
            {selectedDev.type === 'wled' && (
              <button 
                className={`toggle-tab-btn ${activeTab === 'paint' ? 'active' : ''}`}
                onClick={() => setActiveTab('paint')}
              >
                Paint
              </button>
            )}
          </div>
          <button 
            className={`power-toggle-btn ${selectedDev.state?.on ? 'active' : ''}`}
            onClick={() => controlDeviceState(selectedDev.id, { on: !selectedDev.state?.on })}
          >
            <Power style={{ width: '1.1rem', height: '1.1rem' }} />
          </button>
        </div>
      </div>

      {/* BODY */}
      <div className="customizer-body" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
        {activeTab === 'control' ? (
          <div className="control-tabs-content" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* BASIC LIGHTING CONTROLS */}
            <div className="control-section">
              <div className="control-row">
                <div className="control-label-wrapper">
                  <label>Brightness</label>
                  <span className="control-value-text">{Math.round(((selectedDev.state?.bri || 0) / 255) * 100)}%</span>
                </div>
                <div className="slider-input-wrapper">
                  <Sun style={{ width: '1.1rem', height: '1.1rem', color: '#eab308' }} />
                  <input 
                    type="range" 
                    min="0" max="255" 
                    value={selectedDev.state?.bri || 0} 
                    onChange={(e) => {
                      controlDeviceState(selectedDev.id, { bri: parseInt(e.target.value) });
                    }} 
                    className="slider-range-bar" 
                  />
                </div>
              </div>

              <div className="control-row" style={{ marginTop: '1.5rem' }}>
                <div className="control-label-wrapper">
                  <label>Solid Color</label>
                  <span className="control-value-text">
                    {selectedDev.state?.color ? rgbToHexLocal(selectedDev.state.color[0], selectedDev.state.color[1], selectedDev.state.color[2]) : '#ffffff'}
                  </span>
                </div>
                <div className="color-picker-box">
                  <input 
                    type="color" 
                    value={selectedDev.state?.color ? rgbToHexLocal(selectedDev.state.color[0], selectedDev.state.color[1], selectedDev.state.color[2]) : '#ffffff'} 
                    onChange={(e) => {
                      controlDeviceState(selectedDev.id, { color: hexToRgb(e.target.value) });
                    }} 
                    className="color-input-circle" 
                  />
                  <div className="color-picker-details">
                    <h5 style={{ fontSize: '0.85rem', fontWeight: '600' }}>Active Color</h5>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Real-time synchronization</p>
                  </div>
                </div>
              </div>

              {selectedDev.type === 'wled' && (
                <>
                  <div className="control-row" style={{ marginTop: '1.5rem' }}>
                    <div className="control-label-wrapper">
                      <label>Dynamic Effect</label>
                      <span className="control-value-text">{PRESET_EFFECTS.find(f => f.id === (selectedDev.state?.fx || 0))?.name || 'Solid Color'}</span>
                    </div>
                    <select 
                      value={selectedDev.state?.fx || 0} 
                      onChange={(e) => {
                        controlDeviceState(selectedDev.id, { fx: parseInt(e.target.value) });
                      }} 
                      className="select-dropdown"
                      style={{ width: '100%', marginTop: '0.5rem' }}
                    >
                      {PRESET_EFFECTS.map(eff => <option key={eff.id} value={eff.id}>{eff.name}</option>)}
                    </select>
                  </div>

                  <div className="control-row" style={{ marginTop: '1.5rem' }}>
                    <div className="control-label-wrapper">
                      <label>Color Temperature</label>
                      <span className="control-value-text">{selectedDev.state?.temp || 6500}K</span>
                    </div>
                    <div className="slider-input-wrapper">
                      <Wand2 style={{ width: '1.1rem', height: '1.1rem', color: 'var(--accent-cyan)' }} />
                      <input 
                        type="range" 
                        min="2000" max="10000" 
                        value={selectedDev.state?.temp || 6500} 
                        onChange={(e) => {
                          controlDeviceState(selectedDev.id, { temp: parseInt(e.target.value) });
                        }} 
                        className="slider-range-bar" 
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ADVANCED CALIBRATION */}
            <div className="glass-card" style={{ marginTop: '1rem', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="card-title-bar">
                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Sliders style={{ width: '0.9rem', height: '0.9rem' }} />
                  Advanced Color Calibration
                </h3>
                <button 
                  className="btn btn-icon" 
                  style={{ width: '1.8rem', height: '1.8rem' }}
                  onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                >
                  <ChevronDown size={14} style={{ transform: showAdvancedSettings ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
              </div>
              
              {showAdvancedSettings && (
                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  
                  {/* Step Progress Indicators */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0.5rem', marginBottom: '0.5rem' }}>
                    {[0, 1, 2, 3, 4].map(s => (
                      <div 
                        key={s} 
                        style={{ 
                          width: '10px', 
                          height: '10px', 
                          borderRadius: '50%', 
                          backgroundColor: calStep === s ? 'var(--accent-purple)' : calStep > s ? 'var(--accent-cyan)' : 'var(--border-color)',
                          boxShadow: calStep === s ? '0 0 8px var(--accent-purple)' : 'none',
                          transition: 'all 0.25s ease'
                        }}
                        title={`Step ${s + 1}`}
                      />
                    ))}
                  </div>

                  {/* STEP 0: Welcome / Explanation */}
                  {calStep === 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>TrueColor Calibration Assistant</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        This wizard corrects crosstalk distortion between R, G, and B LEDs so your light emits mathematically accurate colors matching your screen.
                      </p>
                      <button 
                        className="btn btn-primary" 
                        style={{ height: '2.2rem', fontSize: '0.8rem', marginTop: '0.5rem' }}
                        onClick={() => setCalStep(1)}
                      >
                        Start Calibration
                      </button>
                    </div>
                  )}

                  {/* STEP 1: Red Calibration */}
                  {calStep === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
                        Step 1: Calibrate Red Channel
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        1. Emit pure red to the light. Look at the light output.
                      </p>
                      <button 
                        className="btn" 
                        style={{ height: '2rem', fontSize: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}
                        onClick={() => controlDeviceState(selectedDev.id, { color: [255, 0, 0] })}
                      >
                        Emit Pure Red
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '0.25rem' }}>
                        2. Select the color you actually see (what color does the light look like?):
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input 
                          type="color" 
                          value={calRedSeen} 
                          onChange={(e) => setCalRedSeen(e.target.value)} 
                          style={{ width: '4rem', height: '2rem', padding: 0, border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }} 
                        />
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{calRedSeen}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn" style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }} onClick={() => setCalStep(0)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }} onClick={() => setCalStep(2)}>Next</button>
                      </div>
                    </div>
                  )}

                  {/* STEP 2: Green Calibration */}
                  {calStep === 2 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                        Step 2: Calibrate Green Channel
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        1. Emit pure green to the light. Look at the light output.
                      </p>
                      <button 
                        className="btn" 
                        style={{ height: '2rem', fontSize: '0.75rem', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.3)', color: '#86efac' }}
                        onClick={() => controlDeviceState(selectedDev.id, { color: [0, 255, 0] })}
                      >
                        Emit Pure Green
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '0.25rem' }}>
                        2. Select the color you actually see:
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input 
                          type="color" 
                          value={calGreenSeen} 
                          onChange={(e) => setCalGreenSeen(e.target.value)} 
                          style={{ width: '4rem', height: '2rem', padding: 0, border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }} 
                        />
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{calGreenSeen}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn" style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }} onClick={() => setCalStep(1)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }} onClick={() => setCalStep(3)}>Next</button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: Blue Calibration */}
                  {calStep === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', boxShadow: '0 0 6px #3b82f6' }} />
                        Step 3: Calibrate Blue Channel
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                        1. Emit pure blue to the light. Look at the light output.
                      </p>
                      <button 
                        className="btn" 
                        style={{ height: '2rem', fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.3)', color: '#93c5fd' }}
                        onClick={() => controlDeviceState(selectedDev.id, { color: [0, 0, 255] })}
                      >
                        Emit Pure Blue
                      </button>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', marginTop: '0.25rem' }}>
                        2. Select the color you actually see:
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <input 
                          type="color" 
                          value={calBlueSeen} 
                          onChange={(e) => setCalBlueSeen(e.target.value)} 
                          style={{ width: '4rem', height: '2rem', padding: 0, border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }} 
                        />
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>{calBlueSeen}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn" style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }} onClick={() => setCalStep(2)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }} onClick={() => setCalStep(4)}>Next</button>
                      </div>
                    </div>
                  )}

                  {/* STEP 4: Parameters & Apply */}
                  {calStep === 4 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>Step 4: Target Outputs & Apply</h4>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Target Gamma</label>
                          <input 
                            type="number" step="0.1" 
                            value={calGamma} 
                            onChange={(e) => setCalGamma(parseFloat(e.target.value) || 2.2)} 
                            className="input-field"
                            style={{ height: '2rem', padding: '0.25rem 0.5rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Color Temp (K)</label>
                          <input 
                            type="number" 
                            value={calTemp} 
                            onChange={(e) => setCalTemp(parseInt(e.target.value) || 6500)} 
                            className="input-field"
                            style={{ height: '2rem', padding: '0.25rem 0.5rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ background: 'rgba(2,6,23,0.3)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', margin: '0.25rem 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: calRedSeen, display: 'inline-block' }} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>R</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: calGreenSeen, display: 'inline-block' }} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>G</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <span style={{ width: '12px', height: '12px', borderRadius: '4px', backgroundColor: calBlueSeen, display: 'inline-block' }} />
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>B</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn" style={{ height: '2.2rem', fontSize: '0.8rem' }} onClick={() => setCalStep(3)}>Back</button>
                        <button 
                          className="btn btn-primary" 
                          style={{ flex: 1, height: '2.2rem', fontSize: '0.8rem' }}
                          onClick={() => {
                            saveDeviceCalibration(
                              selectedDev.id, calRedSeen, calGreenSeen, calBlueSeen, 
                              calGamma, calMinR, calMinG, calMinB, calMaxR, calMaxG, calMaxB, calTemp
                            );
                            setCalStep(0);
                          }}
                        >
                          Calculate & Apply
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Reset Factory options available throughout calibration */}
                  <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.25rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn" 
                      style={{ height: '1.8rem', fontSize: '0.7rem', border: 'none', background: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' }}
                      onClick={() => {
                        resetDeviceCalibration(selectedDev.id);
                        setCalStep(0);
                      }}
                    >
                      Reset Factory Defaults
                    </button>
                  </div>

                </div>
              )}
            </div>

          </div>
        ) : (
          /* PAINT INTERACTIVE CANVAS */
          <div className="paint-tab-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="paint-controls-bar">
              <div className="brush-color-picker">
                <input 
                  type="color" 
                  value={paintColor} 
                  onChange={(e) => setPaintColor(e.target.value)} 
                  style={{ width: '40px', height: '34px', padding: 0, border: '1px solid var(--border-color)', borderRadius: '6px', cursor: 'pointer' }}
                />
                <div>
                  <h6>Brush Color</h6>
                  <p>{paintColor}</p>
                </div>
              </div>

              <div className="paint-actions-row">
                <button onClick={fillAllPixels} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                  Fill Strip
                </button>
                <button onClick={clearAllPixels} className="btn" style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderColor: 'rgba(244, 63, 94, 0.2)' }}>
                  Clear All
                </button>
              </div>
            </div>

            <div 
              className="pixel-grid-canvas"
              onMouseDown={() => setIsDrawing(true)}
              onMouseUp={() => setIsDrawing(false)}
              onMouseLeave={() => setIsDrawing(false)}
            >
              {ledColors.map((rgb, idx) => {
                const hexColor = rgbToHexLocal(rgb[0], rgb[1], rgb[2]);
                return (
                  <div 
                    key={idx}
                    className="pixel-node-dot"
                    style={{ 
                      backgroundColor: hexColor, 
                      boxShadow: hexColor !== '#000000' && hexColor !== '#000' ? `0 0 12px ${hexColor}80` : 'none',
                      color: rgb[0] + rgb[1] + rgb[2] > 380 ? '#000' : '#fff',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                    onMouseDown={() => handlePaintPixel(idx)}
                    onMouseEnter={() => handlePixelMouseEnter(idx)}
                  >
                    {idx + 1}
                  </div>
                );
              })}
            </div>

            <div className="paint-info-footer">
              <Activity size={12} />
              <span>Click & drag across pixels to paint real-time onto the WLED controller.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Global scope helpers
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [255, 255, 255];
}
