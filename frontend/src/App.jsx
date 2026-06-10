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
  Check,
  AlertCircle,
  Power,
  Sliders,
  Monitor,
  Layout,
  ChevronDown,
  Sparkles,
  Users,
  Palette,
  Clock,
  Activity,
  Zap,
  Play,
  Save,
  Wand2
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

  const [stats, setStats] = useState({ device_count: 0, devices_on: 0, total_leds: 0, type_counts: {}, scene_count: 0, group_count: 0, schedule_count: 0, active_schedules: 0, sync: { active: false, fps_target: 0, fps_actual: 0, frames: 0, device_ids: [] }, uptime_seconds: 0 });
  const [scenes, setScenes] = useState([]);
  const [groups, setGroups] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [paletteScheme, setPaletteScheme] = useState('analogous');
  const [paletteBase, setPaletteBase] = useState('#a855f7');
  const [paletteResults, setPaletteResults] = useState([]);
  const [paletteMessage, setPaletteMessage] = useState('');

  const [newSceneName, setNewSceneName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [groupDeviceIds, setGroupDeviceIds] = useState([]);
  const [expandedGroupId, setExpandedGroupId] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupDeviceIds, setEditingGroupDeviceIds] = useState([]);
  const [groupBri, setGroupBri] = useState({});
  const [groupColor, setGroupColor] = useState({});
  const [groupFx, setGroupFx] = useState({});
  const [newScheduleName, setNewScheduleName] = useState('');
  const [scheduleTime, setScheduleTime] = useState('20:00');
  const [scheduleDays, setScheduleDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [scheduleAction, setScheduleAction] = useState('on');
  const [scheduleTarget, setScheduleTarget] = useState('all');
  const [scheduleSceneId, setScheduleSceneId] = useState('');

  const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Fetch devices periodically
  useEffect(() => {
    fetchDevices();
    fetchSyncStatus();
    fetchLayoutMapping();
    fetchSegmentsMapping();
    fetchStats();
    fetchScenes();
    fetchGroups();
    fetchSchedules();

    const interval = setInterval(() => {
      fetchDevices(true);
      fetchSyncStatus(true);
      fetchStats(true);
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

  const fetchStats = async (silent = false) => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      if (!silent) console.error('Error fetching stats:', err);
    }
  };

  const fetchScenes = async () => {
    try {
      const res = await fetch('/api/scenes');
      if (res.ok) {
        const data = await res.json();
        setScenes(data);
      }
    } catch (err) {
      console.error('Error fetching scenes:', err);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchSchedules = async () => {
    try {
      const res = await fetch('/api/schedules');
      if (res.ok) {
        const data = await res.json();
        setSchedules(data);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
    }
  };

  const generatePalette = async () => {
    try {
      const baseValue = paletteBase.replace('#', '');
      const res = await fetch(`/api/palette/generate?base=${encodeURIComponent(baseValue)}&scheme=${encodeURIComponent(paletteScheme)}`);
      if (res.ok) {
        const data = await res.json();
        setPaletteResults(data.colors || []);
        setPaletteMessage(`Generated ${data.scheme} palette`);
      } else {
        setPaletteMessage('Palette generation failed');
      }
    } catch (err) {
      console.error('Palette request failed:', err);
      setPaletteMessage('Palette service unavailable');
    }
  };

  const saveScene = async () => {
    if (!newSceneName.trim()) {
      alert('Scene name is required');
      return;
    }

    const states = {};
    devices.forEach(dev => {
      if (dev.state) {
        states[dev.id] = {
          on: dev.state.on,
          bri: dev.state.bri,
          color: dev.state.color,
          fx: dev.state.fx,
          temp: dev.state.temp
        };
      }
    });

    try {
      const res = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSceneName, icon: 'sparkles', states })
      });
      if (res.ok) {
        setNewSceneName('');
        fetchScenes();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || 'Unable to save scene');
      }
    } catch (err) {
      console.error('Failed to save scene:', err);
    }
  };

  const applyScene = async (sceneId) => {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/apply`, { method: 'POST' });
      if (res.ok) {
        fetchDevices();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to apply scene:', err);
    }
  };

  const deleteScene = async (sceneId) => {
    try {
      const res = await fetch(`/api/scenes/${sceneId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchScenes();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete scene:', err);
    }
  };

  const toggleGroupDevice = (deviceId) => {
    setGroupDeviceIds(prev => prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]);
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      alert('Group name is required');
      return;
    }
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newGroupName, device_ids: groupDeviceIds })
      });
      if (res.ok) {
        setNewGroupName('');
        setGroupDeviceIds([]);
        fetchGroups();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || 'Unable to create group');
      }
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const controlGroup = async (groupId, payload) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        fetchDevices();
        fetchGroups();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to control group:', err);
    }
  };

  const deleteGroup = async (groupId) => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        if (expandedGroupId === groupId) setExpandedGroupId(null);
        fetchGroups();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  };

  const updateGroup = async (groupId, patch) => {
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      if (res.ok) {
        fetchGroups();
        setEditingGroupId(null);
      } else {
        const err = await res.json();
        alert(err.detail || 'Unable to update group');
      }
    } catch (err) {
      console.error('Failed to update group:', err);
    }
  };

  const startEditingGroup = (group) => {
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
    setEditingGroupDeviceIds([...(group.device_ids || [])]);
  };

  const toggleEditingDevice = (deviceId) => {
    setEditingGroupDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  const allGroupWled = (group) =>
    (group.device_ids || []).every(id => {
      const dev = devices.find(d => d.id === id);
      return dev && dev.type === 'wled';
    });

  const toggleScheduleDay = (dayIndex) => {
    setScheduleDays(prev => prev.includes(dayIndex) ? prev.filter(d => d !== dayIndex) : [...prev, dayIndex]);
  };

  const createSchedule = async () => {
    if (!newScheduleName.trim() || !scheduleTime) {
      alert('Schedule name and time are required');
      return;
    }
    if (scheduleAction === 'scene' && !scheduleSceneId) {
      alert('Please select a scene for the scene action');
      return;
    }
    try {
      const body = {
        name: newScheduleName,
        time: scheduleTime,
        days: scheduleDays,
        action: scheduleAction,
        target: scheduleTarget
      };
      if (scheduleAction === 'scene') {
        body.scene_id = scheduleSceneId;
      }
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setNewScheduleName('');
        setScheduleTime('20:00');
        setScheduleDays([0, 1, 2, 3, 4, 5, 6]);
        setScheduleAction('on');
        setScheduleTarget('all');
        setScheduleSceneId('');
        fetchSchedules();
        fetchStats();
      } else {
        const err = await res.json();
        alert(err.detail || 'Unable to create schedule');
      }
    } catch (err) {
      console.error('Failed to create schedule:', err);
    }
  };

  const toggleSchedule = async (scheduleId) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}/toggle`, { method: 'POST' });
      if (res.ok) {
        fetchSchedules();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  };

  const deleteSchedule = async (scheduleId) => {
    try {
      const res = await fetch(`/api/schedules/${scheduleId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchSchedules();
        fetchStats();
      }
    } catch (err) {
      console.error('Failed to delete schedule:', err);
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

      <div className="stats-strip">
        <div className="stats-card">
          <Activity style={{ width: '1.1rem', height: '1.1rem' }} />
          <div>
            <span>Controllers Online</span>
            <strong>{stats.device_count}</strong>
          </div>
        </div>
        <div className="stats-card">
          <Sun style={{ width: '1.1rem', height: '1.1rem' }} />
          <div>
            <span>Power Active</span>
            <strong>{stats.devices_on}</strong>
          </div>
        </div>
        <div className="stats-card">
          <Zap style={{ width: '1.1rem', height: '1.1rem' }} />
          <div>
            <span>Total LEDs</span>
            <strong>{stats.total_leds}</strong>
          </div>
        </div>
        <div className="stats-card">
          <Cpu style={{ width: '1.1rem', height: '1.1rem' }} />
          <div>
            <span>Sync FPS</span>
            <strong>{stats.sync?.fps_actual || 0}</strong>
          </div>
        </div>
        <div className="stats-card">
          <Clock style={{ width: '1.1rem', height: '1.1rem' }} />
          <div>
            <span>Uptime</span>
            <strong>{Math.floor((stats.uptime_seconds || 0) / 3600)}h</strong>
          </div>
        </div>
      </div>

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

          <div className="glass-card">
            <div className="card-title-bar">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles style={{ width: '1.1rem', height: '1.1rem', color: '#a855f7' }} />
                <span>Scenes & Presets</span>
              </h2>
              <span className="tag">{scenes.length} Saved</span>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-row" style={{ alignItems: 'center' }}>
                <input
                  type="text"
                  value={newSceneName}
                  onChange={(e) => setNewSceneName(e.target.value)}
                  placeholder="New scene name"
                  className="input-field"
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={saveScene} className="btn btn-primary" style={{ marginLeft: '0.75rem' }}>
                  <Save style={{ width: '1rem', height: '1rem' }} />
                  <span>Save Scene</span>
                </button>
              </div>
              {scenes.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No scenes saved yet. Capture the current lighting state to build presets.</p>
              ) : (
                scenes.map(scene => (
                  <div key={scene.id} className="scene-row">
                    <div>
                      <h4>{scene.name}</h4>
                      <p>{Object.keys(scene.states || {}).length} devices mapped</p>
                    </div>
                    <div className="scene-action-group">
                      <button onClick={() => applyScene(scene.id)} className="btn btn-icon">
                        <Play style={{ width: '0.9rem', height: '0.9rem' }} />
                      </button>
                      <button onClick={() => deleteScene(scene.id)} className="btn btn-icon" style={{ color: '#f43f5e' }}>
                        <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="glass-card">
            <div className="card-title-bar">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Users style={{ width: '1.1rem', height: '1.1rem', color: '#06b6d4' }} />
                <span>Group Control</span>
              </h2>
              <span className="tag">{groups.length} Groups</span>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              {/* Create new group form */}
              <div style={{ display: 'grid', gap: '0.75rem' }}>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="New group name"
                  className="input-field"
                />
                <div className="group-chip-list">
                  {devices.map(dev => (
                    <label key={dev.id} className={`group-chip ${groupDeviceIds.includes(dev.id) ? 'active' : ''}`}>
                      <input type="checkbox" checked={groupDeviceIds.includes(dev.id)} onChange={() => toggleGroupDevice(dev.id)} />
                      {dev.name}
                    </label>
                  ))}
                </div>
                <button type="button" onClick={createGroup} className="btn btn-primary">
                  <Plus style={{ width: '1rem', height: '1rem' }} />
                  <span>Create Group</span>
                </button>
              </div>

              {groups.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Create a group to control multiple controllers at once.</p>
              ) : (
                groups.map(group => {
                  const isExpanded = expandedGroupId === group.id;
                  const isEditing = editingGroupId === group.id;
                  const wledOnly = allGroupWled(group);
                  const curBri = groupBri[group.id] ?? 128;
                  const curColor = groupColor[group.id] ?? '#a855f7';
                  const curFx = groupFx[group.id] ?? 0;

                  return (
                    <div key={group.id} className="group-panel">
                      {/* Group header row */}
                      <div className="group-header-row">
                        <button
                          className="group-expand-btn"
                          onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                        >
                          <ChevronDown style={{ width: '1rem', height: '1rem', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                        </button>
                        <div style={{ flex: 1 }}>
                          {isEditing ? (
                            <input
                              className="input-field group-rename-input"
                              value={editingGroupName}
                              onChange={(e) => setEditingGroupName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') updateGroup(group.id, { name: editingGroupName, device_ids: editingGroupDeviceIds });
                                if (e.key === 'Escape') setEditingGroupId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <h4 className="group-name" onDoubleClick={() => startEditingGroup(group)}>{group.name}</h4>
                          )}
                          <p className="group-meta">{group.device_ids?.length || 0} devices · {wledOnly ? 'WLED' : 'Mixed'}</p>
                        </div>
                        <div className="scene-action-group">
                          <button title="Turn On" onClick={() => controlGroup(group.id, { on: true })} className="btn btn-icon group-on-btn">
                            <Zap style={{ width: '0.9rem', height: '0.9rem' }} />
                          </button>
                          <button title="Turn Off" onClick={() => controlGroup(group.id, { on: false })} className="btn btn-icon">
                            <Power style={{ width: '0.9rem', height: '0.9rem' }} />
                          </button>
                          {isEditing ? (
                            <button title="Save" onClick={() => updateGroup(group.id, { name: editingGroupName, device_ids: editingGroupDeviceIds })} className="btn btn-icon" style={{ color: '#22c55e' }}>
                              <Check style={{ width: '0.9rem', height: '0.9rem' }} />
                            </button>
                          ) : (
                            <button title="Edit" onClick={() => startEditingGroup(group)} className="btn btn-icon">
                              <Sliders style={{ width: '0.9rem', height: '0.9rem' }} />
                            </button>
                          )}
                          <button title="Delete" onClick={() => deleteGroup(group.id)} className="btn btn-icon" style={{ color: '#f43f5e' }}>
                            <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded controls */}
                      {isExpanded && (
                        <div className="group-expanded-body">
                          {/* Brightness */}
                          <div className="control-row" style={{ marginBottom: 0 }}>
                            <div className="control-label-wrapper">
                              <label>Group Brightness</label>
                              <span className="control-value-text">{Math.round((curBri / 255) * 100)}%</span>
                            </div>
                            <div className="slider-input-wrapper">
                              <Sun style={{ width: '1rem', height: '1rem' }} />
                              <input
                                type="range" min="0" max="255"
                                value={curBri}
                                onChange={(e) => setGroupBri(prev => ({ ...prev, [group.id]: parseInt(e.target.value) }))}
                                onMouseUp={(e) => controlGroup(group.id, { bri: parseInt(e.target.value) })}
                                onTouchEnd={(e) => controlGroup(group.id, { bri: parseInt(e.target.value) })}
                                className="slider-range-bar"
                              />
                            </div>
                          </div>

                          {/* Color */}
                          <div className="control-row" style={{ marginBottom: 0 }}>
                            <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Group Color</label>
                            <div className="color-picker-box">
                              <input
                                type="color"
                                value={curColor}
                                onChange={(e) => setGroupColor(prev => ({ ...prev, [group.id]: e.target.value }))}
                                onBlur={(e) => controlGroup(group.id, { color: hexToRgb(e.target.value) })}
                                className="color-input-circle"
                              />
                              <div className="color-picker-details">
                                <h5>All Devices</h5>
                                <p>{curColor.toUpperCase()}</p>
                              </div>
                            </div>
                            <div className="quick-colors-palette" style={{ marginTop: '0.5rem' }}>
                              {['#a855f7','#06b6d4','#ec4899','#f97316','#22c55e','#ef4444','#eab308'].map(hex => (
                                <button key={hex} onClick={() => { setGroupColor(prev => ({ ...prev, [group.id]: hex })); controlGroup(group.id, { color: hexToRgb(hex) }); }} className="quick-color-dot" style={{ backgroundColor: hex }} />
                              ))}
                            </div>
                          </div>

                          {/* Effect — only when all devices are WLED */}
                          {wledOnly && (
                            <div className="form-group">
                              <label>Group Effect</label>
                              <div style={{ position: 'relative' }}>
                                <select
                                  value={curFx}
                                  onChange={(e) => { const v = parseInt(e.target.value); setGroupFx(prev => ({ ...prev, [group.id]: v })); controlGroup(group.id, { fx: v }); }}
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

                          {/* Edit membership */}
                          {isEditing && (
                            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                              <label style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Edit Members</label>
                              <div className="group-chip-list">
                                {devices.map(dev => (
                                  <label key={dev.id} className={`group-chip ${editingGroupDeviceIds.includes(dev.id) ? 'active' : ''}`}>
                                    <input type="checkbox" checked={editingGroupDeviceIds.includes(dev.id)} onChange={() => toggleEditingDevice(dev.id)} />
                                    {dev.name}
                                  </label>
                                ))}
                              </div>
                              <button
                                type="button"
                                onClick={() => updateGroup(group.id, { name: editingGroupName, device_ids: editingGroupDeviceIds })}
                                className="btn btn-primary"
                                style={{ marginTop: '0.75rem', width: '100%' }}
                              >
                                <Check style={{ width: '1rem', height: '1rem' }} />
                                <span>Save Changes</span>
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
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
                      {/* Windows Dynamic Lighting specific note */}
                      {selectedDev.type === 'wdl' && (
                        <div className="wdl-note" style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                          <AlertCircle style={{ width: '1rem', height: '1rem', color: '#fbbf24' }} />
                          <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#fbbf24' }}>
                            This device is managed via Windows Dynamic Lighting. Changes affect compatible hardware such as keyboards, motherboards, fans, and RAM.
                          </span>
                        </div>
                      )}

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

          <div className="glass-card">
            <div className="card-title-bar">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Palette style={{ width: '1.1rem', height: '1.1rem', color: '#ec4899' }} />
                <span>Color Palette Generator</span>
              </h2>
              <span className="tag">{paletteResults.length} Colors</span>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-row" style={{ alignItems: 'center' }}>
                <input
                  type="color"
                  value={paletteBase}
                  onChange={(e) => setPaletteBase(e.target.value)}
                  className="color-input-circle"
                  style={{ width: '2.5rem', height: '2.5rem' }}
                />
                <select
                  value={paletteScheme}
                  onChange={(e) => setPaletteScheme(e.target.value)}
                  className="select-dropdown"
                  style={{ flex: 1 }}
                >
                  {['analogous', 'complementary', 'triadic', 'tetradic', 'monochrome'].map(option => (
                    <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>
                  ))}
                </select>
                <button type="button" onClick={generatePalette} className="btn btn-primary" style={{ marginLeft: '0.75rem' }}>
                  <Wand2 style={{ width: '1rem', height: '1rem' }} />
                  <span>Generate</span>
                </button>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{paletteMessage || 'Create a theme from any base color.'}</p>
              <div className="palette-swatch-grid">
                {paletteResults.length === 0 ? (
                  <div className="palette-placeholder">Generate a palette to preview colors here.</div>
                ) : (
                  paletteResults.map(color => (
                    <button
                      key={color.hex}
                      onClick={() => setPaletteBase(color.hex)}
                      className="palette-swatch"
                      style={{ backgroundColor: color.hex }}
                    >
                      <span>{color.hex}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="glass-card">
            <div className="card-title-bar">
              <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock style={{ width: '1.1rem', height: '1.1rem', color: '#fcd34d' }} />
                <span>Schedules & Automation</span>
              </h2>
              <span className="tag">{schedules.length} Rules</span>
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
              <div className="form-row" style={{ gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={newScheduleName}
                  onChange={(e) => setNewScheduleName(e.target.value)}
                  placeholder="Schedule name"
                  className="input-field"
                  style={{ flex: '1 1 220px' }}
                />
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="input-field"
                  style={{ width: '140px' }}
                />
                <select
                  value={scheduleAction}
                  onChange={(e) => setScheduleAction(e.target.value)}
                  className="select-dropdown"
                  style={{ width: '140px' }}
                >
                  <option value="on">Turn On</option>
                  <option value="off">Turn Off</option>
                  <option value="scene">Apply Scene</option>
                </select>
              </div>
              <div className="form-row" style={{ gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={scheduleTarget}
                  onChange={(e) => setScheduleTarget(e.target.value)}
                  className="select-dropdown"
                  style={{ flex: '1 1 180px' }}
                >
                  <option value="all">All Controllers</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>{`Group: ${group.name}`}</option>
                  ))}
                  {devices.map(device => (
                    <option key={device.id} value={device.id}>{`Device: ${device.name}`}</option>
                  ))}
                </select>
                {scheduleAction === 'scene' && (
                  <select
                    value={scheduleSceneId}
                    onChange={(e) => setScheduleSceneId(e.target.value)}
                    className="select-dropdown"
                    style={{ flex: '1 1 200px' }}
                  >
                    <option value="">Select scene</option>
                    {scenes.map(scene => (
                      <option key={scene.id} value={scene.id}>{scene.name}</option>
                    ))}
                  </select>
                )}
                <button type="button" onClick={createSchedule} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  <Save style={{ width: '1rem', height: '1rem' }} />
                  <span>Create Rule</span>
                </button>
              </div>
              <div className="schedule-day-row">
                {WEEKDAY_LABELS.map((label, idx) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleScheduleDay(idx)}
                    className={`btn ${scheduleDays.includes(idx) ? 'active' : ''}`}
                    style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {schedules.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No automation rules yet. Create schedules to trigger your lighting scenes automatically.</p>
              ) : (
                schedules.map(schedule => (
                  <div key={schedule.id} className="schedule-row">
                    <div>
                      <h4>{schedule.name}</h4>
                      <p>{schedule.time} • {schedule.days.map(day => WEEKDAY_LABELS[day]).join(', ')} • {schedule.action}{schedule.action === 'scene' ? ` (${scenes.find(scene => scene.id === schedule.scene_id)?.name || 'scene'})` : ''}</p>
                    </div>
                    <div className="scene-action-group">
                      <button onClick={() => toggleSchedule(schedule.id)} className="btn btn-icon">
                        <Power style={{ width: '0.9rem', height: '0.9rem' }} />
                      </button>
                      <button onClick={() => deleteSchedule(schedule.id)} className="btn btn-icon" style={{ color: '#f43f5e' }}>
                        <Trash2 style={{ width: '0.9rem', height: '0.9rem' }} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
