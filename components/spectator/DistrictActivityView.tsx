'use client';

import {
  DistrictInfo,
  FOUNDER_CIPHER_CANONICAL_DISTRICTS,
} from '@/lib/spectator-districts';

export type { DistrictInfo };

interface DistrictActivityViewProps {
  districts?: DistrictInfo[];
}

export default function DistrictActivityView({ districts = [] }: DistrictActivityViewProps) {
  const displayDistricts: DistrictInfo[] =
    districts.length > 0
      ? districts
      : FOUNDER_CIPHER_CANONICAL_DISTRICTS.map((d) => ({
          id: d.id,
          name: d.name,
          landmark: d.landmark,
          activityLevel: 'NO ACTIVITY' as const,
          agentCount: 0,
          activeQuestsCount: 0,
          path: d.path,
        }));

  return (
    <div className="glass-panel p-5 rounded-2xl border border-cyan-500/20 space-y-4">
      <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-3">
        <div>
          <h2 className="text-base font-extrabold text-white flex items-center gap-2">
            <span>🗺️ Canton Citywide District Activity</span>
            <span className="text-xs font-mono text-cyan-400 font-normal">
              • Coarse Aggregation
            </span>
          </h2>
          <p className="text-[11px] text-gray-400">
            Real-time activity volume across Canton, Ohio zones. Player GPS coordinates are kept strictly private.
          </p>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-mono border border-cyan-500/30">
          🔒 NO EXACT GPS EXPOSED
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {displayDistricts.map((dist) => {
          const isHigh = dist.activityLevel === 'HIGH';
          const isMod = dist.activityLevel === 'MODERATE';
          const isQuiet = dist.activityLevel === 'QUIET';

          // Path-specific styling accents
          const isChallenge = dist.path === 'challenge' || dist.id.includes('challenge');
          const isSecret = dist.path === 'secret' || dist.id.includes('secret');
          const isFamily = dist.path === 'family' || dist.id.includes('family');

          const pathAccentClass = isHigh
            ? isChallenge
              ? 'border-red-500/50 bg-red-950/20'
              : isSecret
              ? 'border-purple-500/50 bg-purple-950/20'
              : 'border-amber-500/50 bg-amber-950/20'
            : isMod
            ? 'border-cyan-500/40 bg-cyan-950/15'
            : isQuiet
            ? 'border-emerald-500/30 bg-emerald-950/10'
            : 'border-gray-800 bg-obsidian/60';

          return (
            <div
              key={dist.id}
              className={`p-4 rounded-xl border space-y-2 transition-all ${pathAccentClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs md:text-sm text-white">
                  📍 {dist.name}
                </span>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isHigh
                      ? isChallenge
                        ? 'bg-red-500 text-white'
                        : isSecret
                        ? 'bg-purple-500 text-white'
                        : 'bg-amber-500 text-black'
                      : isMod
                      ? 'bg-cyan-400 text-black'
                      : isQuiet
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {isHigh
                    ? '🔥 HIGH ACTIVITY'
                    : isMod
                    ? '⚡ MODERATE'
                    : isQuiet
                    ? '🟢 QUIET'
                    : '⚪ NO ACTIVITY'}
                </span>
              </div>

              <div className="text-[11px] text-gray-300">
                Key Landmark: <span className="text-white font-mono">{dist.landmark}</span>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono text-gray-400 pt-1 border-t border-white/5">
                <span>Agents in Zone: <strong className="text-cyan-300">~{dist.agentCount}</strong></span>
                <span>Active Quests: <strong className="text-amber-300">{dist.activeQuestsCount}</strong></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
