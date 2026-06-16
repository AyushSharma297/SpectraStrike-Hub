import React from 'react';
import { Cpu, Tv, Sliders, Play, Film, Gamepad2, Info, Sparkles, Zap, Shield, Sun } from 'lucide-react';

export default function AboutPanel() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '950px', margin: '0 auto', paddingBottom: '3rem' }}>
      
      {/* HERO SECTION */}
      <div className="glass-card" style={{ 
        position: 'relative', 
        overflow: 'hidden', 
        padding: '2.5rem', 
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ 
          position: 'absolute', 
          top: '-20%', 
          right: '-10%', 
          width: '300px', 
          height: '300px', 
          background: 'radial-gradient(circle, var(--accent-purple-glow) 0%, transparent 70%)',
          pointerEvents: 'none',
          opacity: 0.6
        }} />
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Sparkles size={24} style={{ color: 'var(--accent-cyan)', filter: 'drop-shadow(0 0 8px var(--accent-cyan-glow))' }} />
          <span style={{ fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--accent-cyan)' }}>Ambient Intelligence</span>
        </div>
        
        <h1 style={{ 
          fontFamily: 'var(--font-family-header)', 
          fontSize: '2.2rem', 
          fontWeight: '900', 
          letterSpacing: '0.05em', 
          background: 'linear-gradient(to right, #c084fc, #818cf8, #22d3ee)', 
          WebkitBackgroundClip: 'text', 
          WebkitTextFillColor: 'transparent',
          textTransform: 'uppercase',
          margin: 0
        }}>
          SpectraStrike Hub
        </h1>
        
        <p style={{ fontSize: '0.92rem', color: 'var(--text-main)', lineHeight: '1.6', maxWidth: '650px', margin: 0 }}>
          SpectraStrike Hub is a high-performance, tactical ambient synchronization command center. By combining local screen capture pipelines with hardware-optimized downsampling algorithms, it transforms real-time monitor feeds into rich ambient lightscapes across WLED, WiZ, OpenRGB, and Windows Dynamic Lighting controllers.
        </p>
      </div>

      {/* TECHNICAL BLUEPRINT (HOW IT WORKS) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
        
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Cpu size={18} style={{ color: 'var(--accent-purple)' }} />
            <span className="card-title" style={{ margin: 0 }}>System Pipeline blueprint</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
            
            {/* Pipeline Step 1 */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ 
                background: 'rgba(168, 85, 247, 0.15)', 
                color: '#c4b5fd', 
                fontWeight: 'bold', 
                borderRadius: '8px', 
                width: '1.75rem', 
                height: '1.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '0.8rem',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}>1</div>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>Desktop Grabber (MSS Pipeline)</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  A multi-threaded Python screen capture daemon (using `mss`) captures the primary or secondary monitor framebuffer at up to 60 frames per second with minimal CPU overhead.
                </p>
              </div>
            </div>

            {/* Pipeline Step 2 */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ 
                background: 'rgba(168, 85, 247, 0.15)', 
                color: '#c4b5fd', 
                fontWeight: 'bold', 
                borderRadius: '8px', 
                width: '1.75rem', 
                height: '1.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '0.8rem',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}>2</div>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>Coordinate Zone Cropping</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  The raw framebuffer is cropped dynamically based on configured margins (Left, Right, Top, Bottom, or Center bounds) to isolate coordinates corresponding to each device's physical layout position.
                </p>
              </div>
            </div>

            {/* Pipeline Step 3 */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ 
                background: 'rgba(168, 85, 247, 0.15)', 
                color: '#c4b5fd', 
                fontWeight: 'bold', 
                borderRadius: '8px', 
                width: '1.75rem', 
                height: '1.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '0.8rem',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}>3</div>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>Heuristic Color Computation</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  The isolated zone image undergoes bilinear downsampling and algorithmic filtering. It calculates average, vibrant, dominant, neon, or temperature-biased colors, correcting non-linear LED outputs.
                </p>
              </div>
            </div>

            {/* Pipeline Step 4 */}
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ 
                background: 'rgba(168, 85, 247, 0.15)', 
                color: '#c4b5fd', 
                fontWeight: 'bold', 
                borderRadius: '8px', 
                width: '1.75rem', 
                height: '1.75rem', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: '0.8rem',
                border: '1px solid rgba(168, 85, 247, 0.3)'
              }}>4</div>
              <div>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-main)', margin: 0 }}>UDP Real-Time Streaming (DDP/WARLS)</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: '1.4' }}>
                  Computed colors are formatted into high-speed raw network packets and streamed via connectionless UDP socket protocols directly to light strips, minimizing latency compared to HTTP REST calls.
                </p>
              </div>
            </div>

          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders size={18} style={{ color: 'var(--accent-cyan)' }} />
            <span className="card-title" style={{ margin: 0 }}>Supported Architectures</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(2, 6, 23, 0.25)', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <strong style={{ color: '#c4b5fd' }}>WLED Strips</strong>
              <span style={{ color: 'var(--text-secondary)' }}>Real-time UDP Stream (DDP protocol)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(2, 6, 23, 0.25)', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <strong style={{ color: '#67e8f9' }}>WiZ Smart Bulbs</strong>
              <span style={{ color: 'var(--text-secondary)' }}>UDP Socket Commands (port 38899)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(2, 6, 23, 0.25)', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <strong style={{ color: '#fb7185' }}>OpenRGB PC Lights</strong>
              <span style={{ color: 'var(--text-secondary)' }}>SDK Socket Stream (PC accessories)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem 0.85rem', background: 'rgba(2, 6, 23, 0.25)', borderRadius: '12px', border: '1px solid var(--border-color)', fontSize: '0.82rem' }}>
              <strong style={{ color: '#fbbf24' }}>Windows Dynamic Lights</strong>
              <span style={{ color: 'var(--text-secondary)' }}>WinRT API integration (Local HID)</span>
            </div>

          </div>

          <div style={{ 
            background: 'rgba(6, 182, 212, 0.05)', 
            padding: '0.85rem 1rem', 
            borderRadius: '14px', 
            border: '1px dashed rgba(6, 182, 212, 0.2)',
            fontSize: '0.72rem',
            lineHeight: '1.4',
            color: 'var(--text-secondary)'
          }}>
            <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '0.2rem' }}>⚡ Calibration Engine:</strong>
            Supports matrix-based color correction, gamma curve tailoring, temperature scaling (Kelvins), and luminance limits to align LED glows to your screen colors.
          </div>
        </div>

      </div>

      {/* AMBIENT CAPTURE MODES MATRIX */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Tv size={18} style={{ color: 'var(--accent-purple)' }} />
          <span className="card-title" style={{ margin: 0 }}>Sync Sampling Modes Explained</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
          Nine ambient sampling strategies tailored to various screen capture sizes, color requirements, and response latencies.
        </p>

        <div style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', width: '25%' }}>Sampling Mode</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', width: '50%' }}>Algorithmic Behavior</th>
                <th style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', width: '25%' }}>Best Suited Content</th>
              </tr>
            </thead>
            <tbody>
              
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Average Sector RGB</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Downsamples the entire crop to 1x1. Blends all sector colors into a single uniform average. Slow, smooth transitions.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  Documentaries, slow sceneries, desk work
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Vibrant Spot Color</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Downsamples to 8x8. Prioritizes the pixel with the highest saturation and value score. Ignores dark and grey regions.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  Animated films, vibrant sci-fi games
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Dominant Sector Color</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Quantizes pixels into bins. Finds the most populated color region and averages it. Represents the main screen tint.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  General movies, web browsing
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Movie Friendly (Max Ambient)</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Pixelates crop, filters black letterbox bars & dark/grey zones, extracts dominant color, boosts value/saturation, and applies gamma curves for rich LED responses.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  Cinematic movies, dark films, TV shows
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Tactical Gaming (Insta-Flash)</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Low-latency 8x8 analysis. Highly weights flash transients. Bypasses smoothing and scales peak color to full output (255) for instant game triggers.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  First-person shooters, fighting games, action
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Relaxing Warm Chill</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Soft 4x4 blend. Shifts cool colors (greens, blues, purples) to cozy warm ambers and sunset golds. Dampens blue-light output manually.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  Late-night reading, bedtime relaxation, low eye-strain
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Sci-Fi Neon (Cyberpunk)</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Snaps screen colors to cyberpunk-inspired neon accents: Magenta, Cyan, purple, neon orange, acid green. Maximizes saturation output.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  Cyberpunk films, synthwave music, neon games
                </td>
              </tr>

              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Spotlight Center Focus</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Crops strictly to the center 20% of the screen. Computes bilinear average color. Direct ambient feedback of the screen focus.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  FPS crosshair indicators, center-focused video
                </td>
              </tr>

              <tr>
                <td style={{ padding: '0.75rem 0.5rem' }}>
                  <strong style={{ color: 'var(--text-main)' }}>Edge Border Mapping</strong>
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  Maps physical borders directly in a grid of 32x32. Sends coordinate-specific colors to individual LEDs on a strip, wrapping the screen image.
                </td>
                <td style={{ padding: '0.75rem 0.5rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
                  Lightstrips behind TVs/Monitors (Cinema/Monitor bias)
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* CURATED MEDIA MATCHING & BEST PRACTICES */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Film size={18} style={{ color: 'var(--accent-cyan)' }} />
          <span className="card-title" style={{ margin: 0 }}>Curated Media Suggestions & Settings</span>
        </div>
        
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.5' }}>
          Optimize your ambient environment for key media titles. The combination of sampling modes and calibration tailors the light response to specific content styles.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          
          {/* Card 1 */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>Blade Runner 2049 / TRON</span>
              <span className="tag" style={{ background: 'rgba(168,85,247,0.15)', color: '#c4b5fd' }}>Sci-Fi</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Pair with <strong style={{ color: 'var(--accent-purple)' }}>Sci-Fi Neon (Cyberpunk)</strong> mode. The electric magenta, cyan, and gold tones will dynamically mirror the neon streetscapes and synthwave atmospheres.
            </p>
          </div>

          {/* Card 2 */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>Spider-Man: Spider-Verse</span>
              <span className="tag" style={{ background: 'rgba(6,182,212,0.15)', color: '#67e8f9' }}>Animated</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Pair with <strong style={{ color: 'var(--accent-cyan)' }}>Vibrant Spot Color</strong>. Captures the high-contrast comic book spot hues (acid greens, hot pinks, comic yellows) and maps them cleanly.
            </p>
          </div>

          {/* Card 3 */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>Call of Duty / Apex Legends</span>
              <span className="tag" style={{ background: 'rgba(244,63,94,0.15)', color: '#fda4af' }}>Gaming</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Use <strong style={{ color: 'var(--accent-rose)' }}>Tactical Gaming</strong> and enable <strong style={{ color: 'var(--accent-rose)' }}>Gaming Muzzle Flash Mode</strong>. Lights will flash instantly with gunshots and explode in red colors on shield break or damage.
            </p>
          </div>

          {/* Card 4 */}
          <div style={{ background: 'rgba(15, 23, 42, 0.4)', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-main)' }}>Nature Documentaries (Earth)</span>
              <span className="tag" style={{ background: 'rgba(16,185,129,0.15)', color: '#a7f3d0' }}>Scenic</span>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Pair with <strong style={{ color: 'var(--accent-cyan)' }}>Average Sector RGB</strong>. The soft blending of forest greens, ocean blues, and sky gradients creates a soothing, seamless extension of nature scenery.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
}
