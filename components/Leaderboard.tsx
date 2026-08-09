'use client';

import { useState } from 'react';
import { LeaderboardEntry, TeamLeaderboardEntry } from '@/lib/types';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  teamEntries?: TeamLeaderboardEntry[];
  currentPlayerId: string;
}

export default function Leaderboard({ entries, teamEntries = [], currentPlayerId }: LeaderboardProps) {
  const [viewMode, setViewMode] = useState<'individual' | 'teams'>('individual');

  return (
    <div className="glass-panel overflow-hidden border-amber-500/20">
      {/* Leaderboard Mode Header & Switcher */}
      <div className="p-4 bg-obsidian/60 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            🏆 Event Leaderboard
          </h2>
          <p className="text-xs text-gray-400 font-mono">Live verified scoring leaderboard</p>
        </div>

        {/* Toggle Switch */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-gray-800 font-mono text-xs">
          <button
            onClick={() => setViewMode('individual')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'individual'
                ? 'bg-amber-500 text-obsidian font-bold shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            👤 Individual ({entries.length})
          </button>
          <button
            onClick={() => setViewMode('teams')}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'teams'
                ? 'bg-cyan-500 text-obsidian font-bold shadow'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            👥 Squads ({teamEntries.length})
          </button>
        </div>
      </div>

      {/* INDIVIDUAL LEADERBOARD VIEW */}
      {viewMode === 'individual' && (
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
                        {entry.teamName && (
                          <span className="text-[10px] bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 px-1.5 py-0.5 rounded font-mono">
                            🛡️ {entry.teamName}
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
      )}

      {/* TEAM LEADERBOARD VIEW */}
      {viewMode === 'teams' && (
        <div className="divide-y divide-[var(--border-subtle)]">
          {teamEntries.length === 0 ? (
            <div className="p-8 text-center text-gray-400 font-mono text-sm">
              No squads registered yet. Form a squad in Squad Operations to compete on the Team Leaderboard!
            </div>
          ) : (
            teamEntries.map((team) => {
              let rankBadge = `#${team.rank}`;
              let rankColor = 'text-gray-400 bg-gray-800/60 border-gray-700';

              if (team.rank === 1) {
                rankBadge = '🥇 1st Squad';
                rankColor = 'text-cyan-300 bg-cyan-500/20 border-cyan-500/50 shadow-cyan-500/20';
              } else if (team.rank === 2) {
                rankBadge = '🥈 2nd Squad';
                rankColor = 'text-gray-200 bg-gray-400/20 border-gray-400/50';
              } else if (team.rank === 3) {
                rankBadge = '🥉 3rd Squad';
                rankColor = 'text-amber-500 bg-amber-700/20 border-amber-600/50';
              }

              return (
                <div
                  key={team.teamId}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-gray-900/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg border ${rankColor}`}>
                      {rankBadge}
                    </span>

                    <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-500/40 flex items-center justify-center text-xl">
                      🛡️
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display font-extrabold text-white text-base">
                          {team.teamName}
                        </span>
                        <span className="text-[10px] font-mono text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                          {team.joinCode}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 font-mono">
                        {team.memberCount} Agent{team.memberCount === 1 ? '' : 's'} • Captain: {team.captainName}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-display font-extrabold text-cyan-400 text-lg block leading-none">
                      {team.totalPoints}
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 uppercase">Squad XP</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
