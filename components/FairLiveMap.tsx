'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PublicGameFeedItem } from '@/lib/types';
import { DistrictInfo } from '@/components/spectator/DistrictActivityView';

/* =========================================================================
   STARK COUNTY FAIRGROUNDS — CANONICAL MAP CENTER
   -------------------------------------------------------------------------
   The single source of truth for where the Fair QR Hunt live map opens.
   Every consumer (the Leaflet setView call, the map-footer coordinate
   readout) derives from this one constant — never hardcode this pair
   anywhere else in this file.
   ========================================================================= */
export const FAIR_MAP_CENTER = {
  lat: 40.80192286342209,
  lng: -81.40825970719298,
} as const;

const FAIR_MAP_CENTER_LABEL = `${FAIR_MAP_CENTER.lat.toFixed(4)}° N, ${Math.abs(FAIR_MAP_CENTER.lng).toFixed(4)}° W`;

/* =========================================================================
   STARK COUNTY FAIRGROUNDS — SECTOR ZONE CONFIGURATION
   -------------------------------------------------------------------------
   Four real operational sectors, georeferenced against the official Stark
   County Fairgrounds map (starkcountyfair.com) and cross-checked against
   OpenStreetMap's real street/property geometry (Wertz Ave NW / Roslyn Ave
   NW / Third St NW, the actual fairgrounds boundary polygon). The transform
   used to derive these was validated to within ~1 meter against the known
   FAIR_MAP_CENTER point before being applied to the four sectors below.

   These are still APPROXIMATE SECTOR CENTERS, not survey-grade coordinates —
   the source map is a hand-illustrated fair program graphic, not drawn to
   scale, so treat each value as "roughly here," never as a precise point.

   Critically, these are NOT verified per-Signal QR placements. Every Fair
   quest currently has location_id = NULL / placement_details = NULL /
   placed_at = NULL in the database — no Signal has a confirmed physical
   location yet. These sectors exist to give the search grid a sense of
   place; the resolveFairZoneId() Signal→sector mapping below is a cosmetic
   text heuristic (Signal number ranges), not real placement data, and must
   never be presented to a player as "this is where Signal N actually is."

   Real per-Signal markers render separately, from FairPlacedSignal props
   only (see below) — never derived from, or falling back to, a sector
   center.
   ========================================================================= */
export interface FairSectorZone {
  id: string;
  name: string;
  color: string;
  lat: number;
  lng: number;
  radius: number; // approximate radius in meters — not survey-grade
  description: string;
}

export const FAIR_SECTOR_ZONES: FairSectorZone[] = [
  {
    id: 'track_grandstand',
    name: 'Track / Grandstand',
    color: '#ff3b3b', // Crimson
    lat: 40.8038592,
    lng: -81.4092032,
    radius: 130,
    description: 'The oval race track, Grandstand, Speed Stables, and the Wertz Avenue side of the grounds.',
  },
  {
    id: 'livestock',
    name: 'Livestock',
    color: '#ffcf3f', // Fair Gold
    lat: 40.8047277,
    lng: -81.4108493,
    radius: 106,
    description: 'The dairy, beef, goat, sheep, swine, poultry, and horse/pony barns north of the grounds.',
  },
  {
    id: 'pavilion_exhibits',
    name: 'Pavilion / Exhibits',
    color: '#00f0ff', // Electric Cyan
    lat: 40.8027898,
    lng: -81.4107411,
    radius: 166,
    description: 'The Pavilion, Exhibition Hall, Art Hall, Farm Bureau, Grange, and Jr. Fair 4-H exhibit buildings.',
  },
  {
    id: 'midway_amusement',
    name: 'Midway / Amusement',
    color: '#10b981', // Emerald
    lat: 40.8021115,
    lng: -81.4099042,
    radius: 113,
    description: 'The Midway, Kiddyland, games, and amusement area toward the Third Street / Gate C side.',
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

/**
 * Best-guess sector for a piece of ticker text — a cosmetic heuristic for
 * which sector circle briefly pulses, NOT a claim about where a Signal
 * actually is. "Food Row" no longer exists as a sector (the official
 * fairgrounds map shows food distributed throughout the grounds, not
 * concentrated in one place), so food/concession keywords no longer route
 * anywhere special.
 */
export function resolveFairZoneId(text?: string): string {
  if (!text) return 'track_grandstand';
  const lower = text.toLowerCase();
  if (
    lower.includes('track') ||
    lower.includes('grandstand') ||
    lower.includes('speed stable') ||
    lower.includes('horse show') ||
    lower.includes('arena') ||
    lower.includes('stage') ||
    /signal (0?[1-5])\b/.test(lower) ||
    /fair-core-0[1-5]/.test(lower)
  ) {
    return 'track_grandstand';
  }
  if (
    lower.includes('livestock') ||
    lower.includes('barn') ||
    lower.includes('dairy') ||
    lower.includes('beef') ||
    lower.includes('goat') ||
    lower.includes('sheep') ||
    lower.includes('swine') ||
    lower.includes('poultry') ||
    lower.includes('rabbit') ||
    lower.includes('cavy') ||
    lower.includes('coliseum') ||
    lower.includes('horse/pony') ||
    /signal (0?[6-9]|10)\b/.test(lower) ||
    /fair-core-(0[6-9]|10)/.test(lower)
  ) {
    return 'livestock';
  }
  if (
    lower.includes('pavilion') ||
    lower.includes('exhibit') ||
    lower.includes('art hall') ||
    lower.includes('farm bureau') ||
    lower.includes('grange') ||
    lower.includes('4-h') ||
    lower.includes('political') ||
    /signal (1[1-5])\b/.test(lower) ||
    /fair-core-1[1-5]/.test(lower)
  ) {
    return 'pavilion_exhibits';
  }
  if (
    lower.includes('midway') ||
    lower.includes('amusement') ||
    lower.includes('kiddyland') ||
    lower.includes('kiddie') ||
    lower.includes('games') ||
    lower.includes('carnival') ||
    lower.includes('ride') ||
    /signal (1[6-9]|20)\b/.test(lower) ||
    /fair-core-(1[6-9]|20)/.test(lower)
  ) {
    return 'midway_amusement';
  }
  return 'track_grandstand';
}

/**
 * A single, real, admin-confirmed physical Signal placement — deliberately
 * the ONLY fields a public marker may ever carry. No target_code, no GM
 * notes, no setup/retrieval notes, no other admin metadata: the type shape
 * itself is the enforcement, not a runtime filter that could be forgotten.
 *
 * Product decision (intentional, not a placeholder to "finish later"): the
 * Fair QR Hunt's whole mechanic is physically finding a hidden card — no
 * Fair quest requires or checks GPS, so revealing a card's exact
 * coordinates publicly would trivialize the hunt. Exact placement
 * coordinates therefore stay admin-only (app/api/admin/fair-qr,
 * app/admin/fair-qr/page.tsx) for recovery/operations use, and are never
 * wired into the public dashboard (app/api/fair/dashboard,
 * app/events/fair-qr-hunt/page.tsx) that feeds this component. This type
 * and its rendering below exist so that decision can be revisited in one
 * place later — by actually passing real data through this prop — without
 * ever falling back to a sector center or leaking a private field.
 */
export interface FairPlacedSignal {
  id: string;
  label: string;
  lat: number;
  lng: number;
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
  /**
   * Real, individually-placed Signal markers — public-safe fields only
   * (see FairPlacedSignal). Deliberately NOT sourced from the public Fair
   * dashboard today (see FairPlacedSignal doc comment); omit entirely
   * rather than pass placeholder/sector data.
   */
  placedSignals?: FairPlacedSignal[];
  /** Optional auto-refresh interval in ms when polling standalone (default: 10000ms) */
  pollIntervalMs?: number;
}

export default function FairLiveMap({
  className = '',
  feed: feedProp,
  activeSpectatorCount: countProp,
  districts,
  placedSignals,
  pollIntervalMs = 10000,
}: FairLiveMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const zoneMarkersRef = useRef<Record<string, L.Marker>>({});
  const signalMarkersRef = useRef<L.Marker[]>([]);
  const [mapReady, setMapReady] = useState(false);

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
      }).setView([FAIR_MAP_CENTER.lat, FAIR_MAP_CENTER.lng], 15.4);

      // Production-safe public tiles: no private API key required. The
      // prior CARTO dark_all URL now returns HTTP 200 with "API KEY
      // REQUIRED" watermarked directly into the tile image (CARTO's free
      // Basemaps tier now gates that style) — verified by fetching a tile
      // for this exact location directly, not assumed from the rendered
      // error text. Same fix already proven in components/CantonMap.tsx
      // (see tests/mission-map-tab-loading-fix.test.ts) — reused here
      // rather than inventing a new tile source.
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
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
            // A solid dark backing plate (not just a colored text-shadow
            // glow) keeps the label legible against the light OSM basemap
            // tiles as well as the dark HUD chrome — a glow-only label
            // was tuned for the old dark-tile basemap and would wash out
            // against real street imagery.
            html: `<div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:600;letter-spacing:.06em;color:#ffffff;white-space:nowrap;transform:translate(-50%,-100%);pointer-events:none;margin-bottom:6px;background:rgba(10,13,18,0.82);border:1px solid ${zone.color};border-radius:4px;padding:2px 6px;box-shadow:0 0 6px rgba(0,0,0,0.5);">${zone.name.toUpperCase()}</div>`,
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
      if (!isCancelled) setMapReady(true);
    };

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      zoneMarkersRef.current = {};
      setMapReady(false);
    };
  }, []);

  // Render real, individually-placed Signal markers — ONLY from the
  // placedSignals prop, never derived from FAIR_SECTOR_ZONES or
  // FAIR_MAP_CENTER. A distinct pin style (not the translucent sector
  // circles) since each of these represents one specific confirmed
  // physical point, not a general search area. Absent/empty prop (the
  // default, per the product decision above) renders nothing.
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;
    let isCancelled = false;

    const renderSignalMarkers = async () => {
      const L = (await import('leaflet')).default;
      if (isCancelled || !mapInstanceRef.current) return;

      signalMarkersRef.current.forEach((marker) => marker.remove());
      signalMarkersRef.current = [];

      for (const signal of placedSignals || []) {
        if (!Number.isFinite(signal.lat) || !Number.isFinite(signal.lng)) continue;

        const icon = L.divIcon({
          className: 'signal-pin',
          html: `<div class="signal-pin-dot"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });

        const marker = L.marker([signal.lat, signal.lng], { icon, interactive: false, title: signal.label }).addTo(
          mapInstanceRef.current
        );
        signalMarkersRef.current.push(marker);
      }
    };

    renderSignalMarkers();

    return () => {
      isCancelled = true;
    };
  }, [mapReady, placedSignals]);

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

        /* REAL, CONFIRMED SIGNAL PLACEMENT — deliberately a small solid
           dot, visually distinct from the translucent sector-area circles
           above, since this represents one specific physical point rather
           than a general search area. Renders only from real
           FairPlacedSignal data (see component doc comment); no default
           caller currently supplies any. */
        .cq-fair-map-root .signal-pin-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid var(--signal-cyan);
          box-shadow: 0 0 6px var(--signal-cyan);
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

        .cq-fair-map-root .zone-disclaimer {
          margin: 10px 0 0;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          line-height: 1.5;
          color: var(--text-dim);
          opacity: 0.85;
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
          FAIRGROUNDS SEARCH GRID · CANTON, OH
        </div>

        {/* Section Heading & Subtitle */}
        <h2 className="title">
          Fair Hunt <span>Map</span>
        </h2>
        <p className="sub">
          Search sectors show general areas of the fairgrounds. Individual Signal locations must still be discovered on-site. Official Command broadcasts and Fair-wide activity updates appear in the feed below as they&apos;re published.
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
              <span>STARK COUNTY FAIRGROUNDS · {FAIR_MAP_CENTER_LABEL}</span>
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
                  No Command dispatches published yet. This feed shows official Fair Command broadcasts — individual Signal scans are not posted here.
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

        {/* Stats Row — "Active Fair Agents" only renders when a real, live
            count is actually supplied via the activeSpectatorCount prop.
            No caller currently passes one, so it's correctly omitted rather
            than showing a permanently-frozen, misleading "0". */}
        <div className="stats-row">
          {countProp !== undefined && (
            <div className="stat">
              <div className="num">{internalCount}</div>
              <div className="lbl">Active Fair Agents</div>
            </div>
          )}
          <div className="stat">
            <div className="num">{FAIR_SECTOR_ZONES.length}</div>
            <div className="lbl">Fair Zones Online</div>
          </div>
          <div className="stat">
            <div className="num">{internalFeed?.length ?? 0}</div>
            <div className="lbl">Command Dispatches</div>
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
        <p className="zone-disclaimer">
          Search sectors show general areas of the fairgrounds. Individual Signal locations must still be discovered on-site.
        </p>
      </div>
    </div>
  );
}
