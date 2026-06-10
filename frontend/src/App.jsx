import React, { useState, useEffect, useRef } from 'react';
import {
  Sun,
  Tv,
  RefreshCw,
  Plus,
  Trash2,
  Cpu,
  Layers,
  Lightbulb,
  Paintbrush,
  Check,
  AlertCircle,
  Power,
  Sliders,
  Monitor,
  Layout,
  ChevronDown
} from 'lucide-react';

const PRESET_EFFECTS = [
  { id: 0, name: 'Solid Color' },
  { id: 1, name: 'Blink' },
  { id: 2, name: 'Breathe' },
  { id: 3, name: 'Color Wipe' },
  { id: 9, name: 'Rainbow Chase' },
  { id: 12, name: 'Fire Flicker' },
  { id: 15, name: 'Sparkle' },
  { id: 20, name: 'Color Waves' },
  { id: 35, name: 'Multi Comet' },
  { id: 46, name: 'Noise Generator' }
];

export default function App() {
  // Global States
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [loadingScan, setLoadingScan] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  
  // Form State for manual addition
  const [newIp, setNewIp] = useState('');
  const [newType, setNewType] = useState('wled');
  const [newName, setNewName] = useState('');
  const [newLedCount, setNewLedCount] = useState(30);

  // Screen Sync configurations
  const [syncActive, setSyncActive] = useState(false);
  const [syncMode, setSyncMode] = useState('average');
  const [syncFps, setSyncFps] = useState(20);
  const [monitorIdx, setMonitorIdx] = useState(1);
  const [layoutMapping, setLayoutMapping] = useState({}); // { device_id: 'left' | 'top' | ... }
  const [activeTab, setActiveTab] = useState('control'); // 'control' | 'paint'
  const [wledSegments, setWledSegments] = useState({}); // { deviceId: [{ start: 0, end: 10, zone: 'left' }, ...] }
  const [draggedOverZone, setDraggedOverZone] = useState(null);
  
  // Local form state for adding a segment
  const [segStart, setSegStart] = useState(0);
  const [segEnd, setSegEnd] = useState(15);
  const [segZone, setSegZone] = useState('left');

  const [calRedSeen, setCalRedSeen] = useState('#ff0000');
  const [calGreenSeen, setCalGreenSeen] = useState('#00ff00');
  const [calBlueSeen, setCalBlueSeen] = useState('#0000ff');

  const [calGamma, setCalGamma] = useState(2.2);
  const [calMinR, setCalMinR] = useState(0);
  const [calMinG, setCalMinG] = useState(0);
  const [calMinB, setCalMinB] = useState(0);
  const [calMaxR, setCalMaxR] = useState(255);
  const [calMaxG, setCalMaxG] = useState(255);
  const [calMaxB, setCalMaxB] = useState(255);
  const [calTemp, setCalTemp] = useState(6500);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // WLED Painter states
  const [paintColor, setPaintColor] = useState('#a855f7');
  const [ledColors, setLedColors] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const paintDirtyRef = useRef(false);
  const ledColorsRef = useRef([]);

  // Fetch devices periodically
  useEffect(() => {
    fetchDevices();
    fetchSyncStatus();
    fetchLayoutMapping();
    fetchSegmentsMapping();

    const interval = setInterval(() => {
      fetchDevices(true);
      fetchSyncStatus(true);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDeviceId) {
      fetchDeviceCalibration(selectedDeviceId);
    }
  }, [selectedDeviceId]);

  // WLED Paint Brush streaming throttle loop
  useEffect(() => {
    const streamInterval = setInterval(() => {
      if (paintDirtyRef.current && selectedDeviceId) {
        const selectedDev = devices.find(d => d.id === selectedDeviceId);
        if (selectedDev && selectedDev.type === 'wled') {
          streamPaintColors(selectedDeviceId, ledColorsRef.current);
          paintDirtyRef.current = false;
        }
      }
    }, 75); // ~13-14 FPS stream cap

    return () => clearInterval(streamInterval);
  }, [selectedDeviceId, devices]);

  // Sync ref with state
  useEffect(() => {
    ledColorsRef.current = ledColors;
  }, [ledColors]);

  const fetchDevices = async (silent = false) => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        if (data.length > 0 && !selectedDeviceId && !silent) {
          setSelectedDeviceId(data[0].id);
          initializeLedColors(data[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const fetchSyncStatus = async (silent = false) => {
    try {
      const res = await fetch('/api/sync/screen/status');
      if (res.ok) {
        const data = await res.json();
        setSyncActive(data.active);
        setSyncMode(data.mode || 'average');
        setSyncFps(data.fps || 20);
        setMonitorIdx(data.monitor_idx || 1);
      }
    } catch (err) {
      console.error('Error fetching sync status:', err);
    }
  };

  const fetchLayoutMapping = async () => {
    try {
      const res = await fetch('/api/sync/layout');
      if (res.ok) {
        const data = await res.json();
        setLayoutMapping(data || {});
      }
    } catch (err) {
      console.error('Error fetching layout mapping:', err);
    }
  };

  const fetchSegmentsMapping = async () => {
    try {
      const res = await fetch('/api/sync/segments');
      if (res.ok) {
        const data = await res.json();
        setWledSegments(data || {});
      }
    } catch (err) {
      console.error('Failed to fetch segments mapping:', err);
    }
  };

  const saveSegmentsMapping = async (deviceId, segmentsList) => {
    try {
      const res = await fetch('/api/sync/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
          segments: segmentsList
        })
      });
      if (res.ok) {
        setWledSegments(prev => ({ ...prev, [deviceId]: segmentsList }));
      }
    } catch (err) {
      console.error('Failed to save segments:', err);
    }
  };

  const updateSegmentZone = (deviceId, index, zone) => {
    const current = wledSegments[deviceId] || [];
    const updated = current.map((seg, idx) => idx === index ? { ...seg, zone } : seg);
    saveSegmentsMapping(deviceId, updated);
  };

  const handleAddSegment = (deviceId, start, end, zone) => {
    const current = wledSegments[deviceId] || [];
    const updated = [...current, { start: parseInt(start), end: parseInt(end), zone }];
    saveSegmentsMapping(deviceId, updated);
  };

  const handleDeleteSegment = (deviceId, index) => {
    const current = wledSegments[deviceId] || [];
    const updated = current.filter((_, idx) => idx !== index);
    saveSegmentsMapping(deviceId, updated);
  };

  const handleDragStartDevice = (e, devId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'device', id: devId }));
  };

  const handleDragStartSegment = (e, devId, segIdx) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'segment', deviceId: devId, index: segIdx }));
  };

  const handleDropOnZone = (e, zone) => {
    e.preventDefault();
    setDraggedOverZone(null);
    try {
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.type === 'device') {
        handleLayoutChange(data.id, zone);
      } else if (data.type === 'segment') {
        updateSegmentZone(data.deviceId, data.index, zone);
      }
    } catch (err) {
      console.error('Error handling drop:', err);
    }
  };

  const fetchDeviceCalibration = async (deviceId) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/calibration`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.r_seen) {
          setCalRedSeen(rgbToHex(data.r_seen[0], data.r_seen[1], data.r_seen[2]));
          setCalGreenSeen(rgbToHex(data.g_seen[0], data.g_seen[1], data.g_seen[2]));
          setCalBlueSeen(rgbToHex(data.b_seen[0], data.b_seen[1], data.b_seen[2]));
          setCalGamma(data.gamma !== undefined ? data.gamma : 2.2);
          setCalMinR(data.min_r !== undefined ? data.min_r : 0);
          setCalMinG(data.min_g !== undefined ? data.min_g : 0);
          setCalMinB(data.min_b !== undefined ? data.min_b : 0);
          setCalMaxR(data.max_r !== undefined ? data.max_r : 255);
          setCalMaxG(data.max_g !== undefined ? data.max_g : 255);
          setCalMaxB(data.max_b !== undefined ? data.max_b : 255);
          setCalTemp(data.temp !== undefined ? data.temp : 6500);
        } else {
          setCalRedSeen('#ff0000');
          setCalGreenSeen('#00ff00');
          setCalBlueSeen('#0000ff');
          setCalGamma(2.2);
          setCalMinR(0);
          setCalMinG(0);
          setCalMinB(0);
          setCalMaxR(255);
          setCalMaxG(255);
          setCalMaxB(255);
          setCalTemp(6500);
        }
      }
    } catch (err) {
      console.error('Failed to fetch calibration:', err);
    }
  };

  const saveDeviceCalibration = async (deviceId, rSeen, gSeen, bSeen, gamma, minR, minG, minB, maxR, maxG, maxB, temp) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r_seen: hexToRgb(rSeen),
          g_seen: hexToRgb(gSeen),
          b_seen: hexToRgb(bSeen),
          gamma: parseFloat(gamma),
          min_r: parseInt(minR),
          min_g: parseInt(minG),
          min_b: parseInt(minB),
          max_r: parseInt(maxR),
          max_g: parseInt(maxG),
          max_b: parseInt(maxB),
          temp: parseInt(temp)
        })
      });
      if (res.ok) {
        alert('Advanced color calibration applied successfully!');
      }
    } catch (err) {
      console.error('Failed to save calibration:', err);
      alert('Failed to save calibration: ' + err.message);
    }
  };

  const initializeLedColors = (device) => {
    if (device && device.type === 'wled') {
      const count = device.led_count || 30;
      const activeStateCol = device.state?.color || [255, 255, 255];
      const initialColors = Array(count).fill(activeStateCol);
      setLedColors(initialColors);
    }
  };

  const handleDeviceSelect = (id) => {
    setSelectedDeviceId(id);
    const dev = devices.find(d => d.id === id);
    if (dev) {
      initializeLedColors(dev);
      if (dev.type !== 'wled' && activeTab === 'paint') {
        setActiveTab('control');
      }
    }
  };

  const triggerScan = async () => {
    setLoadingScan(true);
    setScanMessage('Scanning network subnets for lighting devices...');
    try {
      const res = await fetch('/api/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setScanMessage(data.message || 'Scan completed.');
        fetchDevices();
        fetchLayoutMapping();
      } else {
        setScanMessage('Scan failed. Verify backend connections.');
      }
    } catch (err) {
      setScanMessage(`Scan error: ${err.message}`);
    } finally {
      setLoadingScan(false);
      setTimeout(() => setScanMessage(''), 6000);
    }
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    if (!newIp) return;
    try {
      const res = await fetch('/api/devices/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: newIp,
          type: newType,
          name: newName || undefined,
          led_count: newType === 'wled' ? parseInt(newLedCount) : undefined
        })
      });
      if (res.ok) {
        const addedDev = await res.json();
        setDevices(prev => [...prev.filter(d => d.id !== addedDev.id), addedDev]);
        setSelectedDeviceId(addedDev.id);
        initializeLedColors(addedDev);
        setNewIp('');
        setNewName('');
        setShowAddForm(false);
      } else {
        const errData = await res.json();
        alert(`Failed to add device: ${errData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      alert(`Error adding device: ${err.message}`);
    }
  };

  const controlDeviceState = async (id, payload) => {
    try {
      setDevices(prev => prev.map(d => {
        if (d.id === id) {
          const updatedState = { ...d.state, ...payload };
          if (payload.bri !== undefined) updatedState.bri = payload.bri;
          if (payload.on !== undefined) updatedState.on = payload.on;
          if (payload.color !== undefined) updatedState.color = payload.color;
          if (payload.fx !== undefined) updatedState.fx = payload.fx;
          if (payload.temp !== undefined) updatedState.temp = payload.temp;
          return { ...d, state: updatedState };
        }
        return d;
      }));

      const res = await fetch(`/api/devices/${id}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updatedState = await res.json();
        setDevices(prev => prev.map(d => d.id === id ? { ...d, state: updatedState } : d));
      }
    } catch (err) {
      console.error('Failed to control device:', err);
    }
  };

  const streamPaintColors = async (id, colors) => {
    try {
      await fetch(`/api/devices/${id}/paint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ colors })
      });
    } catch (err) {
      console.error('Error streaming paint colors:', err);
    }
  };

  const handleLayoutChange = async (deviceId, zone) => {
    const updated = { ...layoutMapping, [deviceId]: zone };
    if (!zone) {
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

  const toggleScreenSync = async () => {
    const nextActive = !syncActive;
    const layoutActive = Object.keys(layoutMapping).filter(id => layoutMapping[id] && layoutMapping[id] !== 'none');
    const segmentsActive = Object.keys(wledSegments).filter(id => wledSegments[id] && wledSegments[id].length > 0);
    const activeDeviceIds = Array.from(new Set([...layoutActive, ...segmentsActive]));
    
    if (nextActive && activeDeviceIds.length === 0) {
      alert('Please map at least one active controller or segment zone before syncing.');
      return;
    }

    try {
      const res = await fetch('/api/sync/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_ids: activeDeviceIds,
          active: nextActive,
          mode: syncMode,
          fps: parseInt(syncFps),
          monitor_idx: parseInt(monitorIdx)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSyncActive(data.active);
      }
    } catch (err) {
      console.error('Failed to toggle screen sync:', err);
    }
  };

  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [255, 255, 255];
  };

  const rgbToHex = (r, g, b) => {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  };

  const handlePaintPixel = (idx) => {
    const rgb = hexToRgb(paintColor);
    setLedColors(prev => {
      const next = [...prev];
      next[idx] = rgb;
      return next;
    });
    paintDirtyRef.current = true;
  };

  const handlePixelMouseEnter = (idx) => {
    if (isDrawing) {
      handlePaintPixel(idx);
    }
  };

  const fillAllPixels = () => {
    const rgb = hexToRgb(paintColor);
    setLedColors(prev => prev.map(() => rgb));
    paintDirtyRef.current = true;
  };

  const clearAllPixels = () => {
    setLedColors(prev => prev.map(() => [0, 0, 0]));
    paintDirtyRef.current = true;
  };

  const selectedDev = devices.find(d => d.id === selectedDeviceId);
  
  const isZoneActive = (zone) => {
    if (!syncActive) return false;
    // Check if any device has this zone mapped in general layout
    const inLayout = Object.keys(layoutMapping).some(devId => {
      const hasSegs = wledSegments[devId] && wledSegments[devId].length > 0;
      // If segment mapping is active for this device, ignore layout mapping
      return !hasSegs && layoutMapping[devId] === zone;
    });
    if (inLayout) return true;
    
    // Check if any WLED device has this zone in its active segments
    const inSegments = Object.keys(wledSegments).some(devId => {
      const segs = wledSegments[devId] || [];
      return segs.some(seg => seg.zone === zone);
    });
    return inSegments;
  };

  return (
    <div className="app-wrapper">
      
      {/* BRAND HEADER */}
      <header className="app-header">
        <div className="brand-section">
          <div className="logo-icon-wrapper">
            <Lightbulb style={{ width: '1.4rem', height: '1.4rem', color: '#fff' }} />
          </div>
          <div className="brand-title-group">
            <h1>SPECTRASTRIKE HUB</h1>
            <p>Combat Ambient & Game Lighting Dashboard</p>
          </div>
        </div>

        <div className="header-controls">
          {scanMessage && (
            <div className={`status-badge ${loadingScan ? 'active' : ''}`}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: loadingScan ? '#22d3ee' : '#f43f5e', display: 'inline-block' }}></span>
              <span>{scanMessage}</span>
            </div>
          )}
          
          <button
            onClick={triggerScan}
            disabled={loadingScan}
            className="btn"
          >
            <RefreshCw style={{ width: '1rem', height: '1rem', color: '#06b6d4' }} className={loadingScan ? 'animate-spin' : ''} />
            <span>{loadingScan ? 'Scanning...' : 'Scan Subnets'}</span>
          </button>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className={`btn btn-icon ${showAddForm ? 'active' : ''}`}
          >
            <Plus style={{ width: '1.2rem', height: '1.2rem' }} />
          </button>
        </div>
      </header>

      {/* MANUAL CONTROLLER REGISTRATION */}
      {showAddForm && (
        <div className="add-form-panel">
          <h3 style={{ fontSize: '0.9rem', fontWeight: '700', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus style={{ width: '1.1rem', height: '1.1rem' }} />
            <span>Add Physical Controller Manually</span>
          </h3>
          
          <form onSubmit={handleAddDevice}>
            <div className="form-row">
              <div className="form-group">
                <label>IP Address</label>
                <input
                  type="text"
                  placeholder="e.g. 192.168.1.150"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  required
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label>Device Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  className="select-dropdown"
                  style={{ width: '100%', padding: '0.6rem 0.8rem' }}
                >
                  <option value="wled">WLED Controller</option>
                  <option value="wiz">Philips WiZ Bulb</option>
                </select>
              </div>
              {newType === 'wled' ? (
                <div className="form-group">
                  <label>Total LEDs</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newLedCount}
                    onChange={(e) => setNewLedCount(e.target.value)}
                    className="input-field"
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Custom Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Bedside Bulb"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="input-field"
                  />
                </div>
              )}
              <div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '2.5rem' }}>
                  Register Controller
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* DASHBOARD LAYOUT */}
      <main className="dashboard-grid">
        
        {/* COLUMN 1: SIDEBAR CONTROLLERS */}
        <section className="sidebar-column">
          
          {/* DEVICES BOX */}
          <div className="glass-card">
            <div className="card-title-bar">
              <h2 className="card-title">Active Controllers</h2>
              <span className="tag">{devices.length} Devices</span>
            </div>

            <div className="device-list">
              {devices.length === 0 ? (
                <div className="customizer-empty-panel" style={{ padding: '2.5rem 1rem', border: '1px dashed rgba(255,255,255,0.06)' }}>
                  <AlertCircle style={{ width: '2rem', height: '2rem', color: '#64748b', marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '0.8rem' }}>No physical controllers detected yet.</p>
                  <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>Click "Scan Subnets" or manually register IPs.</p>
                </div>
              ) : (
                devices.map(dev => {
                  const isSelected = selectedDeviceId === dev.id;
                  const power = dev.state?.on || false;
                  const bri = Math.round(((dev.state?.bri || 0) / 255) * 100);
                  const activeColor = dev.state?.color 
                    ? `rgb(${dev.state.color[0]}, ${dev.state.color[1]}, ${dev.state.color[2]})` 
                    : '#fff';

                  return (
                    <div
                      key={dev.id}
                      onClick={() => handleDeviceSelect(dev.id)}
                      className={`device-card ${isSelected ? 'selected' : ''} ${power ? 'active' : ''}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStartDevice(e, dev.id)}
                    >
                      <div className="device-card-left">
                        <div 
                          className="device-icon-halo"
                          style={{ 
                            background: power ? `rgba(${dev.state?.color?.[0] || 168}, ${dev.state?.color?.[1] || 85}, ${dev.state?.color?.[2] || 247}, 0.12)` : undefined,
                            borderColor: power ? activeColor : undefined
                          }}
                        >
                          <Lightbulb style={{ width: '1.1rem', height: '1.1rem', color: power ? activeColor : '#64748b' }} />
                        </div>
                        <div className="device-card-info">
                          <h4>{dev.name}</h4>
                          <p>{dev.ip}</p>
                          <div className="device-tags">
                            <span className="tag">{dev.type}</span>
                            {power && <span className="tag-active-info">{bri}% Brightness</span>}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          controlDeviceState(dev.id, { on: !power });
                        }}
                        className={`power-toggle-btn ${power ? 'active' : ''}`}
                        style={{ width: '2rem', height: '2rem', borderRadius: '8px' }}
                      >
                        <Power style={{ width: '0.9rem', height: '0.9rem' }} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* SCREEN SYNC & LAYOUT */}
          <div className="glass-card">
            <div className="card-title-bar">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Tv style={{ width: '1.1rem', height: '1.1rem', color: '#06b6d4' }} />
                <span>Screen Ambient Sync</span>
              </h2>
              <span className={`status-badge ${syncActive ? 'active' : ''}`} style={{ padding: '0.2rem 0.5rem', fontSize: '0.65rem' }}>
                {syncActive ? 'Active' : 'Offline'}
              </span>
            </div>

            {/* Monitor Mockup Layout */}
            <div className="monitor-mockup-area">
              <div className="monitor-frame">
                <div className="monitor-inner">
                  <div
                    className={`sync-border-left ${isZoneActive('left') ? 'active' : ''} ${draggedOverZone === 'left' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('left')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'left')}
                  ></div>
                  <div
                    className={`sync-border-top ${isZoneActive('top') ? 'active' : ''} ${draggedOverZone === 'top' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('top')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'top')}
                  ></div>
                  <div
                    className={`sync-border-right ${isZoneActive('right') ? 'active' : ''} ${draggedOverZone === 'right' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('right')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'right')}
                  ></div>
                  <div
                    className={`sync-border-bottom ${isZoneActive('bottom') ? 'active' : ''} ${draggedOverZone === 'bottom' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('bottom')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'bottom')}
                  ></div>
                  <div
                    className={`sync-inner-center ${isZoneActive('center') ? 'active' : ''} ${draggedOverZone === 'center' ? 'drag-hover' : ''}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setDraggedOverZone('center')}
                    onDragLeave={() => setDraggedOverZone(null)}
                    onDrop={(e) => handleDropOnZone(e, 'center')}
                  ></div>

                  <Monitor style={{ width: '1.75rem', height: '1.75rem', color: syncActive ? '#06b6d4' : '#334155' }} />
                  <span style={{ fontSize: '0.55rem', fontFamily: 'monospace', marginTop: '4px' }}>MONITOR {monitorIdx}</span>
                  {syncActive && <span className="monitor-status-text">AMBIENT STREAMING</span>}
                </div>
              </div>
            </div>

            {/* Mapping Config Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="slider-group-grid">
                <div className="form-group">
                  <label>Frequency Rate</label>
                  <select
                    value={syncFps}
                    onChange={(e) => setSyncFps(e.target.value)}
                    disabled={syncActive}
                    className="select-dropdown"
                  >
                    <option value="10">10 FPS</option>
                    <option value="15">15 FPS</option>
                    <option value="20">20 FPS</option>
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Sync Sampling Mode</label>
                  <select
                    value={syncMode}
                    onChange={(e) => setSyncMode(e.target.value)}
                    disabled={syncActive}
                    className="select-dropdown"
                  >
                    <option value="average">Whole Average</option>
                    <option value="border">Border Frames</option>
                  </select>
                </div>
              </div>

              {/* Mappings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <h4 className="layout-matrix-title">Zone Assignments</h4>
                <div className="mapping-list">
                  {devices.length === 0 ? (
                    <p style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center', padding: '1rem' }}>No controllers to assign.</p>
                  ) : (
                    devices.map(dev => {
                      const currentZone = layoutMapping[dev.id] || 'none';
                      const hasSegments = wledSegments[dev.id] && wledSegments[dev.id].length > 0;
                      return (
                        <div key={dev.id} className="mapping-row">
                          <span>{dev.name}</span>
                          {hasSegments ? (
                            <span style={{ fontSize: '0.7rem', color: '#c4b5fd', fontWeight: '700', textTransform: 'uppercase' }}>
                              {wledSegments[dev.id].length} Zones Mapped
                            </span>
                          ) : (
                            <select
                              value={currentZone}
                              onChange={(e) => handleLayoutChange(dev.id, e.target.value === 'none' ? '' : e.target.value)}
                              className="select-dropdown"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <option value="none">Disabled</option>
                              <option value="left">Left Edge</option>
                              <option value="top">Top Edge</option>
                              <option value="right">Right Edge</option>
                              <option value="bottom">Bottom Edge</option>
                              <option value="center">Center / Inside</option>
                            </select>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <button
                onClick={toggleScreenSync}
                className="btn btn-primary"
                style={{ 
                  width: '100%', 
                  padding: '0.75rem', 
                  borderRadius: '12px',
                  background: syncActive ? 'rgba(244, 63, 94, 0.15)' : undefined,
                  borderColor: syncActive ? 'var(--accent-rose)' : undefined,
                  color: syncActive ? '#fecdd3' : undefined,
                  boxShadow: syncActive ? 'none' : undefined
                }}
              >
                <Tv style={{ width: '1rem', height: '1rem' }} />
                <span>{syncActive ? 'Stop Sync Stream' : 'Start Sync Stream'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* COLUMN 2: CUSTOMIZER DETAIL PANEL */}
        <section className="main-column">
          {!selectedDev ? (
            <div className="customizer-empty-panel">
              <Layout style={{ width: '2.5rem', height: '2.5rem', color: '#64748b' }} />
              <h3>No Device Selected</h3>
              <p>Choose an active lighting controller from the list on the left to customize colors, settings, effects, or paint grids.</p>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', minHeight: '520px', gap: 0 }}>
              
              {/* Header Tab panel */}
              <div className="customizer-header">
                <div className="customizer-title-area">
                  <h2>{selectedDev.name}</h2>
                  <p>{selectedDev.ip}</p>
                </div>

                <div className="customizer-toggle-controls">
                  {selectedDev.type === 'wled' && (
                    <div className="toggle-switch-tab-bar">
                      <button
                        onClick={() => setActiveTab('control')}
                        className={`toggle-tab-btn ${activeTab === 'control' ? 'active' : ''}`}
                      >
                        Control Panel
                      </button>
                      <button
                        onClick={() => setActiveTab('paint')}
                        className={`toggle-tab-btn ${activeTab === 'paint' ? 'active' : ''}`}
                      >
                        Paint Brush
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => controlDeviceState(selectedDev.id, { on: !selectedDev.state?.on })}
                    className={`power-toggle-btn ${selectedDev.state?.on ? 'active' : ''}`}
                  >
                    <Power style={{ width: '1.1rem', height: '1.1rem' }} />
                  </button>
                </div>
              </div>

              {/* Main controls body */}
              <div className="customizer-body">
                
                {activeTab === 'control' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    
                    {/* Brightness Slider */}
                    <div className="control-row">
                      <div className="control-label-wrapper">
                        <label>Brightness Level</label>
                        <span className="control-value-text">
                          {Math.round(((selectedDev.state?.bri || 0) / 255) * 100)}%
                        </span>
                      </div>
                      <div className="slider-input-wrapper">
                        <Sun style={{ width: '1rem', height: '1rem' }} />
                        <input
                          type="range"
                          min="0"
                          max="255"
                          value={selectedDev.state?.bri || 0}
                          onChange={(e) => controlDeviceState(selectedDev.id, { bri: parseInt(e.target.value) })}
                          className="slider-range-bar"
                        />
                      </div>
                    </div>

                    {/* Color customizers */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      
                      {/* Pickers */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Solid Color</label>
                        <div className="color-picker-box">
                          <input
                            type="color"
                            value={rgbToHex(
                              selectedDev.state?.color?.[0] || 255,
                              selectedDev.state?.color?.[1] || 255,
                              selectedDev.state?.color?.[2] || 255
                            )}
                            onChange={(e) => {
                              const rgb = hexToRgb(e.target.value);
                              controlDeviceState(selectedDev.id, { color: rgb });
                            }}
                            className="color-input-circle"
                          />
                          <div className="color-picker-details">
                            <h5>Color Selector</h5>
                            <p>RGB: {selectedDev.state?.color?.join(', ') || '255, 255, 255'}</p>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="quick-colors-palette">
                          {['#a855f7', '#06b6d4', '#ec4899', '#f97316', '#22c55e', '#ef4444', '#eab308'].map(hex => (
                            <button
                              key={hex}
                              onClick={() => controlDeviceState(selectedDev.id, { color: hexToRgb(hex) })}
                              className="quick-color-dot"
                              style={{ backgroundColor: hex }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Device Dependent settings */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        
                        {/* WLED dropdown */}
                        {selectedDev.type === 'wled' && (
                          <div className="form-group">
                            <label>Presets & Effects</label>
                            <div style={{ position: 'relative' }}>
                              <select
                                value={selectedDev.state?.fx || 0}
                                onChange={(e) => controlDeviceState(selectedDev.id, { fx: parseInt(e.target.value) })}
                                className="select-dropdown"
                                style={{ width: '100%', padding: '0.6rem 0.8rem', paddingRight: '2rem' }}
                              >
                                {PRESET_EFFECTS.map(fx => (
                                  <option key={fx.id} value={fx.id}>{fx.name}</option>
                                ))}
                              </select>
                              <ChevronDown style={{ width: '1rem', height: '1rem', position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
                            </div>
                          </div>
                        )}

                        {/* WiZ Temp */}
                        {selectedDev.type === 'wiz' && (
                          <div className="control-row" style={{ marginBottom: 0 }}>
                            <div className="control-label-wrapper">
                              <label>White Balance</label>
                              <span className="control-value-text">{selectedDev.state?.temp || 4000}K</span>
                            </div>
                            <div className="slider-input-wrapper" style={{ marginTop: '0.25rem' }}>
                              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#f59e0b' }}>Warm</span>
                              <input
                                type="range"
                                min="2200"
                                max="6500"
                                step="100"
                                value={selectedDev.state?.temp || 4000}
                                onChange={(e) => controlDeviceState(selectedDev.id, { temp: parseInt(e.target.value) })}
                                className="slider-range-bar"
                              />
                              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#22d3ee' }}>Cool</span>
                            </div>
                          </div>
                        )}

                        {/* OpenRGB Panel Info */}
                        {selectedDev.type === 'openrgb' && (
                          <div style={{ padding: '1rem', background: 'rgba(2, 6, 23, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#22d3ee', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                              <Cpu style={{ width: '0.9rem', height: '0.9rem' }} />
                              <span>SDK Broadcaster</span>
                            </div>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
                              OpenRGB sync commands will automatically broadcast to motherboard nodes, RAM modules, fan pins, and peripheral components.
                            </p>
                          </div>
                        )}

                        {/* Windows Dynamic Lighting Panel Info */}
                        {selectedDev.type === 'wdl' && (
                          <div style={{ padding: '1rem', background: 'rgba(2, 6, 23, 0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#22d3ee', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase' }}>
                              <Cpu style={{ width: '0.9rem', height: '0.9rem' }} />
                              <span>Windows Dynamic Lighting</span>
                            </div>
                            <p style={{ fontSize: '0.7rem', color: '#94a3b8', lineHeight: '1.4' }}>
                              Windows.Devices.Lights integration. Colors and brightness adjustments will apply natively to all motherboards, RAM, fans, and HID lighting arrays managed by Windows OS.
                            </p>
                          </div>
                        )}
                      </div>

                    </div>
                    
                    {/* WLED Multi-Zone segment manager */}
                    {selectedDev.type === 'wled' && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Layers style={{ width: '1.1rem', height: '1.1rem', color: '#a855f7' }} />
                            <div>
                              <h4 style={{ fontSize: '0.85rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-main)' }}>
                                Multi-Zone LED Segment Sync
                              </h4>
                              <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Map different WLED LED ranges to different screen coordinates
                              </p>
                            </div>
                          </div>
                          <label className="switch-container" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={(wledSegments[selectedDev.id] && wledSegments[selectedDev.id].length > 0) || false}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  handleAddSegment(selectedDev.id, 0, selectedDev.led_count || 30, 'center');
                                } else {
                                  saveSegmentsMapping(selectedDev.id, []);
                                }
                              }}
                              style={{ display: 'none' }}
                            />
                            <span className={`toggle-switch-slider ${((wledSegments[selectedDev.id] && wledSegments[selectedDev.id].length > 0) ? 'active' : '')}`}
                                  style={{
                                    width: '2.5rem',
                                    height: '1.25rem',
                                    backgroundColor: (wledSegments[selectedDev.id] && wledSegments[selectedDev.id].length > 0) ? 'var(--accent-purple)' : 'rgba(255,255,255,0.1)',
                                    borderRadius: '999px',
                                    display: 'block',
                                    position: 'relative',
                                    transition: 'all 0.2s'
                                  }}
                            >
                              <span style={{
                                width: '1rem',
                                height: '1rem',
                                backgroundColor: '#fff',
                                borderRadius: '50%',
                                position: 'absolute',
                                top: '2px',
                                left: (wledSegments[selectedDev.id] && wledSegments[selectedDev.id].length > 0) ? '1.3rem' : '2px',
                                transition: 'all 0.2s'
                              }}></span>
                            </span>
                          </label>
                        </div>
                        
                        {(wledSegments[selectedDev.id] && wledSegments[selectedDev.id].length > 0) && (
                          <div className="segment-manager">
                            <div className="segment-manager-header">
                              <h4>Active Strip Divisions</h4>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Drag rows onto Monitor Zones to map them!</span>
                            </div>
                            
                            <div className="segment-list">
                              {wledSegments[selectedDev.id].map((seg, idx) => (
                                <div
                                  key={idx}
                                  draggable={true}
                                  onDragStart={(e) => handleDragStartSegment(e, selectedDev.id, idx)}
                                  className="segment-item-row"
                                >
                                  <div className="segment-drag-handle">
                                    <Layers style={{ width: '0.9rem', height: '0.9rem', marginRight: '0.25rem', color: '#a855f7' }} />
                                    <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Segment {idx + 1}</span>
                                  </div>
                                  
                                  <div className="segment-info-fields">
                                    <span className="segment-range-badge">LED {seg.start} - {seg.end}</span>
                                    <span className="segment-zone-badge">{seg.zone}</span>
                                  </div>
                                  
                                  <button
                                    onClick={() => handleDeleteSegment(selectedDev.id, idx)}
                                    className="btn"
                                    style={{ width: '1.75rem', height: '1.75rem', padding: 0, border: 'none', background: 'transparent', color: '#f43f5e' }}
                                  >
                                    <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            
                            {/* Add segment form */}
                            <div className="segment-inputs-grid">
                              <div className="form-group">
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Start LED</label>
                                <input
                                  type="number"
                                  min="0"
                                  max={selectedDev.led_count - 1}
                                  value={segStart}
                                  onChange={(e) => setSegStart(parseInt(e.target.value) || 0)}
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', height: '2rem' }}
                                />
                              </div>
                              <div className="form-group">
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>End LED</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={selectedDev.led_count}
                                  value={segEnd}
                                  onChange={(e) => setSegEnd(parseInt(e.target.value) || 0)}
                                  className="input-field"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', height: '2rem' }}
                                />
                              </div>
                              <div className="form-group">
                                <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Zone</label>
                                <select
                                  value={segZone}
                                  onChange={(e) => setSegZone(e.target.value)}
                                  className="select-dropdown"
                                  style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', width: '100%', height: '2rem' }}
                                >
                                  <option value="left">Left Edge</option>
                                  <option value="top">Top Edge</option>
                                  <option value="right">Right Edge</option>
                                  <option value="bottom">Bottom Edge</option>
                                  <option value="center">Center</option>
                                </select>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (segStart >= segEnd) {
                                    alert("Start LED must be less than End LED");
                                    return;
                                  }
                                  if (segEnd > selectedDev.led_count) {
                                    alert(`End LED cannot exceed total strip length (${selectedDev.led_count})`);
                                    return;
                                  }
                                  handleAddSegment(selectedDev.id, segStart, segEnd, segZone);
                                }}
                                className="btn btn-primary"
                                style={{ height: '2rem', padding: '0 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Collapsible Advanced Settings Drawer */}
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                        className="btn"
                        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', background: 'rgba(30, 41, 59, 0.2)', borderRadius: '10px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Sliders style={{ width: '1rem', height: '1rem', color: '#06b6d4' }} />
                          <span style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-main)' }}>
                            Advanced Device Settings (Calibration)
                          </span>
                        </div>
                        <ChevronDown style={{ width: '1rem', height: '1rem', transform: showAdvancedSettings ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', color: '#64748b' }} />
                      </button>

                      {showAdvancedSettings && (
                        <div className="segment-manager" style={{ marginTop: '0.75rem', animation: 'slideDown 0.2s ease-out forwards' }}>
                          <div className="segment-manager-header" style={{ marginBottom: '0.5rem' }}>
                            <h4 style={{ color: '#06b6d4' }}>TrueColor Color Alignment</h4>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Match perceived channel colors for extreme accuracy</span>
                          </div>

                          {/* Quick test white/black buttons */}
                          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <button
                              type="button"
                              onClick={() => controlDeviceState(selectedDev.id, { color: [255, 255, 255], on: true })}
                              className="btn"
                              style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.05)' }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff', boxShadow: '0 0 4px #ffffff' }}></span>
                              Test White (255, 255, 255)
                            </button>
                            <button
                              type="button"
                              onClick={() => controlDeviceState(selectedDev.id, { color: [0, 0, 0], on: true })}
                              className="btn"
                              style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.65rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.05)' }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#020617', border: '1px solid #64748b' }}></span>
                              Test Black (0, 0, 0)
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', background: 'rgba(2, 6, 23, 0.2)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                            {/* RED */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.6rem', fontWeight: '700', color: '#ef4444', textTransform: 'uppercase' }}>Red Channel</label>
                              <button
                                type="button"
                                onClick={() => controlDeviceState(selectedDev.id, { color: [255, 0, 0], on: true })}
                                className="btn"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', width: '100%' }}
                              >
                                Test Red
                              </button>
                              <input
                                type="color"
                                value={calRedSeen}
                                onChange={(e) => setCalRedSeen(e.target.value)}
                                style={{ width: '2rem', height: '2rem', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '0.2rem' }}
                              />
                            </div>

                            {/* GREEN */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.6rem', fontWeight: '700', color: '#22c55e', textTransform: 'uppercase' }}>Green Channel</label>
                              <button
                                type="button"
                                onClick={() => controlDeviceState(selectedDev.id, { color: [0, 255, 0], on: true })}
                                className="btn"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', width: '100%' }}
                              >
                                Test Green
                              </button>
                              <input
                                type="color"
                                value={calGreenSeen}
                                onChange={(e) => setCalGreenSeen(e.target.value)}
                                style={{ width: '2rem', height: '2rem', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '0.2rem' }}
                              />
                            </div>

                            {/* BLUE */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.6rem', fontWeight: '700', color: '#3b82f6', textTransform: 'uppercase' }}>Blue Channel</label>
                              <button
                                type="button"
                                onClick={() => controlDeviceState(selectedDev.id, { color: [0, 0, 255], on: true })}
                                className="btn"
                                style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem', width: '100%' }}
                              >
                                Test Blue
                              </button>
                              <input
                                type="color"
                                value={calBlueSeen}
                                onChange={(e) => setCalBlueSeen(e.target.value)}
                                style={{ width: '2rem', height: '2rem', background: 'transparent', border: 'none', cursor: 'pointer', marginTop: '0.2rem' }}
                              />
                            </div>
                          </div>

                          {/* Extra Calibration Settings */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '1rem' }}>
                            {/* Gamma correction */}
                            <div className="control-row" style={{ marginBottom: 0 }}>
                              <div className="control-label-wrapper">
                                <label style={{ fontSize: '0.65rem' }}>Gamma Correction Curve</label>
                                <span className="control-value-text" style={{ fontSize: '0.75rem' }}>{parseFloat(calGamma).toFixed(1)}</span>
                              </div>
                              <input
                                type="range"
                                min="1.0"
                                max="3.0"
                                step="0.1"
                                value={calGamma}
                                onChange={(e) => setCalGamma(parseFloat(e.target.value))}
                                className="slider-range-bar"
                              />
                            </div>

                            {/* Color Temperature */}
                            <div className="control-row" style={{ marginBottom: 0 }}>
                              <div className="control-label-wrapper">
                                <label style={{ fontSize: '0.65rem' }}>Color Temperature (Kelvin)</label>
                                <span className="control-value-text" style={{ fontSize: '0.75rem' }}>{calTemp}K</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.6rem', color: '#f59e0b', fontWeight: 'bold' }}>2000K (Warm)</span>
                                <input
                                  type="range"
                                  min="2000"
                                  max="10000"
                                  step="250"
                                  value={calTemp}
                                  onChange={(e) => setCalTemp(parseInt(e.target.value))}
                                  className="slider-range-bar"
                                />
                                <span style={{ fontSize: '0.6rem', color: '#67e8f9', fontWeight: 'bold' }}>10000K (Cool)</span>
                              </div>
                            </div>

                            {/* Black Level Calibration */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Black Level Calibration (Min Offsets)</label>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#ef4444', width: '3.5rem', fontWeight: 'bold' }}>Red Min</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={calMinR}
                                    onChange={(e) => setCalMinR(parseInt(e.target.value))}
                                    className="slider-range-bar"
                                    style={{ height: '4px' }}
                                  />
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '1.5rem', textAlign: 'right' }}>{calMinR}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#22c55e', width: '3.5rem', fontWeight: 'bold' }}>Green Min</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={calMinG}
                                    onChange={(e) => setCalMinG(parseInt(e.target.value))}
                                    className="slider-range-bar"
                                    style={{ height: '4px' }}
                                  />
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '1.5rem', textAlign: 'right' }}>{calMinG}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#3b82f6', width: '3.5rem', fontWeight: 'bold' }}>Blue Min</span>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={calMinB}
                                    onChange={(e) => setCalMinB(parseInt(e.target.value))}
                                    className="slider-range-bar"
                                    style={{ height: '4px' }}
                                  />
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '1.5rem', textAlign: 'right' }}>{calMinB}</span>
                                </div>
                              </div>
                            </div>

                            {/* White Balance Limits */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                              <label style={{ fontSize: '0.65rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>White Balance Calibration (Max Limits)</label>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#ef4444', width: '3.5rem', fontWeight: 'bold' }}>Red Max</span>
                                  <input
                                    type="range"
                                    min="100"
                                    max="255"
                                    value={calMaxR}
                                    onChange={(e) => setCalMaxR(parseInt(e.target.value))}
                                    className="slider-range-bar"
                                    style={{ height: '4px' }}
                                  />
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '1.5rem', textAlign: 'right' }}>{calMaxR}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#22c55e', width: '3.5rem', fontWeight: 'bold' }}>Green Max</span>
                                  <input
                                    type="range"
                                    min="100"
                                    max="255"
                                    value={calMaxG}
                                    onChange={(e) => setCalMaxG(parseInt(e.target.value))}
                                    className="slider-range-bar"
                                    style={{ height: '4px' }}
                                  />
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '1.5rem', textAlign: 'right' }}>{calMaxG}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#3b82f6', width: '3.5rem', fontWeight: 'bold' }}>Blue Max</span>
                                  <input
                                    type="range"
                                    min="100"
                                    max="255"
                                    value={calMaxB}
                                    onChange={(e) => setCalMaxB(parseInt(e.target.value))}
                                    className="slider-range-bar"
                                    style={{ height: '4px' }}
                                  />
                                  <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', width: '1.5rem', textAlign: 'right' }}>{calMaxB}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginTop: '0.5rem' }}>
                            <button
                              type="button"
                              onClick={() => saveDeviceCalibration(selectedDev.id, calRedSeen, calGreenSeen, calBlueSeen, calGamma, calMinR, calMinG, calMinB, calMaxR, calMaxG, calMaxB, calTemp)}
                              className="btn btn-primary"
                              style={{ flex: 2, height: '2.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              Save & Apply Calibration
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setCalRedSeen('#ff0000');
                                setCalGreenSeen('#00ff00');
                                setCalBlueSeen('#0000ff');
                                setCalGamma(2.2);
                                setCalMinR(0);
                                setCalMinG(0);
                                setCalMinB(0);
                                setCalMaxR(255);
                                setCalMaxG(255);
                                setCalMaxB(255);
                                setCalTemp(6500);
                                saveDeviceCalibration(selectedDev.id, '#ff0000', '#00ff00', '#0000ff', 2.2, 0, 0, 0, 255, 255, 255, 6500);
                              }}
                              className="btn"
                              style={{ flex: 1, height: '2.25rem', fontSize: '0.75rem', borderColor: 'rgba(244, 63, 94, 0.3)', color: '#f43f5e', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {activeTab === 'paint' && selectedDev.type === 'wled' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    
                    {/* Brush control */}
                    <div className="paint-controls-bar">
                      <div className="brush-color-picker">
                        <input
                          type="color"
                          value={paintColor}
                          onChange={(e) => setPaintColor(e.target.value)}
                          style={{
                            width: '2.25rem',
                            height: '2.25rem',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer'
                          }}
                        />
                        <div>
                          <h6>Brush Selector</h6>
                          <p>Current Color: {paintColor}</p>
                        </div>
                      </div>

                      <div className="paint-actions-row">
                        <button onClick={fillAllPixels} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
                          Fill All
                        </button>
                        <button onClick={clearAllPixels} className="btn" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', color: '#f43f5e' }}>
                          Erase All
                        </button>
                      </div>
                    </div>

                    {/* Paint Brush LED Grid */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                        Interactive LED Node Grid ({selectedDev.led_count || 30} pixels)
                      </label>
                      
                      <div 
                        className="pixel-grid-canvas"
                        onMouseDown={() => setIsDrawing(true)}
                        onMouseUp={() => setIsDrawing(false)}
                        onMouseLeave={() => setIsDrawing(false)}
                      >
                        {ledColors.map((color, idx) => {
                          const dotColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                          const hasColor = color[0] > 0 || color[1] > 0 || color[2] > 0;
                          
                          return (
                            <div
                              key={idx}
                              onMouseDown={() => handlePaintPixel(idx)}
                              onMouseEnter={() => handlePixelMouseEnter(idx)}
                              className="pixel-node-dot"
                              style={{ 
                                backgroundColor: hasColor ? dotColor : 'rgba(30, 41, 59, 0.25)',
                                border: hasColor ? '1.5px solid rgba(255, 255, 255, 0.45)' : '1.5px solid rgba(255, 255, 255, 0.05)',
                                boxShadow: hasColor ? `0 0 10px ${dotColor}` : undefined,
                                color: (color[0] + color[1] + color[2]) > 380 ? '#0f172a' : '#fff'
                              }}
                            >
                              {idx + 1}
                            </div>
                          );
                        })}
                      </div>

                      <div className="paint-info-footer">
                        <AlertCircle style={{ width: '0.9rem', height: '0.9rem' }} />
                        <span>Streams are throttled to ~14 FPS for extreme smooth network performance</span>
                      </div>
                    </div>

                  </div>
                )}
                
              </div>

            </div>
          )}
        </section>

      </main>
    </div>
  );
}
