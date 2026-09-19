'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  Compass,
  Crown,
  History,
  Medal,
  Radio,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';

type BoardKey =
  | 'city-power'
  | 'overall'
  | 'progression'
  | 'missions'
  | 'discovery'
  | 'territory'
  | 'economy'
  | 'competitive'
  | 'social'
  | 'legacy';

interface PublicRankEntry {
  rank: number;
  callsign: string;
  avatarUrl: string | null;
  score: number;
  gridRating: number;
  level: number;
  totalXp: number;
  primaryTitle: string | null;
}

interface LeaderboardResponse {
  enabled: boolean;
  seasonStatus?: string | null;
  entries: PublicRankEntry[];
  error?: string;
}

const BOARDS: Array<{
  key: BoardKey;
  label: string;
  description: string;
  Icon: typeof Trophy;
}> = [
  { key: 'city-power', label: 'City Power', description: 'Seasonal control + economy + contests + objectives', Icon: Crown },
  { key: 'overall', label: 'Overall', description: 'Balanced Grid Rating', Icon: Trophy },
  { key: 'territory', label: 'Territory', description: 'Control + captures + defense', Icon: Shield },
  { key: 'economy', label: 'Economy', description: 'Property + wealth + influence', Icon: Building2 },
  { key: 'competitive', label: 'Competitive', description: 'Scrimmage + strategy + survival', Icon: Swords },
  { key: 'discovery', label: 'Discovery', description: 'Exploration + signals + intel', Icon: Compass },
  { key: 'missions', label: 'Missions', description: 'Mission score + completion + accuracy', Icon: Target },
  { key: 'progression', label: 'Progression', description: 'XP + reputation + season score', Icon: Zap },
  { key: 'social', label: 'Social', description: 'Leadership + teamwork + faction play', Icon: Users },
  { key: 'legacy', label: 'Legacy', description: 'Events + streaks + long-term impact', Icon: Sparkles },
];

function scoreLabel(board: BoardKey, score: number): string {
  return board === 'overall' || board === 'city-power'
    ? `${score.toLocaleString()} / 10,000`
    : `${score.toLocaleString()} / 1,000`;
}

function RankMark({ rank }: { rank: number }) {
  if (rank === 1) return <Crown size={18} className="text-amber-300" aria-hidden="true" />;
  if (rank === 2) return <Medal size={18} className="text-stone-200" aria-hidden="true" />;
  if (rank === 3) return <Medal size={18} className="text-amber-600" aria-hidden="true" />;
  return <span className="font-mono text-sm font-black text-stone-500">#{rank}</span>;
}

export default function GridRankingsClient() {
  const [board, setBoard] = useState<BoardKey>('city-power');
  const [entries, setEntries] = useState<PublicRankEntry[]>([]);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [seasonStatus, setSeasonStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => BOARDS.find((item) => item.key === board) ?? BOARDS[0],
    [board],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const endpoint =
      board === 'city-power'
        ? '/api/grid/city-power/leaderboard?limit=50'
        : `/api/grid/progression/leaderboard?board=${encodeURIComponent(board)}&limit=50`;

    fetch(endpoint, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const body = (await response.json()) as LeaderboardResponse;
        if (!response.ok) throw new Error(body.error || 'Grid rankings unavailable');
        return body;
      })
      .then((body) => {
        if (cancelled) return;
        setEnabled(body.enabled);
        setSeasonStatus(body.seasonStatus ?? null);
        setEntries(body.entries ?? []);
      })
      .catch((reason) => {
        if (!cancelled) {
          setEntries([]);
          setError(reason instanceof Error ? reason.message : 'Grid rankings unavailable');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [board]);

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.07) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/grid"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[.18em] text-stone-400 transition hover:text-cyan-300"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              City Board
            </Link>
            <Link
              href="/grid/history"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[.18em] text-stone-500 transition hover:text-amber-200"
            >
              <History size={15} aria-hidden="true" />
              Season History
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[.2em] text-cyan-300">
            <Radio size={12} className="animate-pulse" aria-hidden="true" />
            Canton // City 001
          </div>
        </div>

        <header className="mt-10 max-w-4xl">
          <span className="font-mono text-xs font-black uppercase tracking-[.28em] text-cyan-300">
            The Grid // Player Rankings
          </span>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
            There Is More Than One Way To Rule A City.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-stone-400 sm:text-base">
            City Power is the seasonal main score, built from multiple capped axes so one strategy
            cannot own the entire board. Specialist rankings still show the different ways players build a name.
          </p>
        </header>

        <section className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Ranking boards">
          {BOARDS.map(({ key, label, description, Icon }) => {
            const active = key === board;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setBoard(key)}
                className={`rounded-2xl border p-4 text-left transition ${
                  active
                    ? 'border-cyan-300/60 bg-cyan-400/10 shadow-[0_0_30px_rgba(34,211,238,.08)]'
                    : 'border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.045]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`rounded-xl p-2 ${active ? 'bg-cyan-300 text-black' : 'bg-white/5 text-stone-400'}`}>
                    <Icon size={17} aria-hidden="true" />
                  </div>
                  <div>
                    <div className="font-display text-base font-black uppercase text-white">{label}</div>
                    <div className="mt-1 text-xs text-stone-500">{description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </section>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
            <div>
              <div className="font-mono text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">
                {selected.label} Board
              </div>
              <h2 className="mt-1 font-display text-2xl font-black uppercase">{selected.description}</h2>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-stone-500">
              {seasonStatus ? `Season: ${seasonStatus}` : 'Founding Season'}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center font-mono text-xs uppercase tracking-widest text-stone-500">
              Reading the Grid…
            </div>
          ) : error ? (
            <div className="p-12 text-center">
              <div className="font-display text-xl font-black uppercase text-rose-300">Signal Interrupted</div>
              <p className="mt-2 text-sm text-stone-500">{error}</p>
            </div>
          ) : enabled === false ? (
            <div className="p-12 text-center">
              <div className="font-display text-xl font-black uppercase text-amber-300">Rankings Not Live Yet</div>
              <p className="mx-auto mt-2 max-w-xl text-sm text-stone-500">
                The ranking engine is built, but live Grid world reads are still locked until the gameplay runtime is activated.
              </p>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center">
              <Trophy size={30} className="mx-auto text-stone-700" aria-hidden="true" />
              <div className="mt-4 font-display text-xl font-black uppercase text-stone-300">No Ranked Players Yet</div>
              <p className="mx-auto mt-2 max-w-xl text-sm text-stone-500">
                Once the Founding Season begins recording progression, this board will populate from the immutable game ledger.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {entries.map((entry) => (
                <article
                  key={`${entry.rank}-${entry.callsign}`}
                  className="grid grid-cols-[42px_1fr] gap-3 p-4 sm:grid-cols-[52px_1fr_auto] sm:items-center sm:p-5"
                >
                  <div className="flex h-10 items-center justify-center sm:h-12">
                    <RankMark rank={entry.rank} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      {entry.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.avatarUrl}
                          alt=""
                          className="h-9 w-9 rounded-full border border-white/10 object-cover"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 font-display text-sm font-black text-stone-400">
                          {entry.callsign.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-lg font-black uppercase text-white">
                          {entry.callsign}
                        </h3>
                        <p className="truncate text-xs text-stone-500">
                          {entry.primaryTitle ?? 'Unranked title'} · Level {entry.level} · {entry.totalXp.toLocaleString()} XP
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="col-start-2 flex flex-wrap items-center gap-x-5 gap-y-1 sm:col-start-auto sm:justify-end sm:text-right">
                    <div>
                      <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-stone-600">Board Score</div>
                      <div className="font-display text-lg font-black text-cyan-300">{scoreLabel(board, entry.score)}</div>
                    </div>
                    <div>
                      <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-stone-600">Grid Rating</div>
                      <div className="font-display text-lg font-black text-white">{entry.gridRating.toLocaleString()}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <p className="mx-auto mt-8 max-w-3xl text-center font-mono text-[10px] uppercase leading-relaxed tracking-[.15em] text-stone-600">
          Rankings are derived from server-authoritative Grid progression projections. Private account data is never part of the public board.
        </p>
      </div>
    </main>
  );
}
