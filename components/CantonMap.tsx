'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PublicQuestView, QuestState } from '@/lib/types';
import { calculateDistanceMeters, formatDistance } from '@/lib/geo';
import SystemStatusBadge from '@/components/game-effects/SystemStatusBadge';

interface CantonMapProps {
  quests: PublicQuestView[];
  eventSlug: string;
  completedQuestIds?: string[];
  pendingQuestIds?: string[];
  userLat?: number;
  userLon?: number;
  onLocateMe?: () => void;
  onSelectQuest?: (quest: PublicQuestView) => void;
}

function calculatePublicQuestState(
  quest: PublicQuestView,
  completedQuestIds: string[],
  pendingQuestIds: string[],
  nowMs: number = Date.now()
): QuestState {
  if (completedQuestIds.includes(quest.id)) return 'completed';
  if (pendingQuestIds.includes(quest.id)) return 'pending';
  if (quest.status === 'inactive' || quest.status === 'draft') return 'hidden';
  if (quest.claimLimit && quest.currentClaims && quest.currentClaims >= quest.claimLimit) return 'claimed_out';
  if (quest.prerequisiteQuestId && !completedQuestIds.includes(quest.prerequisiteQuestId)) return 'locked';
  if (quest.startsAt && new Date(quest.startsAt).getTime() > nowMs) return 'locked';
  if (quest.isFlash) {
    if (quest.expiresAt && new Date(quest.expiresAt).getTime() <= nowMs) return 'expired';
    return 'flash';
  }
  return 'available';
}

// Canton, OH Center (Centennial Plaza)
const CANTON_CENTER: [number, number] = [40.7989, -81.3748];

export default function CantonMap({
  quests,
  eventSlug,
  completedQuestIds = [],
  pendingQuestIds = [],
  userLat,
  userLon,
  onLocateMe,
  onSelectQuest,
}: CantonMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [selectedQuest, setSelectedQuest] = useState<{
    quest: PublicQuestView;
    state: QuestState;
    distanceStr?: string;
  } | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CANTON_CENTER,
      zoom: 15,
      zoomControl: true,
    });

    // Production-safe public tiles: no private API key required.
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    markersRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Quest Markers & User Location
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    markersRef.current.clearLayers();

    // 1. Add Quest Location Markers
    quests.forEach((quest) => {
      const lat = quest.location?.latitude;
      const lon = quest.location?.longitude;
      if (lat === undefined || lon === undefined) return;

      const state = calculatePublicQuestState(quest, completedQuestIds, pendingQuestIds);
      if (state === 'hidden') return;

      // Calculate distance if user location is available
      let distanceStr: string | undefined = undefined;
      if (userLat !== undefined && userLon !== undefined) {
        const distM = calculateDistanceMeters(userLat, userLon, lat, lon);
        distanceStr = formatDistance(distM);
      }

      // Marker Icon HTML based on state
      let badgeBg = '#f59e0b'; // amber default
      let iconSymbol = '🎯';

      if (state === 'completed') {
        badgeBg = '#10b981'; // green
        iconSymbol = '✓';
      } else if (state === 'pending') {
        badgeBg = '#a855f7'; // purple
        iconSymbol = '⏳';
      } else if (state === 'flash') {
        badgeBg = '#ef4444'; // red flash pulse
        iconSymbol = '⚡';
      } else if (state === 'locked') {
        badgeBg = '#64748b'; // slate lock
        iconSymbol = '🔒';
      } else if (state === 'expired') {
        badgeBg = '#334155'; // dark slate
        iconSymbol = '⌛';
      }

      const customIcon = L.divIcon({
        className: 'custom-quest-pin',
        html: `
          <div style="
            position: relative;
            width: 38px;
            height: 38px;
            background: ${badgeBg};
            border: 2px solid #ffffff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.6);
            cursor: pointer;
            transition: transform 0.2s ease;
          ">
            <span>${iconSymbol}</span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      const marker = L.marker([lat, lon], { icon: customIcon });
      marker.on('click', () => {
        setSelectedQuest({ quest, state, distanceStr });
        if (onSelectQuest) onSelectQuest(quest);
      });

      markersRef.current?.addLayer(marker);
    });

    // 2. Add / Update User GPS Location Pulse Marker
    if (userLat !== undefined && userLon !== undefined) {
      const userIcon = L.divIcon({
        className: 'user-gps-pulse-pin',
        html: `
          <div style="
            width: 22px;
            height: 22px;
            background: #06b6d4;
            border: 3px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 16px #06b6d4, 0 0 0 8px rgba(6, 182, 212, 0.3);
          "></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLat, userLon]);
      } else {
        userMarkerRef.current = L.marker([userLat, userLon], { icon: userIcon, zIndexOffset: 1000 }).addTo(
          mapRef.current
        );
      }
    }
  }, [quests, completedQuestIds, pendingQuestIds, userLat, userLon, onSelectQuest]);

  const handleRecenterUser = () => {
    if (userLat !== undefined && userLon !== undefined && mapRef.current) {
      mapRef.current.setView([userLat, userLon], 16);
    }
    if (onLocateMe) onLocateMe();
  };

  return (
    <div className="relative w-full h-[420px] cq-hud-panel cq-motion-scope" style={{ overflow: 'hidden', borderRadius: '0.75rem' }}>
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Header Overlay Controls */}
      <div style={{ position: 'absolute', top: '0.75rem', left: '0.75rem', right: '0.75rem', zIndex: 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          <SystemStatusBadge status="scanning" label={`CANTON FIELD SCANNER • ${quests.length} NODES`} size="sm" />
        </div>

        <button
          type="button"
          onClick={handleRecenterUser}
          className="cq-dark-button cq-btn-sm"
          style={{ pointerEvents: 'auto' }}
        >
          📍 {userLat !== undefined ? 'My Location' : 'Locate Me'}
        </button>
      </div>

      {quests.length === 0 && (
        <div className="cq-hud-panel cq-empty-state" style={{ position: 'absolute', inset: '5rem 1rem auto', zIndex: 400, maxWidth: '28rem', margin: '0 auto', padding: '1.25rem' }}>
          <SystemStatusBadge status="armed" label="NO FIELD NODES" size="sm" />
          <p>No mission coordinates are currently assigned to this operation.</p>
        </div>
      )}

      {/* Selected Quest Floating Bottom Preview Card */}
      {selectedQuest && (
        <div className="cq-hud-panel cq-transition-reveal is-visible" style={{ position: 'absolute', bottom: '0.75rem', left: '0.75rem', right: '0.75rem', zIndex: 400, padding: '1rem', borderRadius: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <span className={`badge badge-${selectedQuest.quest.difficulty}`}>
                  {selectedQuest.quest.difficulty}
                </span>
                <span className="cq-section-note">
                  {selectedQuest.quest.category}
                </span>
                {selectedQuest.distanceStr && (
                  <span className="cq-kicker">
                    📍 {selectedQuest.distanceStr}
                  </span>
                )}
              </div>
              <h3>{selectedQuest.quest.title}</h3>
            </div>
            <button
              onClick={() => setSelectedQuest(null)}
              className="cq-dark-button cq-btn-sm"
              aria-label="Close quest preview"
            >
              ✕
            </button>
          </div>

          <p className="cq-section-note">
            {selectedQuest.quest.description}
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <strong className="cq-kicker">
              +{selectedQuest.quest.pointValue} XP
            </strong>

            {selectedQuest.state === 'completed' ? (
              <SystemStatusBadge status="confirmed" label="QUEST COMPLETED" size="sm" />
            ) : selectedQuest.state === 'locked' ? (
              <SystemStatusBadge status="denied" label="PREREQUISITE LOCKED" size="sm" />
            ) : (
              <a
                href={`/events/${eventSlug}/quests/${selectedQuest.quest.id}`}
                className="cq-gold-button cq-btn-sm"
              >
                Inspect Quest →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
