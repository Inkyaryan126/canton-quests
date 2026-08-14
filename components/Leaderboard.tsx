'use client';

import { LeaderboardEntry } from '@/lib/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string;
}

export default function Leaderboard({ entries, currentPlayerId }: LeaderboardProps) {
  return (
    <div className="glass-panel overflow-hidden border-amber-500/20">
      {/* Leaderboard Header */}
      <div className="p-4 bg-obsidian/60 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🏆 Event Leaderboard
          </h2>
          <p className="text-xs text-gray-400 font-mono">Live verified scoring leaderboard ({entries.length} agents)</p>
        </div>
      </div>

      {/* INDIVIDUAL LEADERBOARD VIEW */}
      <div className="divide-y divide-[var(--border-subtle)]">
        {entries.length === 0 ? (
          <div className="p-8 text-center text-gray-400 font-mono text-sm">
            No individual scores recorded yet in this event.
          </div>
        ) : (
          entries.map((entry) => {
            const isCurrentPlayer = entry.playerId === currentPlayerId;

            let rankBadge = `#${entry.rank}`;
            let rankColor = 'text-gray-400 bg-gray-800/60 border-gray-700';

            if (entry.rank === 1) {
              rankBadge = '🥇 1st';
              rankColor = 'text-yellow-300 bg-yellow-500/20 border-yellow-500/50 glow-amber';
            } else if (entry.rank === 2) {
              rankBadge = '🥈 2nd';
              rankColor = 'text-gray-200 bg-gray-400/20 border-gray-400/50';
            } else if (entry.rank === 3) {
              rankBadge = '🥉 3rd';
              rankColor = 'text-amber-500 bg-amber-700/20 border-amber-600/50';
            }

            return (
              <div
                key={entry.playerId}
                className={`p-4 flex items-center justify-between gap-3 transition-colors ${
                  isCurrentPlayer
                    ? 'bg-amber-500/10 border-l-4 border-l-amber-500'
                    : 'hover:bg-gray-900/40'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${rankColor}`}>
                    {rankBadge}
                  </span>

                  <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-lg">
                    {entry.avatarUrl || '⚡'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-white text-sm">
                        {entry.displayName}
                      </span>
                      {isCurrentPlayer && (
                        <span className="text-[10px] bg-amber-500 text-obsidian px-1.5 py-0.5 rounded font-mono font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 font-mono">
                      {entry.questsCompletedCount} quest{entry.questsCompletedCount === 1 ? '' : 's'} completed
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-display font-extrabold text-amber-400 text-lg block leading-none">
                    {entry.totalPoints}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 uppercase">XP Points</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
