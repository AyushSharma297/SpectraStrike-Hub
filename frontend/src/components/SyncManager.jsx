import React, { useState } from 'react';
import { Tv, Monitor, Trash2, Plus, GripVertical, Check, Edit2, Zap, Sliders } from 'lucide-react';

export default function SyncManager({ 
  devices,
  syncActive, 
  setSyncActive, 
  syncMode, 
  setSyncMode, 
  syncFps, 
  setSyncFps, 
  monitorIdx, 
  setMonitorIdx, 
  layoutMapping, 
  setLayoutMapping, 
  wledSegments, 
  setWledSegments, 
  draggedOverZone, 
  setDraggedOverZone, 
  handleDropOnZone, 
  handleDragStartDevice, 
  handleDragStartSegment, 
  updateSegmentZone, 
  handleAddSegment, 
  handleDeleteSegment, 
  toggleScreenSync, 
  isZoneActive,
  fetchDevices,
  flashEnabled,
  setFlashEnabled,
  flashThreshold,
  setFlashThreshold,
  flashColor,
  setFlashColor,
  flashDuration,
  setFlashDuration,
  applySyncSettings,
  zoneConfigs,
  saveZoneConfigs,
  resetSyncParams,
  resetMuzzleFlashParams,
  resetZoneConfigs
}) {
  const [segStart, setSegStart] = useState(0);
  const [segEnd, setSegEnd] = useState(15);
  const [segZone, setSegZone] = useState('left');
  const [activeSegmentDevice, setActiveSegmentDevice] = useState('');
  
  // State to track which device is being renamed
  const [editingNameId, setEditingNameId] = useState(null);
  const [tempNameValue, setTempNameValue] = useState('');

  // Local state for interactive screen mapping boundaries
  const [localLeft, setLocalLeft] = useState(zoneConfigs?.left ?? 15);
  const [localRight, setLocalRight] = useState(zoneConfigs?.right ?? 15);
  const [localTop, setLocalTop] = useState(zoneConfigs?.top ?? 15);
  const [localBottom, setLocalBottom] = useState(zoneConfigs?.bottom ?? 15);
  const [localCxMin, setLocalCxMin] = useState(zoneConfigs?.center_x_min ?? 25);
  const [localCxMax, setLocalCxMax] = useState(zoneConfigs?.center_x_max ?? 75);
  const [localCyMin, setLocalCyMin] = useState(zoneConfigs?.center_y_min ?? 25);
  const [localCyMax, setLocalCyMax] = useState(zoneConfigs?.center_y_max ?? 75);

  React.useEffect(() => {
    if (zoneConfigs) {
      setLocalLeft(zoneConfigs.left ?? 15);
      setLocalRight(zoneConfigs.right ?? 15);
      setLocalTop(zoneConfigs.top ?? 15);
      setLocalBottom(zoneConfigs.bottom ?? 15);
      setLocalCxMin(zoneConfigs.center_x_min ?? 25);
      setLocalCxMax(zoneConfigs.center_x_max ?? 75);
      setLocalCyMin(zoneConfigs.center_y_min ?? 25);
      setLocalCyMax(zoneConfigs.center_y_max ?? 75);
    }
  }, [zoneConfigs]);

  const triggerSaveBoundaries = async (updatedFields) => {
    const payload = {
      left: localLeft,
      right: localRight,
      top: localTop,
      bottom: localBottom,
      center_x_min: localCxMin,
      center_x_max: localCxMax,
      center_y_min: localCyMin,
      center_y_max: localCyMax,
      ...updatedFields
    };
    await saveZoneConfigs(payload);
  };

  const handleFlashToggle = async (checked) => {
    setFlashEnabled(checked);
    if (syncActive) {
      await applySyncSettings(true, { flashEnabled: checked });
    }
  };

  const handleThresholdChange = (val) => {
    setFlashThreshold(val);
  };

  const handleThresholdChangeComplete = async (val) => {
    if (syncActive) {
      await applySyncSettings(true, { flashThreshold: val });
    }
  };

  const handleDurationChange = (val) => {
    setFlashDuration(val);
  };

  const handleDurationChangeComplete = async (val) => {
    if (syncActive) {
      await applySyncSettings(true, { flashDuration: val });
    }
  };

  const handleColorChange = async (val) => {
    setFlashColor(val);
    if (syncActive) {
      await applySyncSettings(true, { flashColor: val });
    }
  };

  // Find devices mapped to each zone
  const getDevicesInZone = (zone) => {
    return Object.keys(layoutMapping)
      .filter(id => layoutMapping[id] === zone)
      .map(id => devices.find(d => d.id === id || d.id === parseInt(id)))
      .filter(Boolean);
  };

  const getSegmentsInZone = (zone) => {
    const list = [];
    Object.keys(wledSegments).forEach(devId => {
      const dev = devices.find(d => d.id === devId || d.id === parseInt(devId));
      if (!dev) return;
      const segs = wledSegments[devId] || [];
      segs.forEach((seg, idx) => {
        if (seg.zone === zone) {
          list.push({ devName: dev.name || `Device ${dev.id}`, devId, seg, idx });
        }
      });
    });
    return list;
  };

  const onZoneSelectChange = async (deviceId, zone) => {
    const updated = { ...layoutMapping, [deviceId]: zone };
    if (!zone || zone === 'none') {
      delete updated[deviceId];
    }
    setLayoutMapping(updated);
    try {
      await fetch('/api/sync/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout_mapping: updated })
      });
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  };

  const handleSaveDeviceName = async (deviceId) => {
    if (!tempNameValue.trim()) return;
    try {
      await fetch(`/api/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tempNameValue.trim() })
      });
      setEditingNameId(null);
      fetchDevices(); // Refresh lists
    } catch (err) {
      console.error('Failed to rename device:', err);
    }
  };

  const wledDevices = devices.filter(d => d.type === 'wled');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. SCREEN MOCKUP AND CONTROL MODULES */}
      <div className="responsive-grid-2col" style={{ gap: '2rem', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: VISUAL SCREEN MOCKUP & PLACEMENT BOUNDARIES */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          
          {/* VIRTUAL SCREEN MOCKUP */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <span className="card-title">Placement Mapping</span>
            
            <div className="monitor-mockup-area" style={{ padding: '2rem 0' }}>
              <div className="monitor-frame" style={{ width: '300px', height: '170px' }}>
                <div className="monitor-inner">
                  
                  {/* LEFT ZONE */}
                  <div
                    className={`sync-border-left ${isZoneActive('left') ? 'active' : ''} ${draggedOverZone === 'left' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('left')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'left')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: `${(localLeft / 100) * 300}px` 
                    }}
                  >
                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'var(--text-muted)' }}>LEFT</span>
                  </div>

                  {/* RIGHT ZONE */}
                  <div
                    className={`sync-border-right ${isZoneActive('right') ? 'active' : ''} ${draggedOverZone === 'right' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('right')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'right')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: `${(localRight / 100) * 300}px` 
                    }}
                  >
                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'var(--text-muted)' }}>RIGHT</span>
                  </div>

                  {/* TOP ZONE */}
                  <div
                    className={`sync-border-top ${isZoneActive('top') ? 'active' : ''} ${draggedOverZone === 'top' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('top')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'top')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      height: `${(localTop / 100) * 170}px`,
                      left: `${(localLeft / 100) * 300}px`,
                      right: `${(localRight / 100) * 300}px`
                    }}
                  >
                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'var(--text-muted)' }}>TOP</span>
                  </div>

                  {/* BOTTOM ZONE */}
                  <div
                    className={`sync-border-bottom ${isZoneActive('bottom') ? 'active' : ''} ${draggedOverZone === 'bottom' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('bottom')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'bottom')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      height: `${(localBottom / 100) * 170}px`,
                      left: `${(localLeft / 100) * 300}px`,
                      right: `${(localRight / 100) * 300}px`,
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ fontSize: '0.6rem', fontWeight: '800', color: 'var(--text-muted)' }}>BOTTOM</span>
                  </div>

                  {/* CENTER ZONE */}
                  <div 
                    className={`sync-inner-center ${isZoneActive('center') ? 'active' : ''}`}
                    style={{ 
                      position: 'absolute', 
                      inset: 'auto', 
                      left: `${(localCxMin / 100) * 300}px`, 
                      right: `${((100 - localCxMax) / 100) * 300}px`, 
                      top: `${(localCyMin / 100) * 170}px`, 
                      bottom: `${((100 - localCyMax) / 100) * 170}px`, 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      border: '1px dashed rgba(255,255,255,0.15)',
                      background: isZoneActive('center') ? 'rgba(6, 182, 212, 0.04)' : 'transparent',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Monitor style={{ width: '2rem', height: '2rem', color: syncActive ? 'var(--accent-cyan)' : '#334155', filter: syncActive ? 'drop-shadow(0 0 10px var(--accent-cyan-glow))' : 'none' }} />
                    <div className="monitor-status-text" style={{ fontSize: '0.55rem', marginTop: '0.35rem' }}>
                      {syncActive ? 'SYNC RUNNING' : 'SYNC IDLE'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(2,6,23,0.3)', padding: '0.75rem', borderRadius: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: '700', color: 'var(--text-secondary)' }}>💡 Mapping Instructions:</span>
              <span>Drag controllers from the sidebar list and drop them onto screen borders, or use the drop-down selector below.</span>
            </div>
          </div>

          {/* PLACEMENT BOUNDARIES CONFIGURATOR */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sliders size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span className="card-title" style={{ margin: 0 }}>Placement Margin Boundaries</span>
              </div>
              <button 
                onClick={resetZoneConfigs} 
                className="btn" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', border: 'none', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}
              >
                Reset Defaults
              </button>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
              Customize the screen capture crop dimensions for each edge and center zone. Drag sliders to adjust and see the mockup resize.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
              
              {/* Left & Right Margins */}
              <div className="responsive-grid-equal" style={{ gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Left Edge Width</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{localLeft}%</span>
                  </div>
                  <input 
                    type="range" min="5" max="40" step="1" value={localLeft}
                    onChange={(e) => setLocalLeft(parseInt(e.target.value))}
                    onMouseUp={(e) => triggerSaveBoundaries({ left: parseInt(e.target.value) })}
                    onTouchEnd={(e) => triggerSaveBoundaries({ left: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Right Edge Width</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{localRight}%</span>
                  </div>
                  <input 
                    type="range" min="5" max="40" step="1" value={localRight}
                    onChange={(e) => setLocalRight(parseInt(e.target.value))}
                    onMouseUp={(e) => triggerSaveBoundaries({ right: parseInt(e.target.value) })}
                    onTouchEnd={(e) => triggerSaveBoundaries({ right: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Top & Bottom Margins */}
              <div className="responsive-grid-equal" style={{ gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Top Edge Height</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{localTop}%</span>
                  </div>
                  <input 
                    type="range" min="5" max="40" step="1" value={localTop}
                    onChange={(e) => setLocalTop(parseInt(e.target.value))}
                    onMouseUp={(e) => triggerSaveBoundaries({ top: parseInt(e.target.value) })}
                    onTouchEnd={(e) => triggerSaveBoundaries({ top: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Bottom Edge Height</span>
                    <span style={{ color: 'var(--accent-cyan)', fontWeight: 'bold' }}>{localBottom}%</span>
                  </div>
                  <input 
                    type="range" min="5" max="40" step="1" value={localBottom}
                    onChange={(e) => setLocalBottom(parseInt(e.target.value))}
                    onMouseUp={(e) => triggerSaveBoundaries({ bottom: parseInt(e.target.value) })}
                    onTouchEnd={(e) => triggerSaveBoundaries({ bottom: parseInt(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-cyan)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                  />
                </div>
              </div>

              {/* Center Zone Config (X-Min, X-Max, Y-Min, Y-Max) */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Center Detection Zone (Gaming / Muzzle Zone)</span>
                
                <div className="responsive-grid-equal" style={{ gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Horiz Start (X Min)</span>
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{localCxMin}%</span>
                    </div>
                    <input 
                      type="range" min="10" max="45" step="1" value={localCxMin}
                      onChange={(e) => setLocalCxMin(parseInt(e.target.value))}
                      onMouseUp={(e) => triggerSaveBoundaries({ center_x_min: parseInt(e.target.value) })}
                      onTouchEnd={(e) => triggerSaveBoundaries({ center_x_min: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent-purple)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Horiz End (X Max)</span>
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{localCxMax}%</span>
                    </div>
                    <input 
                      type="range" min="55" max="90" step="1" value={localCxMax}
                      onChange={(e) => setLocalCxMax(parseInt(e.target.value))}
                      onMouseUp={(e) => triggerSaveBoundaries({ center_x_max: parseInt(e.target.value) })}
                      onTouchEnd={(e) => triggerSaveBoundaries({ center_x_max: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent-purple)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                    />
                  </div>
                </div>

                <div className="responsive-grid-equal" style={{ gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Vert Start (Y Min)</span>
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{localCyMin}%</span>
                    </div>
                    <input 
                      type="range" min="10" max="45" step="1" value={localCyMin}
                      onChange={(e) => setLocalCyMin(parseInt(e.target.value))}
                      onMouseUp={(e) => triggerSaveBoundaries({ center_y_min: parseInt(e.target.value) })}
                      onTouchEnd={(e) => triggerSaveBoundaries({ center_y_min: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent-purple)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Vert End (Y Max)</span>
                      <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{localCyMax}%</span>
                    </div>
                    <input 
                      type="range" min="55" max="90" step="1" value={localCyMax}
                      onChange={(e) => setLocalCyMax(parseInt(e.target.value))}
                      onMouseUp={(e) => triggerSaveBoundaries({ center_y_max: parseInt(e.target.value) })}
                      onTouchEnd={(e) => triggerSaveBoundaries({ center_y_max: parseInt(e.target.value) })}
                      style={{ width: '100%', accentColor: 'var(--accent-purple)', background: 'rgba(255,255,255,0.05)', height: '5px', borderRadius: '3px', outline: 'none', cursor: 'pointer' }}
                    />
                  </div>
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          
          {/* SYNC CONFIGURATION SUMMARY */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title" style={{ margin: 0 }}>Sync Parameters</span>
              <button 
                onClick={resetSyncParams} 
                className="btn" 
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', border: 'none', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}
              >
                Reset Defaults
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="control-row">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sampling Mode</label>
                <select 
                  value={syncMode} 
                  onChange={(e) => setSyncMode(e.target.value)} 
                  className="select-dropdown"
                  style={{ width: '100%', marginTop: '0.35rem' }}
                >
                  <option value="average">Average Sector RGB</option>
                  <option value="vibrant">Vibrant Spot Color</option>
                  <option value="dominant">Dominant Sector Color</option>
                  <option value="movie">Movie Friendly (Max Ambient)</option>
                  <option value="gaming">Tactical Gaming (Insta-Flash)</option>
                  <option value="chill">Relaxing Warm Chill (Eye Comfort)</option>
                  <option value="scifi_neon">Sci-Fi Neon (Cyberpunk Ambient)</option>
                  <option value="spotlight">Spotlight Center Focus</option>
                  <option value="border">Edge Border Mapping</option>
                </select>
              </div>

              <div className="control-row">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Capture Rate (FPS Target)</label>
                <input 
                  type="number" 
                  value={syncFps} 
                  onChange={(e) => setSyncFps(parseInt(e.target.value))} 
                  className="input-field" 
                  style={{ width: '100%', marginTop: '0.35rem' }}
                />
              </div>

              <div className="control-row">
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Display Source</label>
                <select 
                  value={monitorIdx} 
                  onChange={(e) => setMonitorIdx(parseInt(e.target.value))} 
                  className="select-dropdown"
                  style={{ width: '100%', marginTop: '0.35rem' }}
                >
                  <option value="1">Monitor 1 (Primary)</option>
                  <option value="2">Monitor 2 (Secondary)</option>
                </select>
              </div>
              
              <button 
                onClick={toggleScreenSync} 
                className={`btn ${syncActive ? 'btn-rose' : 'btn-primary'}`} 
                style={{ width: '100%', height: '2.75rem', marginTop: '0.5rem' }}
              >
                {syncActive ? 'Terminate Screen Sync' : 'Initiate Screen Sync'}
              </button>
            </div>
          </div>

          {/* TACTICAL GAMING MODE (MUZZLE FLASH) */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={16} style={{ color: 'var(--accent-purple)', filter: 'drop-shadow(0 0 4px var(--accent-purple-glow))' }} />
                <span className="card-title" style={{ margin: 0 }}>Gaming Muzzle Flash Mode</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <button 
                  onClick={resetMuzzleFlashParams} 
                  className="btn" 
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem', border: 'none', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}
                >
                  Reset Defaults
                </button>
                <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={flashEnabled} 
                    onChange={(e) => handleFlashToggle(e.target.checked)} 
                    style={{ display: 'none' }} 
                    id="muzzle-flash-toggle-input"
                  />
                  <div style={{
                    width: '38px',
                    height: '20px',
                    backgroundColor: flashEnabled ? 'var(--accent-purple)' : '#1e293b',
                    borderRadius: '20px',
                    transition: 'background-color 0.2s',
                    position: 'relative',
                    border: '1px solid var(--border-color)',
                    boxShadow: flashEnabled ? '0 0 10px rgba(168, 85, 247, 0.45)' : 'none'
                  }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#fff',
                      borderRadius: '50%',
                      position: 'absolute',
                      top: '3px',
                      left: flashEnabled ? '21px' : '3px',
                      transition: 'left 0.2s'
                    }} />
                  </div>
                </label>
              </div>
            </div>
            
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.4', margin: 0 }}>
              Detects weapon fire transients (brightness spikes in center screen) and triggers a temporary full-room color override. Works locally on pixels, undetected by anti-cheat.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.25rem' }}>
              {/* Threshold Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Trigger Sensitivity (Brightness Delta)</span>
                  <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{flashThreshold}</span>
                </div>
                <input 
                  type="range" 
                  min="10" 
                  max="100" 
                  step="5"
                  value={flashThreshold}
                  onChange={(e) => handleThresholdChange(parseInt(e.target.value))}
                  onMouseUp={(e) => handleThresholdChangeComplete(parseInt(e.target.value))}
                  onTouchEnd={(e) => handleThresholdChangeComplete(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent-purple)',
                    background: 'rgba(255,255,255,0.05)',
                    height: '6px',
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Lower values trigger on minor flashes; higher values require full center-screen explosions.</span>
              </div>

              {/* Duration Slider */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Flash Burst Duration</span>
                  <span style={{ color: 'var(--accent-purple)', fontWeight: 'bold' }}>{flashDuration} frames ({Math.round(flashDuration * (1000 / syncFps))} ms)</span>
                </div>
                <input 
                  type="range" 
                  min="1" 
                  max="10" 
                  step="1"
                  value={flashDuration}
                  onChange={(e) => handleDurationChange(parseInt(e.target.value))}
                  onMouseUp={(e) => handleDurationChangeComplete(parseInt(e.target.value))}
                  onTouchEnd={(e) => handleDurationChangeComplete(parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    accentColor: 'var(--accent-purple)',
                    background: 'rgba(255,255,255,0.05)',
                    height: '6px',
                    borderRadius: '3px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                />
                <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>Controls how many capture frames the gunshot color is held before decaying back.</span>
              </div>

              {/* Color Picker */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Muzzle Flash Color Accent</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.2rem' }}>
                  <input 
                    type="color" 
                    value={flashColor}
                    onChange={(e) => handleColorChange(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      background: 'transparent',
                      width: '32px',
                      height: '32px',
                      cursor: 'pointer',
                      padding: 0,
                      borderRadius: '8px',
                      overflow: 'hidden'
                    }}
                  />
                  <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{flashColor.toUpperCase()}</span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 2. DEVICE NAMES EDITOR & ZONE MAPPING MATRIX */}
      <div className="glass-card">
        <span className="card-title">Controller Placement & Name Matrix (All Lights)</span>
        
        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Status</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Type</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Controller Local Reference Name</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>IP / Interface</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold' }}>Sync Placement Zone</th>
              </tr>
            </thead>
            <tbody>
              {devices.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No lighting devices detected.
                  </td>
                </tr>
              ) : (
                devices.map(dev => {
                  const isEditing = editingNameId === dev.id;
                  const currentZone = layoutMapping[dev.id] || 'none';
                  return (
                    <tr key={dev.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', height: '3.5rem' }}>
                      {/* STATUS */}
                      <td style={{ padding: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: dev.state?.on ? '#06b6d4' : '#f43f5e',
                            boxShadow: dev.state?.on ? '0 0 8px #06b6d4' : 'none'
                          }}></span>
                          <span style={{ fontSize: '0.7rem', color: dev.state?.on ? 'var(--text-main)' : 'var(--text-muted)' }}>
                            {dev.state?.on ? 'Online' : 'Offline'}
                          </span>
                        </div>
                      </td>

                      {/* TYPE BADGE */}
                      <td style={{ padding: '0.5rem' }}>
                        <span className="tag" style={{ background: dev.type === 'wled' ? 'rgba(168,85,247,0.15)' : 'rgba(6,182,212,0.15)', color: dev.type === 'wled' ? '#c4b5fd' : '#67e8f9' }}>
                          {dev.type.toUpperCase()}
                        </span>
                      </td>

                      {/* NAME AND INLINE RENAME EDITOR */}
                      <td style={{ padding: '0.5rem' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <input 
                              type="text" 
                              value={tempNameValue} 
                              onChange={(e) => setTempNameValue(e.target.value)}
                              className="input-field"
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', width: '200px' }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveDeviceName(dev.id);
                                if (e.key === 'Escape') setEditingNameId(null);
                              }}
                            />
                            <button 
                              onClick={() => handleSaveDeviceName(dev.id)} 
                              className="btn btn-icon"
                              style={{ width: '1.75rem', height: '1.75rem', border: 'none', background: 'rgba(168,85,247,0.15)' }}
                            >
                              <Check size={12} style={{ color: 'var(--accent-purple)' }} />
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{dev.name}</span>
                            <button 
                              onClick={() => {
                                setEditingNameId(dev.id);
                                setTempNameValue(dev.name);
                              }}
                              className="btn btn-icon"
                              style={{ width: '1.5rem', height: '1.5rem', border: 'none', background: 'transparent', boxShadow: 'none' }}
                              title="Edit Local Name"
                            >
                              <Edit2 size={11} style={{ color: 'var(--text-muted)' }} />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* IP */}
                      <td style={{ padding: '0.5rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {dev.ip}
                      </td>

                      {/* ZONE SELECT DROPDOWN */}
                      <td style={{ padding: '0.5rem' }}>
                        <select 
                          value={currentZone}
                          onChange={(e) => onZoneSelectChange(dev.id, e.target.value)}
                          className="select-dropdown"
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          <option value="none">Not Syncing (None)</option>
                          <option value="left">Left Screen Edge</option>
                          <option value="right">Right Screen Edge</option>
                          <option value="top">Top Screen Edge</option>
                          <option value="bottom">Bottom Screen Edge</option>
                        </select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. WLED SEGMENT CONFIGURATOR */}
      <div className="glass-card">
        <div className="card-title-bar" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          <span className="card-title" style={{ color: '#c4b5fd' }}>WLED Channel Segment Configurator</span>
        </div>

        <div className="segment-inputs-grid">
          <div className="form-group">
            <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>WLED Controller Target</label>
            <select 
              value={activeSegmentDevice} 
              onChange={(e) => setActiveSegmentDevice(e.target.value)} 
              className="select-dropdown"
            >
              <option value="">Select WLED light...</option>
              {wledDevices.map(d => <option key={d.id} value={d.id}>{d.name} ({d.ip})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Start LED</label>
            <input type="number" value={segStart} onChange={(e) => setSegStart(e.target.value)} className="input-field" />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>End LED</label>
            <input type="number" value={segEnd} onChange={(e) => setSegEnd(e.target.value)} className="input-field" />
          </div>
          <div className="form-group">
            <label style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Placement Zone</label>
            <select value={segZone} onChange={(e) => setSegZone(e.target.value)} className="select-dropdown">
              <option value="left">Left Edge</option>
              <option value="right">Right Edge</option>
              <option value="top">Top Edge</option>
              <option value="bottom">Bottom Edge</option>
            </select>
          </div>
          <button 
            onClick={() => {
              if (!activeSegmentDevice) return;
              handleAddSegment(activeSegmentDevice, segStart, segEnd, segZone);
            }} 
            className="btn btn-primary"
            style={{ height: '36px', padding: '0 1rem' }}
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="segment-list" style={{ marginTop: '1rem' }}>
          {Object.keys(wledSegments).map(devId => {
            const dev = devices.find(d => d.id === devId || d.id === parseInt(devId));
            if (!dev) return null;
            const segs = wledSegments[devId] || [];
            return segs.map((seg, idx) => (
              <div 
                key={`${devId}-${idx}`} 
                className="segment-item-row"
                style={{ marginBottom: '0.5rem' }}
              >
                <div className="segment-drag-handle">
                  <GripVertical size={14} />
                </div>
                <div className="segment-info-fields">
                  <span style={{ fontSize: '0.78rem', fontWeight: 'bold' }}>{dev.name}</span>
                  <span className="segment-range-badge">Indices {seg.start} to {seg.end}</span>
                  <span className="segment-zone-badge">{seg.zone}</span>
                </div>
                <button 
                  onClick={() => handleDeleteSegment(devId, idx)}
                  className="btn btn-icon"
                  style={{ width: '1.75rem', height: '1.75rem' }}
                >
                  <Trash2 size={12} style={{ color: 'var(--accent-rose)' }} />
                </button>
              </div>
            ));
          })}
        </div>
      </div>

    </div>
  );
}
