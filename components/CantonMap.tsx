'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PublicQuestView, QuestState } from '@/lib/types';
import { calculateDistanceMeters, formatDistance } from '@/lib/geo';

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
          " class="${state === 'flash' ? 'animate-bounce' : ''}">
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
    <div className="relative w-full h-[420px] rounded-2xl overflow-hidden border border-[var(--border-subtle)] shadow-2xl bg-obsidian">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Header Overlay Controls */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex justify-between items-center pointer-events-none">
        <div className="bg-obsidian/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-amber-500/30 text-[11px] font-mono text-amber-400 font-bold shadow-lg pointer-events-auto flex items-center gap-1.5">
          <span>🗺️ CANTON FIELD SCANNER</span>
          <span className="text-gray-400">• {quests.length} Nodes</span>
        </div>

        <button
          onClick={handleRecenterUser}
          className="bg-obsidian/90 backdrop-blur-md hover:bg-obsidian text-cyan-400 border border-cyan-500/40 px-3 py-1.5 rounded-full text-xs font-mono font-bold shadow-lg pointer-events-auto flex items-center gap-1 transition-all active:scale-95"
        >
          📍 {userLat !== undefined ? 'My Location' : 'Locate Me'}
        </button>
      </div>

      {/* Selected Quest Floating Bottom Preview Card */}
      {selectedQuest && (
        <div className="absolute bottom-3 left-3 right-3 z-[400] bg-obsidian/95 backdrop-blur-md border border-amber-500/40 p-4 rounded-2xl shadow-2xl text-white animate-slide-up">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`badge badge-${selectedQuest.quest.difficulty}`}>
                  {selectedQuest.quest.difficulty}
                </span>
                <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wide">
                  {selectedQuest.quest.category}
                </span>
                {selectedQuest.distanceStr && (
                  <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/40">
                    📍 {selectedQuest.distanceStr}
                  </span>
                )}
              </div>
              <h3 className="text-base font-extrabold text-white">{selectedQuest.quest.title}</h3>
            </div>
            <button
              onClick={() => setSelectedQuest(null)}
              className="text-gray-400 hover:text-white text-lg font-bold px-1"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-gray-300 line-clamp-2 mb-3">
            {selectedQuest.quest.description}
          </p>

          <div className="flex items-center justify-between gap-2">
            <span className="font-display font-bold text-amber-400 text-sm">
              +{selectedQuest.quest.pointValue} XP
            </span>

            {selectedQuest.state === 'completed' ? (
              <span className="text-xs font-mono text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-xl">
                ✓ Quest Completed
              </span>
            ) : selectedQuest.state === 'locked' ? (
              <span className="text-xs font-mono text-gray-400 font-bold bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
                🔒 Prerequisite Locked
              </span>
            ) : (
              <a
                href={`/events/${eventSlug}/quests/${selectedQuest.quest.id}`}
                className="btn btn-primary text-xs py-1.5 px-4 font-bold"
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
