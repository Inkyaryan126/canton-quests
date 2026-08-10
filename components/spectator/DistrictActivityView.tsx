'use client';

export interface DistrictInfo {
  id: string;
  name: string;
  landmark: string;
  activityLevel: 'HIGH' | 'MODERATE' | 'QUIET' | 'NO ACTIVITY';
  agentCount: number;
  activeQuestsCount: number;
}

interface DistrictActivityViewProps {
  districts?: DistrictInfo[];
}

export default function DistrictActivityView({ districts = [] }: DistrictActivityViewProps) {
  const displayDistricts = districts.length > 0 ? districts : [
    {
      id: 'dist-arts',
      name: 'Downtown Arts Corridor',
      landmark: 'Centennial Plaza & Palace Theatre',
      activityLevel: 'NO ACTIVITY' as const,
      agentCount: 0,
      activeQuestsCount: 0,
    },
    {
      id: 'dist-market',
      name: 'Central Market District',
      landmark: '4th Street Shops & Food Hub',
      activityLevel: 'NO ACTIVITY' as const,
      agentCount: 0,
      activeQuestsCount: 0,
    },
    {
      id: 'dist-mckinley',
      name: 'McKinley Monument Zone',
      landmark: 'McKinley National Memorial & Park',
      activityLevel: 'NO ACTIVITY' as const,
      agentCount: 0,
      activeQuestsCount: 0,
    },
    {
      id: 'dist-hof',
      name: 'Hall of Fame Village Zone',
      landmark: 'Stadium Plaza & Campus',
      activityLevel: 'NO ACTIVITY' as const,
      agentCount: 0,
      activeQuestsCount: 0,
    },
  ];
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {displayDistricts.map((dist) => {
          const isHigh = dist.activityLevel === 'HIGH';
          const isMod = dist.activityLevel === 'MODERATE';
          const isQuiet = dist.activityLevel === 'QUIET';

          return (
            <div
              key={dist.id}
              className={`p-4 rounded-xl border space-y-2 transition-all ${
                isHigh
                  ? 'border-amber-500/50 bg-amber-950/20'
                  : isMod
                  ? 'border-cyan-500/40 bg-cyan-950/15'
                  : 'border-gray-800 bg-obsidian/60'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs md:text-sm text-white">
                  📍 {dist.name}
                </span>

                <span
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                    isHigh
                      ? 'bg-amber-500 text-black'
                      : isMod
                      ? 'bg-cyan-400 text-black'
                      : 'bg-gray-800 text-gray-300'
                  }`}
                >
                  {isHigh ? '🔥 HIGH ACTIVITY' : isMod ? '⚡ MODERATE' : '🟢 QUIET'}
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
