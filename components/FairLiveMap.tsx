'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PublicGameFeedItem } from '@/lib/types';
import { DistrictInfo } from '@/components/spectator/DistrictActivityView';

/* =========================================================================
   STARK COUNTY FAIRGROUNDS — SECTOR ZONE CONFIGURATION
   -------------------------------------------------------------------------
   Each zone corresponds to a physical sector on the Stark County Fairgrounds
   campus (305 Wertz Ave SW, Canton, OH 44708) with real GPS coordinates,
   visual accent colors, and boundary radii in meters.
   ========================================================================= */
export interface FairSectorZone {
  id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  radius: number; // radius in meters
  description: string;
}

export const FAIR_SECTOR_ZONES: FairSectorZone[] = [
  {
    id: 'grandstand',
    name: 'Grandstand & Track Area',
    color: '#ff3b3b', // Crimson
    lat: 40.8060,
    lng: -81.3992,
    radius: 110,
    description: 'Grandstand arena, track perimeter, and main staging grounds.',
  },
  {
    id: 'midway',
    name: 'Midway & Carnival Plaza',
    color: '#ffcf3f', // Fair Gold
    lat: 40.8042,
    lng: -81.3975,
    radius: 120,
    description: 'Central rides, carnival games, and main plaza corridors.',
  },
  {
    id: 'exhibition',
    name: 'Exhibition & Agri Pavilion',
    color: '#00f0ff', // Electric Cyan
    lat: 40.8025,
    lng: -81.4012,
    radius: 130,
    description: 'Livestock barns, creative arts buildings, and exhibition hall rows.',
  },
  {
    id: 'food_row',
    name: 'South Gate & Food Row',
    color: '#10b981', // Emerald
    lat: 40.8014,
    lng: -81.3988,
    radius: 110,
    description: 'South fairground entrance, concessions, and food court alley.',
  },
];

/* =========================================================================
   TICKER & TELEMETRY DEFINITIONS
   ========================================================================= */
export interface FairTickerEntry {
  id: string;
  glyph: string;
  who: string;
  what: string;
  time: string;
  zoneId: string;
  badgeText: string;
  urgency?: 'info' | 'warning' | 'flash' | 'urgent';
}

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return 'just now';
  try {
    const diffSeconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
    if (diffSeconds < 60) return 'just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    return `${Math.floor(diffSeconds / 3600)}h ago`;
  } catch {
    return 'just now';
  }
}

export function resolveFairZoneId(text?: string): string {
  if (!text) return 'midway';
  const lower = text.toLowerCase();
  if (
    lower.includes('grandstand') ||
    lower.includes('track') ||
    lower.includes('arena') ||
    lower.includes('stage') ||
    /signal (0?[1-5])\b/.test(lower) ||
    /fair-core-0[1-5]/.test(lower)
  ) {
    return 'grandstand';
  }
  if (
    lower.includes('exhibit') ||
    lower.includes('agri') ||
    lower.includes('barn') ||
    lower.includes('livestock') ||
    /signal (1[1-5])\b/.test(lower) ||
    /fair-core-1[1-5]/.test(lower)
  ) {
    return 'exhibition';
  }
  if (
    lower.includes('food') ||
    lower.includes('gate') ||
    lower.includes('concession') ||
    lower.includes('bonus') ||
    /signal (1[6-9]|20)\b/.test(lower) ||
    /fair-core-(1[6-9]|20)/.test(lower) ||
    lower.includes('fair-bonus')
  ) {
    return 'food_row';
  }
  if (
    lower.includes('midway') ||
    lower.includes('carnival') ||
    lower.includes('plaza') ||
    lower.includes('ride') ||
    /signal (0?[6-9]|10)\b/.test(lower) ||
    /fair-core-(0[6-9]|10)/.test(lower)
  ) {
    return 'midway';
  }
  return 'midway';
}

export interface FairLiveMapProps {
  /** Optional custom CSS class name for outer wrapper */
  className?: string;
  /** Real sanitized public feed items from server */
  feed?: PublicGameFeedItem[];
  /** Real active spectator/player count from server */
  activeSpectatorCount?: number;
  /** Real district/sector activity info from server */
  districts?: DistrictInfo[];
  /** Optional auto-refresh interval in ms when polling standalone (default: 10000ms) */
  pollIntervalMs?: number;
}

export default function FairLiveMap({
  className = '',
  feed: feedProp,
  activeSpectatorCount: countProp,
  districts,
  pollIntervalMs = 10000,
}: FairLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const zoneMarkersRef = useRef<Record<string, L.Marker>>({});

  // Local state for feed & polling
  const [internalFeed, setInternalFeed] = useState<PublicGameFeedItem[]>(feedProp || []);
  const [internalCount, setInternalCount] = useState<number>(countProp ?? 0);
  const [tickerItems, setTickerItems] = useState<FairTickerEntry[]>([]);
  const [clockString, setClockString] = useState<string>('--:--:--');

  // Sync props if provided
  useEffect(() => {
    if (feedProp !== undefined) {
      setInternalFeed(feedProp);
    }
  }, [feedProp]);

  useEffect(() => {
    if (countProp !== undefined) {
      setInternalCount(countProp);
    }
  }, [countProp]);

  // Polling standalone feed if feedProp is not provided
  useEffect(() => {
    if (feedProp !== undefined) return;

    let isMounted = true;
    const fetchFairFeed = async () => {
      try {
        const res = await fetch('/api/game/spectator?action=feed&eventSlug=fair-qr-hunt');
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.feed)) {
          setInternalFeed(data.feed);
        }
      } catch {
        // Silently fail on network hiccups
      }
    };

    fetchFairFeed();
    const interval = setInterval(fetchFairFeed, pollIntervalMs);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [feedProp, pollIntervalMs]);

  // Trigger pulse animation on a specific fair zone marker
  const triggerFairZonePulse = useCallback((zoneId: string) => {
    const marker = zoneMarkersRef.current[zoneId];
    if (!marker) return;

    const el = marker.getElement();
    if (!el) return;

    el.classList.add('active');
    const ring = el.querySelector('.ring') as HTMLElement | null;
    if (ring) {
      ring.classList.remove('pulse');
      void ring.offsetWidth;
      ring.classList.add('pulse');
    }

    setTimeout(() => {
      el.classList.remove('active');
    }, 1300);
  }, []);

  // Initialize Leaflet Map centered on Stark County Fairgrounds
  useEffect(() => {
    let isCancelled = false;

    const initMap = async () => {
      if (typeof window === 'undefined' || !mapContainerRef.current || mapInstanceRef.current) return;

      const L = (await import('leaflet')).default;

      if (isCancelled || !mapContainerRef.current) return;

      // Center on Stark County Fairgrounds campus
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
        zoomSnap: 0.1,
      }).setView([40.8038, -81.3995], 16.2);

      // Dark CARTO tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Render Fairground Zones
      FAIR_SECTOR_ZONES.forEach((zone) => {
        // 1. Soft outer glow circle
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius * 1.35,
          color: zone.color,
          weight: 0,
          fillColor: zone.color,
          fillOpacity: 0.06,
          interactive: false,
        }).addTo(map);

        // 2. Crisp inner boundary circle
        L.circle([zone.lat, zone.lng], {
          radius: zone.radius,
          color: zone.color,
          weight: 1.8,
          opacity: 0.9,
          fillColor: zone.color,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);

        // 3. Zone label anchored north
        const latOffsetDeg = zone.radius / 111320;
        L.marker([zone.lat + latOffsetDeg, zone.lng], {
          icon: L.divIcon({
            className: 'fair-zone-label',
            html: `<div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:.06em;color:${zone.color};text-shadow:0 0 6px ${zone.color};white-space:nowrap;transform:translate(-50%,-100%);pointer-events:none;padding-bottom:3px;">${zone.name.toUpperCase()}</div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          }),
          interactive: false,
        }).addTo(map);

        // 4. Center pulse ring marker
        const ringIcon = L.divIcon({
          className: 'quest-pin',
          html: `<div class="ring" style="border-color:${zone.color};"></div><div class="core" style="border-color:${zone.color};box-shadow:0 0 8px ${zone.color};background:${zone.color};"></div>`,
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

  // Process live feed to Fair Ticker
  useEffect(() => {
    if (internalFeed && internalFeed.length > 0) {
      const mapped: FairTickerEntry[] = internalFeed.slice(0, 8).map((item) => {
        const zoneId = resolveFairZoneId(item.headline || item.body || item.districtName);
        const glyph = item.isHost
          ? '📡'
          : item.urgency === 'flash'
          ? '⚡'
          : item.urgency === 'urgent'
          ? '🚨'
          : item.headline?.toLowerCase().includes('bonus')
          ? '🏆'
          : '🎯';
        const who = item.isHost
          ? 'FAIR COMMAND'
          : item.districtName
          ? `FAIR OP // ${item.districtName.toUpperCase()}`
          : 'FAIR QR AGENT';
        const badgeText = item.isHost
          ? 'HOST'
          : item.urgency === 'flash'
          ? 'FLASH'
          : item.headline?.toLowerCase().includes('bonus')
          ? 'BONUS'
          : 'SIGNAL';

        return {
          id: item.id,
          glyph,
          who,
          what: item.headline || item.body || 'Fair signal activity recorded',
          time: formatTimeAgo(item.publishedAt || item.createdAt),
          zoneId,
          badgeText,
          urgency: item.urgency,
        };
      });

      setTickerItems(mapped);

      // Pulse active zone on latest item
      if (mapped.length > 0 && mapped[0].zoneId) {
        triggerFairZonePulse(mapped[0].zoneId);
      }
    } else {
      setTickerItems([]);
    }
  }, [internalFeed, triggerFairZonePulse]);

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
    <div className={`cq-fair-map-root ${className}`}>
      <style jsx global>{`
        .cq-fair-map-root {
          --bg-void: #0a0d12;
          --bg-panel: #10151d;
          --bg-panel-2: #141b25;
          --signal-cyan: #00f0ff;
          --signal-gold: #ffcf3f;
          --signal-crimson: #ff3b3b;
          --signal-dim: #164e63;
          --signal-glow: rgba(0, 240, 255, 0.35);
          --text-primary: #eef2f5;
          --text-dim: #8a93a3;
          --border-soft: rgba(255, 255, 255, 0.08);
          font-family: 'Rajdhani', var(--font-body), sans-serif;
          color: var(--text-primary);
        }

        .cq-fair-map-root .wrap {
          max-width: 1180px;
          margin: 0 auto;
          padding: 16px 0 24px;
        }

        .cq-fair-map-root .top-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'JetBrains Mono', var(--font-mono), monospace;
          font-size: 11px;
          letter-spacing: 0.14em;
          color: var(--signal-cyan);
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .cq-fair-map-root .top-label .dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--signal-cyan);
          box-shadow: 0 0 10px var(--signal-cyan);
          animation: cqFairBlink 1.6s ease-in-out infinite;
        }

        @keyframes cqFairBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.25; }
        }

        .cq-fair-map-root h2.title {
          font-weight: 800;
          font-size: clamp(24px, 3.5vw, 36px);
          letter-spacing: 0.01em;
          margin: 0 0 6px;
          line-height: 1.1;
          font-family: 'Rajdhani', var(--font-display), sans-serif;
          text-transform: uppercase;
        }

        .cq-fair-map-root h2.title span {
          color: var(--signal-cyan);
        }

        .cq-fair-map-root .sub {
          color: var(--text-dim);
          font-size: 14.5px;
          max-width: 680px;
          margin: 0 0 24px;
          font-weight: 400;
          font-family: 'Rajdhani', var(--font-body), sans-serif;
          line-height: 1.4;
        }

        .cq-fair-map-root .grid-layout {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 16px;
        }

        @media (max-width: 900px) {
          .cq-fair-map-root .grid-layout {
            grid-template-columns: 1fr;
          }
        }

        .cq-fair-map-root .panel {
          background: linear-gradient(180deg, var(--bg-panel), var(--bg-panel-2));
          border: 1px solid var(--border-soft);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        }

        .cq-fair-map-root .panel-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
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

        .cq-fair-map-root .panel-head b {
          color: var(--signal-cyan);
          font-weight: 600;
        }

        /* MAP CONTAINER & OVERLAYS */
        .cq-fair-map-root .map-holder {
          position: relative;
          height: 480px;
        }

        .cq-fair-map-root .leaflet-map-canvas {
          width: 100%;
          height: 100%;
          background: #0c1017;
        }

        .cq-fair-map-root .scan-overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 450;
          background: repeating-linear-gradient(
            to bottom,
            rgba(0, 240, 255, 0.03) 0px,
            rgba(0, 240, 255, 0.03) 1px,
            transparent 1px,
            transparent 3px
          );
          mix-blend-mode: overlay;
        }

        .cq-fair-map-root .radar-sweep {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 760px;
          height: 760px;
          margin: -380px 0 0 -380px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(0, 240, 255, 0.28), transparent 24%);
          animation: cqFairSpin 6s linear infinite;
          pointer-events: none;
          mix-blend-mode: screen;
          z-index: 400;
        }

        @keyframes cqFairSpin {
          to {
            transform: rotate(360deg);
          }
        }

        /* PULSE PINS */
        .cq-fair-map-root .quest-pin {
          position: relative;
          width: 16px;
          height: 16px;
        }

        .cq-fair-map-root .quest-pin .core {
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          border: 2px solid;
        }

        .cq-fair-map-root .quest-pin .ring {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid;
          opacity: 0;
          transform: scale(0.5);
        }

        .cq-fair-map-root .quest-pin.active .ring.pulse {
          animation: cqFairRingPulse 1.2s ease-out forwards;
        }

        @keyframes cqFairRingPulse {
          0% {
            opacity: 1;
            transform: scale(0.6);
          }
          100% {
            opacity: 0;
            transform: scale(2.4);
          }
        }

        .cq-fair-map-root .map-footer {
          position: relative;
          z-index: 5;
          display: flex;
          justify-content: space-between;
          padding: 10px 16px;
          font-family: 'JetBrains Mono', var(--font-mono), monospace;
          font-size: 10px;
          color: var(--text-dim);
          border-top: 1px solid var(--border-soft);
          letter-spacing: 0.06em;
          background: var(--bg-panel);
        }

        /* TICKER */
        .cq-fair-map-root .ticker-list {
          list-style: none;
          margin: 0;
          padding: 8px 0;
          overflow: hidden;
          max-height: 420px;
        }

        .cq-fair-map-root .ticker-item {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          animation: cqFairEnter 0.4s ease both;
        }

        @keyframes cqFairEnter {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .cq-fair-map-root .ticker-item .glyph {
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          color: var(--signal-cyan);
          margin-top: 2px;
          flex-shrink: 0;
        }

        .cq-fair-map-root .ticker-item .body {
          flex: 1;
          min-width: 0;
        }

        .cq-fair-map-root .ticker-item .who {
          font-weight: 700;
          font-size: 13.5px;
          color: var(--text-primary);
        }

        .cq-fair-map-root .ticker-item .who .tag {
          font-family: 'JetBrains Mono', monospace;
          font-weight: 500;
          font-size: 9.5px;
          color: var(--signal-cyan);
          margin-left: 6px;
          letter-spacing: 0.04em;
        }

        .cq-fair-map-root .ticker-item .what {
          color: var(--text-dim);
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          margin-top: 2px;
        }

        .cq-fair-map-root .ticker-item .time {
          font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px;
          color: var(--text-dim);
          white-space: nowrap;
          margin-left: auto;
          padding-top: 2px;
        }

        /* STATS ROW */
        .cq-fair-map-root .stats-row {
          display: flex;
          gap: 1px;
          background: var(--border-soft);
          margin-top: 16px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border-soft);
        }

        .cq-fair-map-root .stat {
          flex: 1;
          background: var(--bg-panel);
          padding: 12px 14px;
          text-align: left;
        }

        .cq-fair-map-root .stat .num {
          font-family: 'JetBrains Mono', monospace;
          font-size: 20px;
          color: var(--signal-cyan);
          font-weight: 700;
        }

        .cq-fair-map-root .stat .lbl {
          font-size: 10px;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-top: 2px;
          font-family: 'JetBrains Mono', monospace;
        }

        /* LEGEND */
        .cq-fair-map-root .legend {
          display: flex;
          gap: 14px;
          margin-top: 14px;
          flex-wrap: wrap;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          color: var(--text-dim);
        }

        .cq-fair-map-root .legend span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .cq-fair-map-root .legend i {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        /* REDUCED MOTION */
        @media (prefers-reduced-motion: reduce) {
          .cq-fair-map-root .top-label .dot {
            animation: none !important;
            opacity: 1 !important;
          }

          .cq-fair-map-root .radar-sweep {
            display: none !important;
            animation: none !important;
          }

          .cq-fair-map-root .quest-pin .ring.pulse {
            animation: none !important;
            opacity: 0 !important;
          }

          .cq-fair-map-root .ticker-item {
            animation: none !important;
            transform: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      <div className="wrap">
        {/* Top Status Indicator */}
        <div className="top-label">
          <span className="dot" />
          STARK COUNTY FAIRGROUNDS RADAR GRID · CANTON, OH
        </div>

        {/* Section Heading & Subtitle */}
        <h2 className="title">
          Live Fairgrounds Grid. <span>Real-Time Signals.</span>
        </h2>
        <p className="sub">
          Live tactical telemetry across the Stark County Fairgrounds campus. Watch Signal discoveries, daily bonuses, and fair activity unfold in real time.
        </p>

        {/* Tactical 2-Panel Grid */}
        <div className="grid-layout">
          {/* Left Panel: Live Fairgrounds Map */}
          <div className="panel">
            <div className="panel-head">
              <span>FAIRGROUNDS SECTOR RADAR</span>
              <b>{FAIR_SECTOR_ZONES.length} FAIR ZONES ONLINE</b>
            </div>

            <div className="map-holder">
              <div ref={mapContainerRef} className="leaflet-map-canvas" />
              <div className="radar-sweep" />
              <div className="scan-overlay" />
            </div>

            <div className="map-footer">
              <span>STARK COUNTY FAIRGROUNDS · 40.8038° N, 81.3995° W</span>
              <span>{clockString}</span>
            </div>
          </div>

          {/* Right Panel: Live Fair Activity Feed */}
          <div className="panel">
            <div className="panel-head">
              <span>PUBLIC FAIR INTEL</span>
              <b>{internalFeed && internalFeed.length > 0 ? `${internalFeed.length} DISPATCHES` : 'STANDBY'}</b>
            </div>

            {tickerItems.length === 0 ? (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '10px' }}>🎪</div>
                <div
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '11px',
                    color: 'var(--signal-cyan)',
                    letterSpacing: '0.08em',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  STANDBY // ALL FAIR SECTORS ONLINE
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', maxWidth: '280px', margin: '0 auto', lineHeight: 1.4 }}>
                  Stark County Fairgrounds grid is listening. Live scan dispatches and signal claims will stream here as players explore.
                </div>
              </div>
            ) : (
              <ul className="ticker-list">
                {tickerItems.map((item) => (
                  <li key={item.id} className="ticker-item">
                    <span className="glyph">{item.glyph}</span>
                    <div className="body">
                      <div className="who">
                        {item.who}
                        <span className="tag">{item.badgeText}</span>
                      </div>
                      <div className="what">{item.what}</div>
                    </div>
                    <span className="time">{item.time}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-row">
          <div className="stat">
            <div className="num">{internalCount}</div>
            <div className="lbl">Active Fair Agents</div>
          </div>
          <div className="stat">
            <div className="num">{FAIR_SECTOR_ZONES.length}</div>
            <div className="lbl">Fair Zones Online</div>
          </div>
          <div className="stat">
            <div className="num">{internalFeed?.length ?? 0}</div>
            <div className="lbl">Signal Dispatches</div>
          </div>
        </div>

        {/* Legend */}
        <div className="legend">
          {FAIR_SECTOR_ZONES.map((zone) => (
            <span key={zone.id}>
              <i style={{ background: zone.color }} />
              {zone.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
