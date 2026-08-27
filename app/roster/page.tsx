'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Users } from 'lucide-react';
import CinematicFooter from '@/components/CinematicFooter';
import CinematicNav from '@/components/CinematicNav';
import MobileStartBar from '@/components/MobileStartBar';
import PageHeader from '@/components/PageHeader';
import PlayerAvatar from '@/components/PlayerAvatar';
import { PublicRosterEntry, StartingPath } from '@/lib/types';
import { STARTING_DISTRICTS } from '@/lib/player-command-center';

const PATH_FILTERS: Array<{ value: StartingPath | 'all'; label: string }> = [
  { value: 'all', label: 'ALL PATHS' },
  { value: 'family', label: 'FAMILY' },
  { value: 'challenge', label: 'CHALLENGE' },
  { value: 'secret', label: 'SECRET' },
];

export default function PlayerRosterPage() {
  const [roster, setRoster] = useState<PublicRosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pathFilter, setPathFilter] = useState<StartingPath | 'all'>('all');

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      fetch(`/api/game/roster?${params.toString()}`)
        .then((res) => res.json())
        .then((data: { roster?: PublicRosterEntry[] }) => {
          setRoster(data.roster || []);
        })
        .catch(() => setRoster([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [search]);

  const visibleRoster = useMemo(() => {
    if (pathFilter === 'all') return roster;
    return roster.filter((entry) => entry.selectedStartingPath === pathFilter);
  }, [roster, pathFilter]);

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref="/events/canton-weekend-1" context="global" />

      <main className="cq-page-main">
        <section className="cq-page-section" style={{ paddingBottom: '0' }}>
          <PageHeader
            eyebrow="PERMANENT IDENTITIES"
            title="PLAYER ROSTER"
            body="Every Canton Quests agent who has created a Player Identity — across every Mission, whether they've scored yet or not."
            accent="cyan"
            divider
          />
        </section>

        <section className="cq-page-section cq-board-section">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div className="cq-roster-search" style={{ position: 'relative', flex: '1 1 240px', minWidth: '220px' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search callsign..."
                aria-label="Search Player Roster by callsign"
                className="cq-roster-search-input"
                style={{
                  width: '100%',
                  padding: '0.7rem 0.9rem 0.7rem 2.4rem',
                  borderRadius: '0.75rem',
                  background: 'rgba(13, 15, 16, 0.84)',
                  border: '1px solid rgba(217, 164, 76, 0.28)',
                  color: '#f4f1ea',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.85rem',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {PATH_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setPathFilter(filter.value)}
                  className="cq-dark-button cq-btn-sm"
                  style={{
                    opacity: pathFilter === filter.value ? 1 : 0.55,
                    borderColor: pathFilter === filter.value ? '#f0c978' : undefined,
                  }}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <p className="cq-empty-state">Loading roster...</p>
          ) : visibleRoster.length === 0 ? (
            <div className="relative overflow-hidden p-10 rounded-3xl bg-stone-950 border border-stone-800 text-center space-y-3 max-w-2xl mx-auto my-8">
              <Users size={28} className="mx-auto text-amber-400" />
              <h2 className="text-xl font-black font-display text-white uppercase tracking-tight">No Agents Found</h2>
              <p className="text-sm text-stone-300 font-body">Try a different callsign search or path filter.</p>
            </div>
          ) : (
            <div className="cq-rank-list">
              {visibleRoster.map((entry) => {
                const district = entry.selectedStartingPath ? STARTING_DISTRICTS[entry.selectedStartingPath] : null;
                return (
                  <article key={entry.id}>
                    <PlayerAvatar
                      avatarUrl={entry.avatarUrl}
                      cropZoom={entry.profileImageCropZoom}
                      cropX={entry.profileImageCropX}
                      cropY={entry.profileImageCropY}
                      size={46}
                      className="cq-rank-avatar"
                      ariaLabel={`${entry.displayName} avatar`}
                      style={{ fontSize: '1.4rem' }}
                    />
                    <div className="cq-rank-name">
                      <h3>{entry.displayName}</h3>
                      <p>
                        {district ? `${district.label} · ${district.district}` : 'No path selected yet'} · Level {entry.level}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <CinematicFooter />
      <MobileStartBar href="/#operations" />
    </div>
  );
}
