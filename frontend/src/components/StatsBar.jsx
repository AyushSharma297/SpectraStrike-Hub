import React from 'react';
import { Activity, Sun, Zap, Cpu, Clock } from 'lucide-react';

export default function StatsBar({ stats }) {
  return (
    <div className="stats-strip">
      <div className="stats-card" style={{ borderLeft: '3px solid var(--accent-cyan)' }}>
        <Activity style={{ width: '1.25rem', height: '1.25rem', color: 'var(--accent-cyan)', filter: 'drop-shadow(0 0 6px var(--accent-cyan-glow))' }} />
        <div>
          <span>Controllers Online</span>
          <strong>{stats.device_count}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderLeft: '3px solid #eab308' }}>
        <Sun style={{ width: '1.25rem', height: '1.25rem', color: '#eab308', filter: 'drop-shadow(0 0 6px rgba(234, 179, 8, 0.4))' }} />
        <div>
          <span>Power Active</span>
          <strong>{stats.devices_on}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderLeft: '3px solid var(--accent-purple)' }}>
        <Zap style={{ width: '1.25rem', height: '1.25rem', color: 'var(--accent-purple)', filter: 'drop-shadow(0 0 6px var(--accent-purple-glow))' }} />
        <div>
          <span>Total LEDs</span>
          <strong>{stats.total_leds}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderLeft: '3px solid #10b981' }}>
        <Cpu style={{ width: '1.25rem', height: '1.25rem', color: '#10b981', filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.4))' }} />
        <div>
          <span>Sync FPS</span>
          <strong>{stats.sync?.fps_actual || 0}</strong>
        </div>
      </div>
      <div className="stats-card" style={{ borderLeft: '3px solid var(--accent-rose)' }}>
        <Clock style={{ width: '1.25rem', height: '1.25rem', color: 'var(--accent-rose)', filter: 'drop-shadow(0 0 6px var(--accent-rose-glow))' }} />
        <div>
          <span>Uptime</span>
          <strong>{Math.floor((stats.uptime_seconds || 0) / 3600)}h</strong>
        </div>
      </div>
    </div>
  );
}
