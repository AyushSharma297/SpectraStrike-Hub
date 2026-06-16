import React from 'react';
import { Plus, RefreshCw, Lightbulb, Trash2 } from 'lucide-react';

export default function DeviceSidebar({ 
  devices, 
  selectedDeviceId, 
  setSelectedDeviceId, 
  loadingScan, 
  triggerScan, 
  scanMessage, 
  showAddForm, 
  setShowAddForm, 
  handleAddDevice, 
  newIp, 
  setNewIp, 
  newType, 
  setNewType, 
  newName, 
  setNewName, 
  newLedCount, 
  setNewLedCount,
  fetchDevices
}) {
  return (
    <div className="sidebar-column">
      <div className="glass-card">
        <div className="card-title-bar">
          <span className="card-title">Controllers</span>
          <div className="header-controls" style={{ padding: 0 }}>
            <button
              onClick={triggerScan}
              disabled={loadingScan}
              className="btn btn-icon"
              title="Scan Subnets"
            >
              <RefreshCw style={{ width: '1rem', height: '1rem', color: '#06b6d4' }} className={loadingScan ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={`btn btn-icon ${showAddForm ? 'active' : ''}`}
              title="Add Device"
            >
              <Plus style={{ width: '1.2rem', height: '1.2rem' }} />
            </button>
          </div>
        </div>

        {scanMessage && (
          <div className={`status-badge ${loadingScan ? 'active' : ''}`} style={{ marginBottom: '1rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: loadingScan ? '#22d3ee' : '#f43f5e', display: 'inline-block' }}></span>
            <span style={{ fontSize: '0.65rem' }}>{scanMessage}</span>
          </div>
        )}

        <div className="device-list">
          {devices.length === 0 ? (
            <div className="customizer-empty-panel" style={{ padding: '2rem 1rem' }}>
              <p>No controllers found. Scan your network or add one manually.</p>
            </div>
          ) : (
            devices.map(dev => {
              const activeColor = dev.state?.on && dev.state?.color 
                ? `rgb(${dev.state.color[0]}, ${dev.state.color[1]}, ${dev.state.color[2]})` 
                : dev.state?.on ? '#a855f7' : '#64748b';
              return (
                <div 
                  key={dev.id} 
                  className={`device-card ${selectedDeviceId === dev.id ? 'selected' : ''} ${dev.state?.on ? 'active' : ''}`}
                  onClick={() => setSelectedDeviceId(dev.id)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div className="device-card-left">
                    <div 
                      className="device-icon-halo"
                      style={{ 
                        boxShadow: dev.state?.on && dev.state?.color 
                          ? `0 0 12px rgba(${dev.state.color[0]}, ${dev.state.color[1]}, ${dev.state.color[2]}, 0.35)` 
                          : 'none',
                        borderColor: dev.state?.on && dev.state?.color ? `rgba(${dev.state.color[0]}, ${dev.state.color[1]}, ${dev.state.color[2]}, 0.4)` : 'var(--border-color)'
                      }}
                    >
                      <Lightbulb style={{ width: '1.2rem', height: '1.2rem', color: activeColor }} />
                    </div>
                    <div className="device-card-info">
                      <h4>{dev.name || `Device ${dev.id}`}</h4>
                      <p>{dev.ip}</p>
                      <div className="device-tags">
                        <span className="tag">{dev.type}</span>
                        {dev.state?.on && <span className="tag-active-info">Online</span>}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Remove and ignore ${dev.name || dev.ip}?`)) {
                        try {
                          await fetch(`/api/devices/${dev.id}`, { method: 'DELETE' });
                          fetchDevices();
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    }}
                    className="btn btn-icon"
                    style={{ width: '2rem', height: '2rem', border: 'none', background: 'transparent', boxShadow: 'none' }}
                    title="Remove Device"
                  >
                    <Trash2 style={{ width: '1rem', height: '1rem', color: 'var(--text-muted)' }} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

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
              <div style={{ width: '100%' }}>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', height: '2.5rem' }}>
                  Add Device
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
