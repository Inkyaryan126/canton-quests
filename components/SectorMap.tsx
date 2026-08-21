'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/* =========================================================================
   ZONE CONFIGURATION
   -------------------------------------------------------------------------
   Edit, add, or adjust sector zones and coordinates here.
   Each zone corresponds to a physical district in Canton, OH with a center
   GPS coordinate (lat/lng), visual accent color, and radius in meters.
   ========================================================================= */
export interface SectorZone {
  id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  radius: number; // radius in meters
}

export const SECTOR_ZONES: SectorZone[] = [
  {
    id: 'mckinley',
    name: 'McKinley / West Lawn',
    color: '#b46bff',
    lat: 40.8070,
    lng: -81.3936,
    radius: 520,
  },
  {
    id: 'downtown',
    name: 'Downtown / Arts District',
    color: '#ffcf3f',
    lat: 40.8000,
    lng: -81.3758,
    radius: 560,
  },
  {
    id: 'southside',
    name: 'South Side / 9th St',
    color: '#ff3b3b',
    lat: 40.7880,
    lng: -81.3805,
    radius: 480,
  },
];

/* =========================================================================
   TICKER & MOCK DATA DEFINITIONS
   -------------------------------------------------------------------------
   Replace or hook into a live WebSocket / Supabase Realtime channel
   when transitioning from prototype simulation to live event telemetry.
   ========================================================================= */
export interface TickerEntry {
  id: string;
  glyph: string;
  who: string;
  xp: number;
  what: string;
  time: string;
  zoneId: string;
}

const MOCK_VERBS = [
  'completed a quest in',
  'checked in at',
  'solved a cipher in',
  'scanned an emblem in',
  'submitted photo proof in',
];

const MOCK_CALLSIGNS = [
  'Ghost_07',
  'Recruit_19',
  'FieldAgent_3',
  'Operative_X',
  'Nightowl',
  'Cipher_Sal',
  'Agent_Mika',
  'RouteRunner',
  'Vantage_22',
  'Echo_Nine',
  'Blackbird',
  'Agent_Dex',
];

const MOCK_GLYPHS = ['»', '◆', '▲', '●', '■'];

interface SectorMapProps {
  /** Optional custom CSS class name for outer wrapper */
  className?: string;
  /** Initial count of field agents */
  initialPlayers?: number;
  /** Initial count of completed quests */
  initialQuests?: number;
}

export default function SectorMap({
  className = '',
  initialPlayers = 142,
  initialQuests = 318,
}: SectorMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const zoneMarkersRef = useRef<Record<string, L.Marker>>({});

  // React State for Activity Ticker, Stats, and Clock
  const [tickerItems, setTickerItems] = useState<TickerEntry[]>([]);
  const [playerCount, setPlayerCount] = useState<number>(initialPlayers);
  const [questCount, setQuestCount] = useState<number>(initialQuests);
  const [clockString, setClockString] = useState<string>('--:--:--');

  // Trigger pulse animation on a specific zone marker
  const triggerZonePulse = useCallback((zoneId: string) => {
    const marker = zoneMarkersRef.current[zoneId];
    if (!marker) return;

    const el = marker.getElement();
    if (!el) return;

    el.classList.add('active');
    const ring = el.querySelector('.ring') as HTMLElement | null;
    if (ring) {
      ring.classList.remove('pulse');
      // Trigger DOM reflow to restart CSS animation
      void ring.offsetWidth;
      ring.classList.add('pulse');
    }

    setTimeout(() => {
      el.classList.remove('active');
    }, 1300);
  }, []);

  /* =========================================================================
     ACTIVITY TICKER ENGINE (MOCK TELEMETRY)
     -------------------------------------------------------------------------
     HOW TO SWAP IN REAL LIVE API / WEBSOCKET FEED:
     -------------------------------------------------------------------------
     1. Remove or disable the `generateMockTickerEntry` interval below.
     2. Subscribe to Supabase Realtime or custom WebSocket server, e.g.:
          const channel = supabase
            .channel('public:game_telemetry')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quest_submissions' }, (payload) => {
               const newEntry: TickerEntry = {
                 id: payload.new.id,
                 glyph: '◆',
                 who: payload.new.callsign || 'Agent',
                 xp: payload.new.xp_awarded || 25,
                 what: `completed ${payload.new.quest_title}`,
                 time: 'just now',
                 zoneId: payload.new.zone_id || 'downtown',
               };
               setTickerItems((prev) => [newEntry, ...prev.slice(0, 5)]);
               triggerZonePulse(newEntry.zoneId);
               setQuestCount((c) => c + 1);
            })
            .subscribe();
     ========================================================================= */
  const generateMockTickerEntry = useCallback(() => {
    const randomZone = SECTOR_ZONES[Math.floor(Math.random() * SECTOR_ZONES.length)];
    const randomWho = MOCK_CALLSIGNS[Math.floor(Math.random() * MOCK_CALLSIGNS.length)];
    const randomVerb = MOCK_VERBS[Math.floor(Math.random() * MOCK_VERBS.length)];
    const randomGlyph = MOCK_GLYPHS[Math.floor(Math.random() * MOCK_GLYPHS.length)];
    const randomXp = Math.floor(Math.random() * 40) + 10;

    const newEntry: TickerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      glyph: randomGlyph,
      who: randomWho,
      xp: randomXp,
      what: `${randomVerb} ${randomZone.name}`,
      time: 'just now',
      zoneId: randomZone.id,
    };

    setTickerItems((prev) => [newEntry, ...prev.slice(0, 5)]);
    triggerZonePulse(randomZone.id);

    setQuestCount((prev) => prev + 1);
    if (Math.random() > 0.6) {
      setPlayerCount((prev) => prev + 1);
    }
  }, [triggerZonePulse]);

  // Initialize Map safely on client side
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      if (isCancelled || !mapContainerRef.current) return;

      // Center map on downtown Canton, OH
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
        zoomSnap: 0.1,
      }).setView([40.7980, -81.3820], 13.6);

      // Dark CARTO tile layer matching HUD tactical aesthetic
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Render Sector Zones with outer soft glow, crisp inner circle, label & pulse marker
      SECTOR_ZONES.forEach((zone) => {
        // 1. Soft outer glow circle
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius * 1.4,
          color: zone.color,
          weight: 0,
          fillColor: zone.color,
          fillOpacity: 0.05,
          interactive: false,
        }).addTo(map);

        // 2. Crisp inner boundary circle
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius,
          color: zone.color,
          weight: 1.8,
          opacity: 0.9,
          fillColor: zone.color,
          fillOpacity: 0.1,
          interactive: false,
        }).addTo(map);

        // 3. District label
        L.marker([zone.lat, zone.lng], {
          icon: L.divIcon({
            className: 'quest-zone-label',
            html: `<div style="font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.06em;color:${zone.color};text-shadow:0 0 6px ${zone.color};white-space:nowrap;transform:translate(-50%,-${zone.radius / 3.2}px);pointer-events:none;">${zone.name.toUpperCase()}</div>`,
            iconSize: [0, 0],
          }),
          interactive: false,
        }).addTo(map);

        // 4. Center pulse ring marker
        const ringIcon = L.divIcon({
          className: 'quest-pin',
          html: `<div class="ring" style="border-color:${zone.color};"></div><div class="core" style="border-color:${zone.color};box-shadow:0 0 6px ${zone.color};"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        const marker = L.marker([zone.lat, zone.lng], {
          icon: ringIcon,
          interactive: false,
        }).addTo(map);

        zoneMarkersRef.current[zone.id] = marker;
      });

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      zoneMarkersRef.current = {};
    };
  }, []);

  // Telemetry simulation lifecycle
  useEffect(() => {
    // Populate initial items staggered
    const timeouts = [
      setTimeout(generateMockTickerEntry, 400),
      setTimeout(generateMockTickerEntry, 620),
      setTimeout(generateMockTickerEntry, 840),
    ];

    const tickerInterval = setInterval(generateMockTickerEntry, 3400);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(tickerInterval);
    };
  }, [generateMockTickerEntry]);

  // Live HUD 24-hour clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockString(now.toLocaleTimeString('en-US', { hour12: false }));
    };

    updateClock();
    const clockInterval = setInterval(updateClock, 1000);

    return () => clearInterval(clockInterval);
  }, []);

  return (
    <div className={`cq-sector-map-root ${className}`}>
      <style jsx global>{`
        .cq-sector-map-root {
          --bg-void: #0a0d12;
          --bg-panel: #10151d;
          --bg-panel-2: #141b25;
          --signal: #ffb238;
          --signal-dim: #7a5220;
          --signal-glow: rgba(255, 178, 56, 0.35);
          --door-red: #ff3b3b;
          --door-gold: #ffcf3f;
          --door-purple: #b46bff;
          --text-primary: #eef2f5;
          --text-dim: #8a93a3;
          --border-soft: rgba(255, 255, 255, 0.08);
          font-family: 'Rajdhani', var(--font-body), sans-serif;
          color: var(--text-primary);
        }

        .cq-sector-map-root .wrap {
          max-width: 1180px;
          margin: 0 auto;
          padding: 20px 0 40px;
        }

        .cq-sector-map-root .top-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'JetBrains Mono', var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--signal);
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .cq-sector-map-root .top-label .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--signal);
          box-shadow: 0 0 8px var(--signal);
          animation: cqBlink 1.6s ease-in-out infinite;
        }

        @keyframes cqBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }

        .cq-sector-map-root h1 {
          font-weight: 700;
          font-size: clamp(28px, 4.5vw, 48px);
          letter-spacing: 0.01em;
          margin: 0 0 6px;
          line-height: 1.05;
          font-family: 'Rajdhani', var(--font-display), sans-serif;
        }

        .cq-sector-map-root h1 span {
          color: var(--signal);
        }

        .cq-sector-map-root .sub {
          color: var(--text-dim);
          font-size: 16px;
          max-width: 600px;
          margin: 0 0 32px;
          font-weight: 400;
          font-family: 'Rajdhani', var(--font-body), sans-serif;
          line-height: 1.4;
        }

        .cq-sector-map-root .grid-layout {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 18px;
        }

        @media (max-width: 900px) {
          .cq-sector-map-root .grid-layout {
            grid-template-columns: 1fr;
          }
        }

        .cq-sector-map-root .panel {
          background: linear-gradient(180deg, var(--bg-panel), var(--bg-panel-2));
          border: 1px solid var(--border-soft);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        .cq-sector-map-root .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 18px;
          border-bottom: 1px solid var(--border-soft);
          font-family: 'JetBrains Mono', var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--text-dim);
          position: relative;
          z-index: 5;
          background: var(--bg-panel);
        }

        .cq-sector-map-root .panel-head b {
          color: var(--text-primary);
          font-weight: 500;
        }

        /* MAP HOLDER & OVERLAYS */
        .cq-sector-map-root .map-holder {
          position: relative;
          height: 520px;
        }

        .cq-sector-map-root .leaflet-map-canvas {
          width: 100%;
          height: 100%;
          background: #0c1017;
        }

        .cq-sector-map-root .scan-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 450;
          background: repeating-linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.02) 0px,
            rgba(255, 255, 255, 0.02) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: overlay;
        }

        .cq-sector-map-root .radar-sweep {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 820px;
          height: 820px;
          margin: -410px 0 0 -410px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(255, 178, 56, 0.28), transparent 22%);
          animation: cqSpin 6s linear infinite;
          pointer-events: none;
          mix-blend-mode: screen;
          z-index: 400;
        }

        @keyframes cqSpin {
          to {
            transform: rotate(360deg);
          }
        }

        /* MAP MARKER PINS & PULSE ANIMATION */
        .cq-sector-map-root .quest-pin {
          position: relative;
          width: 16px;
          height: 16px;
        }

        .cq-sector-map-root .quest-pin .core {
          position: absolute;
          left: 4px;
          top: 4px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--bg-void);
          border: 2px solid var(--signal);
          box-shadow: 0 0 6px var(--signal-glow);
        }

        .cq-sector-map-root .quest-pin.active .core {
          border-color: #ffffff;
        }

        .cq-sector-map-root .quest-pin .ring {
          position: absolute;
          left: 8px;
          top: 8px;
          width: 0;
          height: 0;
          border-radius: 50%;
          border: 1.4px solid var(--signal);
          opacity: 0;
          transform: translate(-50%, -50%);
        }

        .cq-sector-map-root .quest-pin .ring.pulse {
          animation: cqPing 1.3s cubic-bezier(0, 0.5, 0.5, 1);
        }

        @keyframes cqPing {
          0% {
            width: 2px;
            height: 2px;
            opacity: 0.9;
          }
          100% {
            width: 56px;
            height: 56px;
            opacity: 0;
          }
        }

        .cq-sector-map-root .map-footer {
          position: relative;
          z-index: 5;
          display: flex;
          justify-content: space-between;
          padding: 10px 18px 14px;
          font-family: 'JetBrains Mono', var(--font-mono), monospace;
          font-size: 10px;
          color: var(--text-dim);
          border-top: 1px solid var(--border-soft);
          letter-spacing: 0.06em;
          background: var(--bg-panel);
        }

        /* LEAFLET TWEAKS FOR TACTICAL THEME */
        .cq-sector-map-root .leaflet-container {
          font-family: 'Rajdhani', sans-serif;
          background: #0c1017;
        }

        .cq-sector-map-root .leaflet-control-zoom a {
          background: var(--bg-panel) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-soft) !important;
        }

        .cq-sector-map-root .leaflet-control-attribution {
          background: rgba(10, 13, 18, 0.75) !important;
          color: var(--text-dim) !important;
          font-family: 'JetBrains Mono', monospace;
          font-size: 9px !important;
        }

        .cq-sector-map-root .leaflet-control-attribution a {
          color: var(--text-dim) !important;
        }

        /* TICKER LIST & ITEMS */
        .cq-sector-map-root .ticker-list {
          list-style: none;
          margin: 0;
          padding: 10px 0;
          overflow: hidden;
          max-height: 460px;
        }

        .cq-sector-map-root .ticker-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 10px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          animation: cqEnter 0.5s ease both;
        }

        @keyframes cqEnter {
          from {
            opacity: 0;
            transform: translateY(-6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .cq-sector-map-root .ticker-item .glyph {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--signal);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .cq-sector-map-root .ticker-item .body {
          flex: 1;
          min-width: 0;
        }

        .cq-sector-map-root .ticker-item .who {
          font-weight: 600;
          font-size: 14.5px;
          color: var(--text-primary);
        }

        .cq-sector-map-root .ticker-item .who .tag {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 400;
          font-size: 10px;
          color: var(--signal);
          margin-left: 6px;
          letter-spacing: 0.04em;
        }

        .cq-sector-map-root .ticker-item .what {
          color: var(--text-dim);
          font-size: 12.5px;
          font-family: 'JetBrains Mono', monospace;
          margin-top: 2px;
        }

        .cq-sector-map-root .ticker-item .time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--text-dim);
          white-space: nowrap;
          margin-left: auto;
          padding-top: 3px;
        }

        /* STATS SUMMARY ROW */
        .cq-sector-map-root .stats-row {
          display: flex;
          gap: 1px;
          background: var(--border-soft);
          margin-top: 18px;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--border-soft);
        }

        .cq-sector-map-root .stat {
          flex: 1;
          background: var(--bg-panel);
          padding: 14px 16px;
          text-align: left;
        }

        .cq-sector-map-root .stat .num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 22px;
          color: var(--signal);
          font-weight: 700;
        }

        .cq-sector-map-root .stat .lbl {
          font-size: 10.5px;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 2px;
          font-family: 'JetBrains Mono', monospace;
        }

        /* LEGEND */
        .cq-sector-map-root .legend {
          display: flex;
          gap: 16px;
          margin-top: 16px;
          flex-wrap: wrap;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          color: var(--text-dim);
        }

        .cq-sector-map-root .legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .cq-sector-map-root .legend i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }
      `}</style>

      <div className="wrap">
        {/* Top Status Indicator */}
        <div className="top-label">
          <span className="dot" />
          LIVE SECTOR MAP · DOWNTOWN CANTON, OH
        </div>

        {/* Section Heading & Subtitle */}
        <h1>
          Real coordinates. <span>Real streets.</span>
        </h1>
        <p className="sub">
          Every zone and node below sits on its true GPS location in Canton. Watch the grid react as agents move through the actual city.
        </p>

        {/* Tactical 2-Panel Grid */}
        <div className="grid-layout">
          {/* Left Panel: Live Sector Map */}
          <div className="panel">
            <div className="panel-head">
              <span>SECTOR MAP</span>
              <b>{SECTOR_ZONES.length} ZONES ONLINE</b>
            </div>

            <div className="map-holder">
              <div ref={mapContainerRef} className="leaflet-map-canvas" />
              <div className="radar-sweep" />
              <div className="scan-overlay" />
            </div>

            <div className="map-footer">
              <span>CANTON, OH · 40.7989° N, 81.3784° W</span>
              <span>{clockString}</span>
            </div>
          </div>

          {/* Right Panel: Live Activity Feed */}
          <div className="panel">
            <div className="panel-head">
              <span>ACTIVITY FEED</span>
              <b>REAL-TIME</b>
            </div>

            <ul className="ticker-list">
              {tickerItems.map((item) => (
                <li key={item.id} className="ticker-item">
                  <span className="glyph">{item.glyph}</span>
                  <div className="body">
                    <div className="who">
                      {item.who}
                      <span className="tag">XP +{item.xp}</span>
                    </div>
                    <div className="what">{item.what}</div>
                  </div>
                  <span className="time">{item.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat">
            <div className="num">{playerCount}</div>
            <div className="lbl">Agents in field</div>
          </div>
          <div className="stat">
            <div className="num">{questCount}</div>
            <div className="lbl">Quests completed</div>
          </div>
          <div className="stat">
            <div className="num">{questCount}</div>
            <div className="lbl">Drawing entries</div>
          </div>
        </div>

        {/* Legend */}
        <div className="legend">
          {SECTOR_ZONES.map((zone) => (
            <span key={zone.id}>
              <i style={{ background: zone.color }} />
              {zone.name} zone
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
