'use client';

interface CommunityStatsBarProps {
  totalVotes: number;
  activeSpectatorCount?: number;
  activeDistrictCount?: number;
  feedCount?: number;
}

export default function CommunityStatsBar({
  totalVotes,
  activeSpectatorCount = 0,
  activeDistrictCount = 3,
  feedCount = 0,
}: CommunityStatsBarProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="p-3.5 bg-[#161e2e]/90 border border-amber-500/30 rounded-xl space-y-0.5 text-center">
        <span className="text-[10px] font-mono text-gray-400 uppercase font-bold block">
          🗳️ TOTAL VOTES CAST
        </span>
        <span className="text-xl font-extrabold text-amber-400 font-mono block">
          {totalVotes}
        </span>
        <span className="text-[9px] text-gray-500 font-mono block">Community Audience</span>
      </div>

      <div className="p-3.5 bg-[#161e2e]/90 border border-cyan-500/30 rounded-xl space-y-0.5 text-center">
        <span className="text-[10px] font-mono text-gray-400 uppercase font-bold block">
          👥 LIVE SPECTATORS
        </span>
        <span className="text-xl font-extrabold text-cyan-400 font-mono block">
          {activeSpectatorCount}
        </span>
        <span className="text-[9px] text-gray-500 font-mono block">Watching Canton Airwaves</span>
      </div>

      <div className="p-3.5 bg-[#161e2e]/90 border border-emerald-500/30 rounded-xl space-y-0.5 text-center">
        <span className="text-[10px] font-mono text-gray-400 uppercase font-bold block">
          📍 ACTIVE DISTRICTS
        </span>
        <span className="text-xl font-extrabold text-emerald-400 font-mono block">
          {activeDistrictCount}
        </span>
        <span className="text-[9px] text-gray-500 font-mono block">Canton Downtown Sprint</span>
      </div>

      <div className="p-3.5 bg-[#161e2e]/90 border border-purple-500/30 rounded-xl space-y-0.5 text-center">
        <span className="text-[10px] font-mono text-gray-400 uppercase font-bold block">
          📡 FIELD INTEL DISPATCHES
        </span>
        <span className="text-xl font-extrabold text-purple-400 font-mono block">
          {feedCount}
        </span>
        <span className="text-[9px] text-gray-500 font-mono block">Sanitized Public Ticker</span>
      </div>
    </div>
  );
}
