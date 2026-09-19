'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Crown,
  History,
  Loader2,
  Medal,
  Radio,
  Trophy,
} from 'lucide-react';

interface SeasonHistoryEntry {
  rank: number;
  callsign: string;
  avatarUrl: string | null;
  cityPower: number;
  gridRating: number;
  totalXp: number;
  champion: boolean;
}

interface SeasonHistoryResponse {
  enabled: boolean;
  archive: {
    citySlug: string;
    seasonSlug: string;
    seasonName: string;
    archivedAt: string;
    standingsCount: number;
    championCallsign: string | null;
  } | null;
  entries: SeasonHistoryEntry[];
  error?: string;
}

function rankMark(rank: number) {
  if (rank === 1) {
    return <Crown size={20} className="text-amber-300" aria-hidden="true" />;
  }
  if (rank === 2) {
    return <Medal size={20} className="text-stone-200" aria-hidden="true" />;
  }
  if (rank === 3) {
    return <Medal size={20} className="text-amber-600" aria-hidden="true" />;
  }
  return (
    <span className="font-mono text-sm font-black text-stone-500">
      #{rank}
    </span>
  );
}

function formatArchivedAt(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Archived season';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function GridSeasonHistoryClient() {
  const [payload, setPayload] = useState<SeasonHistoryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/grid/season-history', { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as SeasonHistoryResponse;
        if (!response.ok) {
          throw new Error(body.error || 'Season history unavailable');
        }
        return body;
      })
      .then((body) => {
        if (!cancelled) setPayload(body);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Season history unavailable',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const archive = payload?.archive ?? null;
  const entries = payload?.entries ?? [];

  return (
    <main className="min-h-screen bg-[#050607] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(245,158,11,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.06) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/grid/rankings"
              className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[.18em] text-stone-400 transition hover:text-cyan-300"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              Rankings
            </Link>
            <Link
              href="/grid"
              className="font-mono text-xs font-bold uppercase tracking-[.18em] text-stone-600 transition hover:text-cyan-300"
            >
              City Board
            </Link>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/[.07] px-3 py-1.5 font-mono text-[10px] font-black uppercase tracking-[.2em] text-amber-200">
            <History size={12} aria-hidden="true" />
            Permanent Record
          </div>
        </div>

        <header className="mt-10 max-w-4xl">
          <span className="font-mono text-xs font-black uppercase tracking-[.28em] text-cyan-300">
            The Grid // Season Archive
          </span>
          <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
            The City Remembers.
          </h1>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-stone-400 sm:text-base">
            Live rankings move. Archived standings do not. When a Grid season
            closes, its final City Power order becomes permanent history.
          </p>
        </header>

        {!payload && !error ? (
          <section className="flex min-h-[360px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black uppercase tracking-[.14em] text-cyan-200">
              <Loader2 size={18} className="animate-spin" aria-hidden="true" />
              Reading permanent record
            </div>
          </section>
        ) : error ? (
          <section className="mt-8 rounded-3xl border border-rose-400/20 bg-rose-400/[.05] p-8">
            <h2 className="font-display text-2xl font-black uppercase text-rose-200">
              Archive Signal Interrupted
            </h2>
            <p className="mt-3 text-sm text-stone-400">{error}</p>
          </section>
        ) : payload?.enabled === false ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/40 p-8">
            <Radio size={26} className="text-stone-600" aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-black uppercase">
              Archive Offline
            </h2>
            <p className="mt-2 text-sm text-stone-500">
              Grid world reads are not active in this environment.
            </p>
          </section>
        ) : !archive ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/40 p-8 text-center">
            <Trophy size={34} className="mx-auto text-stone-700" aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-black uppercase text-stone-300">
              No Archived Season Yet
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-stone-500">
              The Founding Season stays live here until its final standings are
              frozen by the season-close operation.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-8 overflow-hidden rounded-3xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[.08] to-cyan-300/[.03] p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div>
                  <div className="font-mono text-[10px] font-black uppercase tracking-[.22em] text-amber-200">
                    Archived Season
                  </div>
                  <h2 className="mt-2 font-display text-3xl font-black uppercase sm:text-4xl">
                    {archive.seasonName}
                  </h2>
                  <p className="mt-2 text-xs text-stone-500">
                    Frozen {formatArchivedAt(archive.archivedAt)}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-300/20 bg-black/35 px-5 py-4 text-right">
                  <div className="font-mono text-[9px] font-black uppercase tracking-[.16em] text-stone-500">
                    City Champion
                  </div>
                  <div className="mt-1 font-display text-2xl font-black uppercase text-amber-200">
                    {archive.championCallsign ?? '—'}
                  </div>
                  <div className="mt-1 text-xs text-stone-600">
                    {archive.standingsCount} final placement
                    {archive.standingsCount === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-black/40">
              <div className="border-b border-white/10 p-5 sm:p-6">
                <div className="font-mono text-[10px] font-black uppercase tracking-[.22em] text-cyan-300">
                  Final Standings
                </div>
                <h2 className="mt-1 font-display text-2xl font-black uppercase">
                  Locked City Power Order
                </h2>
              </div>

              <div className="divide-y divide-white/5">
                {entries.map((entry) => (
                  <article
                    key={`${entry.rank}-${entry.callsign}`}
                    className="grid grid-cols-[48px_1fr] gap-3 p-4 sm:grid-cols-[58px_1fr_auto] sm:items-center sm:p-5"
                  >
                    <div className="flex h-11 items-center justify-center">
                      {rankMark(entry.rank)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        {entry.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={entry.avatarUrl}
                            alt=""
                            className="h-10 w-10 rounded-full border border-white/10 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 font-display text-sm font-black text-stone-400">
                            {entry.callsign.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-lg font-black uppercase">
                            {entry.callsign}
                          </h3>
                          <p className="mt-0.5 text-xs text-stone-500">
                            {entry.totalXp.toLocaleString()} XP
                            {entry.champion ? ' · Season Champion' : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="col-start-2 flex flex-wrap gap-x-6 gap-y-2 sm:col-start-auto sm:justify-end sm:text-right">
                      <div>
                        <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-stone-600">
                          City Power
                        </div>
                        <div className="font-display text-lg font-black text-cyan-300">
                          {entry.cityPower.toLocaleString()} / 10,000
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-stone-600">
                          Grid Rating
                        </div>
                        <div className="font-display text-lg font-black">
                          {entry.gridRating.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}

        <p className="mx-auto mt-8 max-w-3xl text-center font-mono text-[10px] uppercase leading-relaxed tracking-[.15em] text-stone-600">
          Archive responses expose public callsigns and final game scores only.
          Player UUIDs and private account data never leave the server.
        </p>
      </div>
    </main>
  );
}
