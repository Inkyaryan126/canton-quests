'use client';

import { useEffect, useState } from 'react';
import { Users, Sparkles } from 'lucide-react';
import type { CityStateProjection } from '@/lib/city-state';

interface CityPulseStripProps {
  eventSlug: string;
}

/**
 * A single-line, mobile-first ambient summary of the Community Progress /
 * City State projection (lib/city-state.ts) — "how is the whole city doing
 * right now," safe aggregate data only. Renders nothing while loading or if
 * there's nothing meaningful to show (a brand-new event with 0 registered
 * players), so it never competes for attention with the Live City Events
 * HUD above it.
 */
export default function CityPulseStrip({ eventSlug }: CityPulseStripProps) {
  const [cityState, setCityState] = useState<CityStateProjection | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game/city-state?eventSlug=${encodeURIComponent(eventSlug)}`)
      .then((res) => res.json())
      .then((data: { cityState?: CityStateProjection | null }) => {
        if (!cancelled) setCityState(data.cityState || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eventSlug]);

  if (!cityState || cityState.registeredPlayers === 0) return null;

  const { registeredPlayers, activePlayers, totalCompletedQuests, convergenceReadyPlayers } = cityState;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 px-3 mb-4 rounded-lg bg-stone-950/60 border border-stone-800 font-mono text-[11px] text-stone-400">
      <span className="flex items-center gap-1.5">
        <Users size={12} className="text-cyan-400" />
        {registeredPlayers} agent{registeredPlayers === 1 ? '' : 's'} registered · {activePlayers} active
      </span>
      <span>{totalCompletedQuests} mission{totalCompletedQuests === 1 ? '' : 's'} completed city-wide</span>
      {convergenceReadyPlayers > 0 && (
        <span className="flex items-center gap-1.5 text-amber-400 font-bold">
          <Sparkles size={12} />
          {convergenceReadyPlayers} player{convergenceReadyPlayers === 1 ? '' : 's'} convergence-ready
        </span>
      )}
    </div>
  );
}
