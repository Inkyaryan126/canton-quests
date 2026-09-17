'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Coins,
  Crown,
  Gavel,
  Loader2,
  LockKeyhole,
  Radio,
} from 'lucide-react';
import { formatCountdown, formatCredits } from '../grid-ui-format';

interface AuctionListing {
  auctionId: string;
  propertyName: string;
  status: 'scheduled' | 'open';
  reserveCredits: number;
  minimumBidIncrementCredits: number;
  startsAt: string;
  endsAt: string;
  leadingBidCredits?: number;
  minimumNextBidCredits: number;
  viewerIsLeadingBidder: boolean;
}

type PageState = 'loading' | 'auth-required' | 'disabled' | 'error' | 'ready';

export default function GridAuctionsClient() {
  const [state, setState] = useState<PageState>('loading');
  const [auctions, setAuctions] = useState<AuctionListing[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await fetch('/api/grid/auctions/active', { cache: 'no-store' });
      if (cancelled) return;

      if (response.status === 401) {
        setState('auth-required');
        return;
      }
      if (response.status === 404) {
        setState('disabled');
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        setError(payload?.error ?? 'Grid auctions are unavailable.');
        setState('error');
        return;
      }

      setAuctions(
        [...(payload.auctions ?? [])].sort(
          (a: AuctionListing, b: AuctionListing) =>
            Date.parse(a.endsAt) - Date.parse(b.endsAt),
        ),
      );
      setState('ready');
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(251,191,36,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(251,191,36,.06) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <main className="relative mx-auto max-w-5xl px-4 py-7 sm:px-7">
        <header className="border-b border-white/10 pb-7">
          <Link
            href="/grid/market"
            className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 transition hover:text-amber-200"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            MARKET
          </Link>

          <div className="mt-6 flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-amber-300">
            <Radio size={13} className="animate-pulse" aria-hidden="true" />
            LIVE PROPERTY AUCTIONS
          </div>
          <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
            AUCTIONS
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-base">
            Bid on contested properties. The highest confirmed bid when the
            clock hits zero wins the property.
          </p>
        </header>

        {state === 'loading' ? (
          <section className="flex min-h-[360px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-amber-200">
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              SCANNING AUCTION HOUSE
            </div>
          </section>
        ) : state === 'auth-required' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <LockKeyhole size={30} className="text-amber-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Sign in with your Canton Quests player account to bid on Grid
              auctions.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Sign in
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : state === 'disabled' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <Gavel size={30} className="text-stone-600" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Auctions are not live yet
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              The auction house has not opened in this city. Check back once
              it goes live.
            </p>
          </section>
        ) : state === 'error' ? (
          <section className="mt-8 rounded-3xl border border-rose-400/25 bg-rose-400/[.06] p-7">
            <p className="text-sm text-rose-100">{error}</p>
          </section>
        ) : auctions.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <Gavel size={30} className="text-stone-600" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              No active auctions
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Nothing is up for auction right now. Check back soon — new
              auctions appear here the moment they open.
            </p>
          </section>
        ) : (
          <section className="mt-7 grid gap-4 sm:grid-cols-2">
            {auctions.map((auction) => {
              const countdown = formatCountdown(auction.endsAt, now);
              return (
                <Link
                  key={auction.auctionId}
                  href={`/grid/auctions/${auction.auctionId}`}
                  className="rounded-3xl border border-white/10 bg-black/45 p-5 transition hover:border-amber-300/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="font-display text-xl font-black uppercase">
                      {auction.propertyName}
                    </div>
                    <div
                      className={
                        'shrink-0 rounded-full border px-3 py-1 font-mono text-[10px] font-black ' +
                        (countdown.urgent
                          ? 'border-rose-400/40 text-rose-200'
                          : 'border-amber-300/30 text-amber-100')
                      }
                    >
                      {countdown.label}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2 font-mono text-xs text-stone-400">
                    <Coins size={14} className="text-amber-300" aria-hidden="true" />
                    {auction.leadingBidCredits
                      ? `${formatCredits(auction.leadingBidCredits)} CR current bid`
                      : `${formatCredits(auction.reserveCredits)} CR reserve`}
                  </div>

                  <div className="mt-2 font-mono text-[10px] text-stone-600">
                    Next bid: {formatCredits(auction.minimumNextBidCredits)} CR
                  </div>

                  {auction.viewerIsLeadingBidder ? (
                    <div className="mt-4 flex items-center gap-1.5 font-mono text-[10px] font-black tracking-[.1em] text-emerald-300">
                      <Crown size={13} aria-hidden="true" />
                      YOU ARE LEADING
                    </div>
                  ) : null}
                </Link>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
