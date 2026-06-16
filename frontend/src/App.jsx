import React, { useState, useEffect, useRef } from 'react';
import StatsBar from './components/StatsBar';
import DeviceSidebar from './components/DeviceSidebar';
import ControlPanel from './components/ControlPanel';
import SyncManager from './components/SyncManager';
import ToastManager from './components/ToastManager';
import AboutPanel from './components/AboutPanel';
import MusicSyncPanel from './components/MusicSyncPanel';
import { motion, AnimatePresence } from 'framer-motion';
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
  Wand2,
  Info,
  Music
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
  const [navTab, setNavTab] = useState('dashboard');
  
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
  
  // Tactical Game Mode / Muzzle Flash config
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [flashThreshold, setFlashThreshold] = useState(45);
  const [flashColor, setFlashColor] = useState('#ffddaa');
  const [flashDuration, setFlashDuration] = useState(3);

  // Screen placement boundary configurations
  const [zoneConfigs, setZoneConfigs] = useState({
    left: 15,
    right: 15,
    top: 15,
    bottom: 15,
    center_x_min: 25,
    center_x_max: 75,
    center_y_min: 25,
    center_y_max: 75
  });
  
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
  const [presets, setPresets] = useState([]);
  const [paletteScheme, setPaletteScheme] = useState('analogous');
  const [paletteBase, setPaletteBase] = useState('#a855f7');
  const [paletteResults, setPaletteResults] = useState([]);
  const [paletteMessage, setPaletteMessage] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

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
    fetchZoneConfigs();
    fetchPresets();

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
        
        setFlashEnabled(data.flash_enabled || false);
        setFlashThreshold(data.flash_threshold || 45);
        if (data.flash_color) {
          setFlashColor(rgbToHex(data.flash_color[0], data.flash_color[1], data.flash_color[2]));
        }
        setFlashDuration(data.flash_duration || 3);
      }
    } catch (err) {
      console.error('Error fetching sync status:', err);
    }
  };

  const fetchZoneConfigs = async () => {
    try {
      const res = await fetch('/api/sync/zones');
      if (res.ok) {
        const data = await res.json();
        setZoneConfigs(data);
      }
    } catch (err) {
      console.error('Error fetching zone configs:', err);
    }
  };

  const saveZoneConfigs = async (newConfigs) => {
    try {
      const res = await fetch('/api/sync/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfigs)
      });
      if (res.ok) {
        const data = await res.json();
        setZoneConfigs(data);
        showToast('Placement boundaries updated successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to save zone configs:', err);
      showToast('Failed to save boundaries: ' + err.message, 'error');
    }
  };

  const resetSyncParams = async () => {
    setSyncMode('average');
    setSyncFps(20);
    setMonitorIdx(1);
    if (syncActive) {
      await applySyncSettings(true, { syncMode: 'average', syncFps: 20, monitorIdx: 1 });
    }
    showToast('Sync parameters reset to defaults.', 'info');
  };

  const resetMuzzleFlashParams = async () => {
    setFlashEnabled(false);
    setFlashThreshold(45);
    setFlashColor('#ffddaa');
    setFlashDuration(3);
    if (syncActive) {
      await applySyncSettings(true, {
        flash_enabled: false,
        flash_threshold: 45,
        flash_color: hexToRgb('#ffddaa'),
        flash_duration: 3
      });
    }
    showToast('Muzzle flash parameters reset to defaults.', 'info');
  };

  const resetZoneConfigs = async () => {
    const defaults = {
      left: 15,
      right: 15,
      top: 15,
      bottom: 15,
      center_x_min: 25,
      center_x_max: 75,
      center_y_min: 25,
      center_y_max: 75
    };
    await saveZoneConfigs(defaults);
    showToast('Placement boundaries reset to defaults.', 'info');
  };

  const resetDeviceCalibration = async (deviceId) => {
    try {
      const res = await fetch(`/api/devices/${deviceId}/calibration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r_seen: [255, 0, 0],
          g_seen: [0, 255, 0],
          b_seen: [0, 0, 255],
          gamma: 2.2,
          min_r: 0,
          min_g: 0,
          min_b: 0,
          max_r: 255,
          max_g: 255,
          max_b: 255,
          temp: 6500
        })
      });
      if (res.ok) {
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
        showToast('Color calibration reset to factory defaults.', 'info');
      }
    } catch (err) {
      console.error('Failed to reset calibration:', err);
      showToast('Failed to reset calibration: ' + err.message, 'error');
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

  const fetchPresets = async () => {
    try {
      const res = await fetch('/api/presets');
      if (res.ok) {
        const data = await res.json();
        setPresets(data);
      }
    } catch (err) {
      console.error('Error fetching presets:', err);
    }
  };

  const applyPreset = async (presetId) => {
    try {
      const res = await fetch(`/api/presets/${presetId}/apply`, { method: 'POST' });
      if (res.ok) {
        showToast(`Preset "${presetId}" applied successfully`, 'success');
        fetchDevices();
        setSyncActive(false);
      } else {
        showToast('Failed to apply preset', 'error');
      }
    } catch (err) {
      console.error('Error applying preset:', err);
      showToast('Error applying preset', 'error');
    }
  };

  const applyGroupPreset = async (groupId, presetId) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/preset/${presetId}/apply`, { method: 'POST' });
      if (res.ok) {
        showToast(`Applied preset "${presetId}" to group`, 'success');
        fetchDevices();
      } else {
        showToast('Failed to apply preset to group', 'error');
      }
    } catch (err) {
      console.error('Error applying group preset:', err);
      showToast('Error applying group preset', 'error');
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
        showToast('Scene saved successfully!', 'success');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Unable to save scene', 'error');
      }
    } catch (err) {
      console.error('Failed to save scene:', err);
      showToast('Failed to save scene', 'error');
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
      showToast('Group name is required', 'error');
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
        showToast('Group created successfully!', 'success');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Unable to create group', 'error');
      }
    } catch (err) {
      console.error('Failed to create group:', err);
      showToast('Failed to create group', 'error');
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
      showToast('Schedule name and time are required', 'error');
      return;
    }
    if (scheduleAction === 'scene' && !scheduleSceneId) {
      showToast('Please select a scene for the scene action', 'error');
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
        showToast('Schedule created successfully!', 'success');
      } else {
        const err = await res.json();
        showToast(err.detail || 'Unable to create schedule', 'error');
      }
    } catch (err) {
      console.error('Failed to create schedule:', err);
      showToast('Failed to create schedule', 'error');
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
        showToast('Advanced color calibration applied successfully!', 'success');
      }
    } catch (err) {
      console.error('Failed to save calibration:', err);
      showToast('Failed to save calibration: ' + err.message, 'error');
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
        showToast('Device added successfully!', 'success');
      } else {
        const errData = await res.json();
        showToast(`Failed to add device: ${errData.detail || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      showToast(`Error adding device: ${err.message}`, 'error');
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

  const applySyncSettings = async (overrideActive = null, customParams = {}) => {
    const isActive = overrideActive !== null ? overrideActive : syncActive;
    const layoutActive = Object.keys(layoutMapping).filter(id => layoutMapping[id] && layoutMapping[id] !== 'none');
    const segmentsActive = Object.keys(wledSegments).filter(id => wledSegments[id] && wledSegments[id].length > 0);
    const activeDeviceIds = Array.from(new Set([...layoutActive, ...segmentsActive]));
    
    if (isActive && activeDeviceIds.length === 0) {
      showToast('Please map at least one active controller or segment zone before syncing.', 'error');
      return;
    }

    const payload = {
      device_ids: activeDeviceIds,
      active: isActive,
      mode: customParams.syncMode !== undefined ? customParams.syncMode : syncMode,
      fps: parseInt(customParams.syncFps !== undefined ? customParams.syncFps : syncFps),
      monitor_idx: parseInt(customParams.monitorIdx !== undefined ? customParams.monitorIdx : monitorIdx),
      flash_enabled: customParams.flashEnabled !== undefined ? customParams.flashEnabled : flashEnabled,
      flash_threshold: parseInt(customParams.flashThreshold !== undefined ? customParams.flashThreshold : flashThreshold),
      flash_color: hexToRgb(customParams.flashColor !== undefined ? customParams.flashColor : flashColor),
      flash_duration: parseInt(customParams.flashDuration !== undefined ? customParams.flashDuration : flashDuration)
    };

    try {
      const res = await fetch('/api/sync/screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setSyncActive(data.active);
      }
    } catch (err) {
      console.error('Failed to apply screen sync settings:', err);
    }
  };

  const toggleScreenSync = () => {
    applySyncSettings(!syncActive);
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
      {/* Background Animated Pattern and Blobs */}
      <div className="app-bg-container">
        <div className="backdrop-grid-pattern"></div>
        <div className="backdrop-glow-blob blob-purple"></div>
        <div className="backdrop-glow-blob blob-cyan"></div>
        <div className="backdrop-glow-blob blob-rose"></div>
      </div>
      
      {/* LEFT SIDE NAVIGATION BAR */}
      <div className="side-nav">
        <div className="side-nav-brand">
          <div className="logo-icon-wrapper">
            <Lightbulb style={{ width: '1.4rem', height: '1.4rem', color: '#fff' }} />
          </div>
          <div className="brand-title-group">
            <h1>SPECTRASTRIKE</h1>
            <p>Tactical Ambient Sync</p>
          </div>
        </div>

        <div className="side-nav-menu">
          <button 
            className={`side-nav-item ${navTab === 'dashboard' ? 'active' : ''}`} 
            onClick={() => setNavTab('dashboard')}
          >
            <Layout size={18} />
            <span>Dashboard</span>
          </button>
          
          <button 
            className={`side-nav-item ${navTab === 'devices' ? 'active' : ''}`} 
            onClick={() => setNavTab('devices')}
          >
            <Sliders size={18} />
            <span>Device Controller</span>
          </button>

          <button 
            className={`side-nav-item ${navTab === 'sync' ? 'active' : ''}`} 
            onClick={() => setNavTab('sync')}
          >
            <Tv size={18} />
            <span>Ambient Screen Sync</span>
          </button>

          <button 
            className={`side-nav-item ${navTab === 'music' ? 'active' : ''}`} 
            onClick={() => setNavTab('music')}
          >
            <Music size={18} />
            <span>Music Sync</span>
          </button>

          <button 
            className={`side-nav-item ${navTab === 'scenes' ? 'active' : ''}`} 
            onClick={() => setNavTab('scenes')}
          >
            <Sparkles size={18} />
            <span>Scenes & Groups</span>
          </button>

          <button 
            className={`side-nav-item ${navTab === 'schedules' ? 'active' : ''}`} 
            onClick={() => setNavTab('schedules')}
          >
            <Clock size={18} />
            <span>Automation</span>
          </button>

          <button 
            className={`side-nav-item ${navTab === 'palette' ? 'active' : ''}`} 
            onClick={() => setNavTab('palette')}
          >
            <Palette size={18} />
            <span>Palette Matcher</span>
          </button>

          <button 
            className={`side-nav-item about-nav-item ${navTab === 'about' ? 'active' : ''}`} 
            onClick={() => setNavTab('about')}
          >
            <Info size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span style={{ color: 'var(--text-main)' }}>About SpectraStrike</span>
          </button>
        </div>

        {/* BOTTOM ENGINE STATS */}
        <div className="side-nav-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ 
              width: '8px', 
              height: '8px', 
              borderRadius: '50%', 
              backgroundColor: syncActive ? '#06b6d4' : '#f43f5e', 
              display: 'inline-block',
              boxShadow: syncActive ? '0 0 10px #06b6d4' : 'none',
              animation: syncActive ? 'pulse 1.5s infinite' : 'none'
            }}></span>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Sync Engine {syncActive ? 'Active' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE MAIN CONTAINER */}
      <div className="main-content">
        
        {/* HEADER CONTROL BAR */}
        <header className="main-header">
          <div>
            <h2 style={{ fontFamily: 'var(--font-family-header)', fontSize: '1.3rem', fontWeight: '900', letterSpacing: '0.03em', textTransform: 'uppercase', color: 'var(--text-main)' }}>
              {navTab === 'dashboard' ? 'Dashboard Overview' : 
               navTab === 'devices' ? 'Device Controller' : 
               navTab === 'sync' ? 'Ambient Screen Sync' : 
               navTab === 'music' ? 'Music Sync Engine' : 
               navTab === 'scenes' ? 'Scenes & Groups' : 
               navTab === 'schedules' ? 'Scheduled Automations' : 
               navTab === 'about' ? 'About SpectraStrike' : 'Ambient Palette Matcher'}
            </h2>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              SpectraStrike Combat Ambient Command Center
            </p>
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
              title="Scan Network Subnets"
            >
              <RefreshCw style={{ width: '1rem', height: '1rem', color: '#06b6d4' }} className={loadingScan ? 'animate-spin' : ''} />
              <span>{loadingScan ? 'Scanning...' : 'Scan Subnets'}</span>
            </button>

            <button
              onClick={() => {
                setNavTab('devices');
                setShowAddForm(!showAddForm);
              }}
              className={`btn btn-icon ${showAddForm ? 'active' : ''}`}
              title="Add Device manually"
            >
              <Plus style={{ width: '1.2rem', height: '1.2rem' }} />
            </button>
          </div>
        </header>

        <ToastManager toast={toast} />

        {/* WORKSPACE BODY */}
        <div className="view-body">
          
          {/* 1. DASHBOARD OVERVIEW */}
          {navTab === 'dashboard' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
            >
              <StatsBar stats={stats} />
              
              <div className="dashboard-quick-grid">
                {/* DEVICES QUICK CONTROL GRID */}
                <div className="glass-card" style={{ gridColumn: 'span 8' }}>
                  <div className="card-title-bar">
                    <span className="card-title">Network Light Controllers</span>
                    <button onClick={() => setNavTab('devices')} className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem' }}>
                      Configure Devices
                    </button>
                  </div>
                  
                  <div className="responsive-grid-equal" style={{ gap: '1rem', marginTop: '0.5rem' }}>
                    {devices.length === 0 ? (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', gridColumn: 'span 2', textAlign: 'center', padding: '2rem' }}>
                        No controllers found. Use the Scan button to search the network.
                      </p>
                    ) : (
                      devices.map(dev => {
                        const activeColor = dev.state?.on && dev.state?.color 
                          ? `rgb(${dev.state.color[0]}, ${dev.state.color[1]}, ${dev.state.color[2]})` 
                          : dev.state?.on ? '#a855f7' : '#475569';
                        return (
                          <div 
                            key={dev.id} 
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '1rem', 
                              borderRadius: '16px', 
                              border: '1px solid var(--border-color)', 
                              background: 'rgba(15, 23, 42, 0.35)',
                              boxShadow: dev.state?.on ? `0 0 10px rgba(${dev.state.color ? dev.state.color.join(',') : '168,85,247'}, 0.05)` : 'none'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <div style={{ 
                                width: '10px', 
                                height: '10px', 
                                borderRadius: '50%', 
                                backgroundColor: activeColor,
                                boxShadow: dev.state?.on ? `0 0 8px ${activeColor}` : 'none'
                              }}></div>
                              <div>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-main)' }}>{dev.name}</h4>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{dev.ip}</span>
                              </div>
                            </div>

                            <button 
                              className={`power-toggle-btn ${dev.state?.on ? 'active' : ''}`}
                              onClick={() => controlDeviceState(dev.id, { on: !dev.state?.on })}
                              style={{ width: '2rem', height: '2rem' }}
                            >
                              <Power size={12} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* SYNC ENGINE WIDGET */}
                <div className="glass-card" style={{ gridColumn: 'span 4' }}>
                  <span className="card-title">Sync Engine Status</span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', flex: 1, justifyContent: 'center' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Engine State</span>
                      <strong style={{ color: syncActive ? 'var(--accent-cyan)' : 'var(--text-muted)' }}>
                        {syncActive ? 'ACTIVE' : 'OFFLINE'}
                      </strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.6rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sync Targets</span>
                      <strong>{Object.keys(layoutMapping).length} Mapped</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>FPS actual</span>
                      <strong style={{ color: 'var(--accent-purple)' }}>{stats.sync?.fps_actual || 0} FPS</strong>
                    </div>
                    
                    <button 
                      onClick={toggleScreenSync}
                      className={`btn ${syncActive ? 'btn-rose' : 'btn-primary'}`}
                      style={{ width: '100%', marginTop: '0.75rem', height: '2.5rem' }}
                    >
                      {syncActive ? 'Stop Sync' : 'Start Screen Sync'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* 2. DEVICE CONTROLLER & PAINT CANVAS */}
          {navTab === 'devices' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="dashboard-grid" style={{ padding: 0, gap: '1.5rem', height: '100%', alignItems: 'stretch' }}
            >
              <DeviceSidebar 
                devices={devices}
                selectedDeviceId={selectedDeviceId}
                setSelectedDeviceId={handleDeviceSelect}
                loadingScan={loadingScan}
                triggerScan={triggerScan}
                scanMessage={scanMessage}
                showAddForm={showAddForm}
                setShowAddForm={setShowAddForm}
                handleAddDevice={handleAddDevice}
                newIp={newIp}
                setNewIp={setNewIp}
                newType={newType}
                setNewType={setNewType}
                newName={newName}
                setNewName={setNewName}
                newLedCount={newLedCount}
                setNewLedCount={setNewLedCount}
                fetchDevices={fetchDevices}
              />
              <div className="main-column" style={{ height: '100%' }}>
                <ControlPanel 
                  selectedDev={selectedDev}
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  controlDeviceState={controlDeviceState}
                  selectedDeviceId={selectedDeviceId}
                  PRESET_EFFECTS={PRESET_EFFECTS}
                  calRedSeen={calRedSeen}
                  calGreenSeen={calGreenSeen}
                  calBlueSeen={calBlueSeen}
                  calGamma={calGamma}
                  setCalGamma={setCalGamma}
                  calMinR={calMinR}
                  setCalMinR={setCalMinR}
                  calMinG={calMinG}
                  setCalMinG={setCalMinG}
                  calMinB={calMinB}
                  setCalMinB={setCalMinB}
                  calMaxR={calMaxR}
                  setCalMaxR={setCalMaxR}
                  calMaxG={calMaxG}
                  setCalMaxG={setCalMaxG}
                  calMaxB={calMaxB}
                  setCalMaxB={setCalMaxB}
                  calTemp={calTemp}
                  setCalTemp={setCalTemp}
                  showAdvancedSettings={showAdvancedSettings}
                  setShowAdvancedSettings={setShowAdvancedSettings}
                  saveDeviceCalibration={saveDeviceCalibration}
                  ledColors={ledColors}
                  paintColor={paintColor}
                  setPaintColor={setPaintColor}
                  handlePaintPixel={handlePaintPixel}
                  handlePixelMouseEnter={handlePixelMouseEnter}
                  fillAllPixels={fillAllPixels}
                  clearAllPixels={clearAllPixels}
                  isDrawing={isDrawing}
                  setIsDrawing={setIsDrawing}
                  resetDeviceCalibration={resetDeviceCalibration}
                />
              </div>
            </motion.div>
          )}

          {/* 3. AMBIENT SCREEN SYNC */}
          {navTab === 'sync' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ maxWidth: '800px', margin: '0 auto' }}
            >
              <SyncManager 
                devices={devices}
                syncActive={syncActive}
                setSyncActive={setSyncActive}
                syncMode={syncMode}
                setSyncMode={setSyncMode}
                syncFps={syncFps}
                setSyncFps={setSyncFps}
                monitorIdx={monitorIdx}
                setMonitorIdx={setMonitorIdx}
                layoutMapping={layoutMapping}
                setLayoutMapping={setLayoutMapping}
                wledSegments={wledSegments}
                setWledSegments={setWledSegments}
                draggedOverZone={draggedOverZone}
                setDraggedOverZone={setDraggedOverZone}
                handleDropOnZone={handleDropOnZone}
                handleDragStartDevice={handleDragStartDevice}
                handleDragStartSegment={handleDragStartSegment}
                updateSegmentZone={updateSegmentZone}
                handleAddSegment={handleAddSegment}
                handleDeleteSegment={handleDeleteSegment}
                toggleScreenSync={toggleScreenSync}
                isZoneActive={isZoneActive}
                fetchDevices={fetchDevices}
                flashEnabled={flashEnabled}
                setFlashEnabled={setFlashEnabled}
                flashThreshold={flashThreshold}
                setFlashThreshold={setFlashThreshold}
                flashColor={flashColor}
                setFlashColor={setFlashColor}
                flashDuration={flashDuration}
                setFlashDuration={setFlashDuration}
                applySyncSettings={applySyncSettings}
                zoneConfigs={zoneConfigs}
                saveZoneConfigs={saveZoneConfigs}
                resetSyncParams={resetSyncParams}
                resetMuzzleFlashParams={resetMuzzleFlashParams}
                resetZoneConfigs={resetZoneConfigs}
              />
            </motion.div>
          )}

          {/* MUSIC SYNC ENGINE */}
          {navTab === 'music' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MusicSyncPanel devices={devices} />
            </motion.div>
          )}

          {/* 4. SCENES & GROUPS VIEW */}
          {navTab === 'scenes' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}
            >
              
              {/* GLOBAL PRESETS CARD */}
              <div className="glass-card">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
                  Tactical Command Presets
                </span>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', marginBottom: '0.75rem' }}>
                  Execute synchronized ambient setups across all lights instantly.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                  {presets.map(p => {
                    const PresetIcon = p.icon === 'Power' ? Power : 
                                     p.icon === 'AlertCircle' ? AlertCircle :
                                     p.icon === 'Zap' ? Zap :
                                     p.icon === 'Sun' ? Sun : Palette;
                    return (
                      <button 
                        key={p.id}
                        onClick={() => applyPreset(p.id)}
                        className="btn btn-preset-tactical"
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          alignItems: 'flex-start', 
                          gap: '0.5rem', 
                          padding: '1.25rem',
                          borderRadius: '16px',
                          textAlign: 'left',
                          background: 'rgba(15, 23, 42, 0.4)',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '2rem',
                            height: '2rem',
                            borderRadius: '8px',
                            background: p.id === 'breach_alert' ? 'rgba(244, 63, 94, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: p.id === 'breach_alert' ? '1px solid rgba(244, 63, 94, 0.3)' : '1px solid rgba(168, 85, 247, 0.3)',
                            color: p.id === 'breach_alert' ? 'var(--accent-rose)' : 'var(--accent-purple)'
                          }}>
                            <PresetIcon size={16} />
                          </div>
                          <span style={{ fontWeight: '700', fontSize: '0.85rem', color: 'var(--text-main)' }}>{p.name}</span>
                        </div>
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.3' }}>{p.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="responsive-grid-equal" style={{ gap: '2rem' }}>
              {/* SCENES MANAGER CARD */}
              <div className="glass-card">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-purple)' }} />
                  Ambient Scenes
                </span>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', marginTop: '0.75rem' }}>
                  <input 
                    type="text" 
                    placeholder="Name active setup..." 
                    value={newSceneName} 
                    onChange={(e) => setNewSceneName(e.target.value)} 
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <button onClick={saveScene} className="btn btn-primary" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <Save size={14} />
                    <span>Save</span>
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {scenes.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                      No scenes recorded yet.
                    </p>
                  ) : (
                    scenes.map(sc => (
                      <div key={sc.id} className="scene-row">
                        <div>
                          <h4 style={{ fontWeight: 'bold' }}>{sc.name}</h4>
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{Object.keys(sc.states || {}).length} device states snapshot</p>
                        </div>
                        <div className="scene-action-group">
                          <button onClick={() => applyScene(sc.id)} className="btn btn-icon" title="Apply Scene"><Play size={12} style={{ color: 'var(--accent-cyan)' }} /></button>
                          <button onClick={() => deleteScene(sc.id)} className="btn btn-icon" title="Delete Scene"><Trash2 size={12} style={{ color: 'var(--accent-rose)' }} /></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* GROUPS MANAGER CARD */}
              <div className="glass-card">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Users size={16} style={{ color: 'var(--accent-cyan)' }} />
                  Unified Device Groups
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.25rem', marginTop: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="text" 
                      placeholder="Group Name..." 
                      value={newGroupName} 
                      onChange={(e) => setNewGroupName(e.target.value)} 
                      className="input-field"
                      style={{ flex: 1 }}
                    />
                    <button onClick={createGroup} className="btn btn-primary" title="Create Group">
                      <Plus size={16} />
                    </button>
                  </div>
                  
                  {newGroupName && (
                    <div style={{ background: 'rgba(2, 6, 23, 0.3)', padding: '0.75rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Select devices for this group:</p>
                      <div className="group-chip-list">
                        {devices.map(dev => (
                          <div 
                            key={dev.id}
                            className={`group-chip ${groupDeviceIds.includes(dev.id) ? 'active' : ''}`}
                            onClick={() => toggleGroupDevice(dev.id)}
                          >
                            <span>{dev.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                  {groups.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                      No device groups created.
                    </p>
                  ) : (
                    groups.map(gp => {
                      const isExpanded = expandedGroupId === gp.id;
                      return (
                        <div key={gp.id} className="group-panel">
                          <div className="group-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <button 
                              className="group-expand-btn" 
                              onClick={() => setExpandedGroupId(isExpanded ? null : gp.id)}
                            >
                              <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                            </button>
                            <div style={{ flex: 1, marginLeft: '0.5rem' }}>
                              <span className="group-name">{gp.name}</span>
                              <div className="group-meta">{gp.device_ids?.length || 0} devices linked</div>
                            </div>
                            <button onClick={() => deleteGroup(gp.id)} className="btn btn-icon" title="Delete Group"><Trash2 size={12} style={{ color: 'var(--accent-rose)' }} /></button>
                          </div>

                          {isExpanded && (
                            <div className="group-expanded-body">
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn btn-primary" onClick={() => controlGroup(gp.id, { on: true })} style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }}>On</button>
                                <button className="btn" onClick={() => controlGroup(gp.id, { on: false })} style={{ flex: 1, height: '2rem', fontSize: '0.75rem' }}>Off</button>
                              </div>
                              <div className="control-row">
                                <label style={{ fontSize: '0.7rem' }}>Brightness</label>
                                <input type="range" min="0" max="255" defaultValue="128" onChange={(e) => controlGroup(gp.id, { bri: parseInt(e.target.value) })} className="slider-range-bar" />
                              </div>
                              <div className="control-row">
                                <label style={{ fontSize: '0.7rem' }}>Color</label>
                                <input type="color" defaultValue="#a855f7" onChange={(e) => controlGroup(gp.id, { color: hexToRgb(e.target.value) })} style={{ height: '30px', padding: 0 }} />
                              </div>
                              <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>Group Presets</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
                                  {presets.map(p => (
                                    <button 
                                      key={p.id}
                                      onClick={() => applyGroupPreset(gp.id, p.id)}
                                      className="btn btn-preset-tactical"
                                      style={{ padding: '0.4rem 0.6rem', fontSize: '0.7rem', textAlign: 'center', justifyContent: 'center' }}
                                      title={p.description}
                                    >
                                      <span>{p.name}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </motion.div>
          )}

          {/* 5. AUTOMATION ROUTINES */}
          {navTab === 'schedules' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
            >
              <div className="glass-card">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Clock size={16} style={{ color: 'var(--accent-rose)' }} />
                  Automation Scheduler
                </span>

                <div style={{ background: 'rgba(2, 6, 23, 0.3)', padding: '1rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.75rem' }}>
                  <div className="responsive-grid-equal" style={{ gap: '0.75rem' }}>
                    <div className="form-group">
                      <label>Routine Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Morning Glow" 
                        value={newScheduleName} 
                        onChange={(e) => setNewScheduleName(e.target.value)} 
                        className="input-field"
                      />
                    </div>
                    <div className="form-group">
                      <label>Trigger Time</label>
                      <input 
                        type="time" 
                        value={scheduleTime} 
                        onChange={(e) => setScheduleTime(e.target.value)} 
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div className="responsive-grid-equal" style={{ gap: '0.75rem' }}>
                    <div className="form-group">
                      <label>Action Type</label>
                      <select 
                        value={scheduleAction} 
                        onChange={(e) => setScheduleAction(e.target.value)} 
                        className="select-dropdown"
                      >
                        <option value="on">Turn On</option>
                        <option value="off">Turn Off</option>
                        <option value="scene">Apply Scene</option>
                      </select>
                    </div>
                    
                    {scheduleAction === 'scene' ? (
                      <div className="form-group">
                        <label>Scene</label>
                        <select 
                          value={scheduleSceneId} 
                          onChange={(e) => setScheduleSceneId(e.target.value)} 
                          className="select-dropdown"
                        >
                          <option value="">Select Scene...</option>
                          {scenes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label>Target Target</label>
                        <select 
                          value={scheduleTarget} 
                          onChange={(e) => setScheduleTarget(e.target.value)} 
                          className="select-dropdown"
                        >
                          <option value="all">All Devices</option>
                          {groups.map(g => <option key={g.id} value={`group:${g.id}`}>Group: {g.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Days to Repeat</label>
                    <div className="schedule-day-row">
                      {WEEKDAY_LABELS.map((day, idx) => (
                        <button 
                          key={idx}
                          type="button"
                          className={`btn ${scheduleDays.includes(idx) ? 'active' : ''}`}
                          onClick={() => {
                            if (scheduleDays.includes(idx)) {
                              setScheduleDays(prev => prev.filter(d => d !== idx));
                            } else {
                              setScheduleDays(prev => [...prev, idx]);
                            }
                          }}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.7rem', flex: 1, borderRadius: '8px' }}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button onClick={createSchedule} className="btn btn-primary" style={{ width: '100%', height: '2.5rem', marginTop: '0.5rem' }}>
                    Create Routine
                  </button>
                </div>
              </div>

              <div className="glass-card">
                <span className="card-title">Trigger Schedules</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
                  {schedules.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                      No automation triggers active.
                    </p>
                  ) : (
                    schedules.map(sch => (
                      <div key={sch.id} className="schedule-row">
                        <div>
                          <h4 style={{ fontWeight: 'bold' }}>{sch.name}</h4>
                          <p style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem' }}>
                            <span>Triggering at {sch.time} on ({sch.days?.map(d => WEEKDAY_LABELS[d]).join(', ')})</span>
                          </p>
                        </div>
                        <div className="scene-action-group">
                          <button 
                            onClick={() => toggleSchedule(sch.id)} 
                            className={`btn ${sch.active ? 'btn-primary' : ''}`}
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.7rem' }}
                          >
                            {sch.active ? 'Active' : 'Paused'}
                          </button>
                          <button onClick={() => deleteSchedule(sch.id)} className="btn btn-icon">
                            <Trash2 size={12} style={{ color: 'var(--accent-rose)' }} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* 6. PALETTE MATCHING */}
          {navTab === 'palette' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{ maxWidth: '800px', margin: '0 auto' }} className="glass-card"
            >
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Palette size={16} style={{ color: 'var(--accent-purple)' }} />
                Tactical Palette Matcher
              </span>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', marginTop: '1rem' }}>
                <input 
                  type="color" 
                  value={paletteBase} 
                  onChange={(e) => setPaletteBase(e.target.value)} 
                  style={{ width: '50px', height: '40px', padding: 0, border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer' }}
                />
                <select 
                  value={paletteScheme} 
                  onChange={(e) => setPaletteScheme(e.target.value)} 
                  className="select-dropdown"
                  style={{ flex: 1 }}
                >
                  <option value="analogous">Analogous Harmony</option>
                  <option value="monochromatic">Monochromatic Gradient</option>
                  <option value="triad">Triadic Tri-Color</option>
                  <option value="complementary">Complementary Match</option>
                </select>
                <button onClick={generatePalette} className="btn btn-primary" style={{ padding: '0 1.5rem' }}>
                  Generate
                </button>
              </div>

              {paletteMessage && (
                <p style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', marginBottom: '1rem', fontWeight: '600' }}>
                  {paletteMessage}
                </p>
              )}

              {paletteResults.length > 0 ? (
                <div className="palette-swatch-grid">
                  {paletteResults.map((col, idx) => (
                    <button 
                      key={idx}
                      className="palette-swatch"
                      style={{ 
                        backgroundColor: col,
                        height: '4.5rem',
                        boxShadow: `0 8px 16px ${col}30`
                      }}
                      onClick={() => {
                        if (selectedDeviceId) {
                          controlDeviceState(selectedDeviceId, { color: hexToRgb(col) });
                        }
                        setPaintColor(col);
                        showToast(`Brush and device synced to ${col}`, 'success');
                      }}
                      title="Click to apply to selected device & paint brush"
                    >
                      <span style={{ fontSize: '0.7rem' }}>{col}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="palette-placeholder" style={{ padding: '3rem 1rem' }}>
                  Select a seed color and scheme to generate coordinates.
                </div>
              )}
            </motion.div>
          )}

          {/* 7. ABOUT PAGE */}
          {navTab === 'about' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <AboutPanel />
            </motion.div>
          )}

        </div>
      </div>
    </div>
  );
}
