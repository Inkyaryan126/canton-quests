'use client';

import { LeaderboardEntry } from '@/lib/types';
import PlayerAvatar from '@/components/PlayerAvatar';
import SystemStatusBadge from '@/components/game-effects/SystemStatusBadge';

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentPlayerId: string;
}

export default function Leaderboard({ entries, currentPlayerId }: LeaderboardProps) {
  return (
    <section className="cq-hud-panel cq-motion-scope" style={{ overflow: 'hidden' }}>
      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '1rem', borderBottom: '1px solid var(--border-subtle)' }}>
        <div>
          <h2 style={{ margin: 0 }}>Event Leaderboard</h2>
          <p className="cq-section-note">Live verified scoring leaderboard ({entries.length} agents)</p>
        </div>
        <SystemStatusBadge status={entries.length > 0 ? 'confirmed' : 'armed'} label={entries.length > 0 ? 'LIVE VERIFIED' : 'STANDBY'} size="sm" />
      </header>

      <div>
        {entries.length === 0 ? (
          <div className="cq-empty-state" style={{ padding: '2rem' }}>
            <SystemStatusBadge status="armed" label="NO SCORES YET" size="sm" />
            <h3>No Scores Yet</h3>
            <p>Rankings will appear here as players earn XP.</p>
          </div>
        ) : (
          entries.map((entry) => {
            const isCurrentPlayer = entry.playerId === currentPlayerId;

            let rankBadge = `#${entry.rank}`;

            if (entry.rank === 1) {
              rankBadge = '🥇 1st';
            } else if (entry.rank === 2) {
              rankBadge = '🥈 2nd';
            } else if (entry.rank === 3) {
              rankBadge = '🥉 3rd';
            }

            return (
              <article
                key={entry.playerId}
                className={`cq-rank-row${isCurrentPlayer ? ' is-me' : ''}`}
              >
                <span className="cq-rank-row-num">{rankBadge}</span>
                <PlayerAvatar
                  avatarUrl={entry.avatarUrl}
                  cropZoom={entry.profileImageCropZoom}
                  cropX={entry.profileImageCropX}
                  cropY={entry.profileImageCropY}
                  size={36}
                  className="cq-rank-row-avatar"
                  ariaLabel={`${entry.displayName} avatar`}
                />
                <div className="cq-rank-row-name">
                  {entry.displayName} {isCurrentPlayer && <small>YOU</small>}
                  <small style={{ display: 'block', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>
                    {entry.questsCompletedCount} quest{entry.questsCompletedCount === 1 ? '' : 's'} completed
                  </small>
                </div>
                <strong className="cq-rank-row-xp">{entry.totalPoints} XP</strong>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
