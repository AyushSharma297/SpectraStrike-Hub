import React from 'react';
import { Activity, Sun, Zap, Cpu, Clock } from 'lucide-react';

export default function StatsBar({ stats }) {
  return (
    <div className="stats-strip">
      <div className="stats-card" style={{ borderBottom: '2px solid rgba(6, 182, 212, 0.4)' }}>
        <Activity style={{ width: '1.25rem', height: '1.25rem', color: '#06b6d4', filter: 'drop-shadow(0 0 4px rgba(6, 182, 212, 0.3))' }} />
        <div>
          <span>Controllers Online</span>
          <strong>{stats.device_count}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderBottom: '2px solid rgba(234, 179, 8, 0.4)' }}>
        <Sun style={{ width: '1.25rem', height: '1.25rem', color: '#eab308', filter: 'drop-shadow(0 0 4px rgba(234, 179, 8, 0.3))' }} />
        <div>
          <span>Power Active</span>
          <strong>{stats.devices_on}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderBottom: '2px solid rgba(168, 85, 247, 0.4)' }}>
        <Zap style={{ width: '1.25rem', height: '1.25rem', color: '#a855f7', filter: 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.3))' }} />
        <div>
          <span>Total LEDs</span>
          <strong>{stats.total_leds}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderBottom: '2px solid rgba(16, 185, 129, 0.4)' }}>
        <Cpu style={{ width: '1.25rem', height: '1.25rem', color: '#10b981', filter: 'drop-shadow(0 0 4px rgba(16, 185, 129, 0.3))' }} />
        <div>
          <span>Sync FPS</span>
          <strong>{stats.sync?.fps_actual || 0}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderBottom: '2px solid rgba(244, 63, 94, 0.4)' }}>
        <Clock style={{ width: '1.25rem', height: '1.25rem', color: '#f43f5e', filter: 'drop-shadow(0 0 4px rgba(244, 63, 94, 0.3))' }} />
        <div>
          <span>Uptime</span>
          <strong>{Math.floor((stats.uptime_seconds || 0) / 3600)}h</strong>
        </div>
      </div>
    </div>
  );
}
