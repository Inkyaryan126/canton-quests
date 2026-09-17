'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Coins,
  Crown,
  Gavel,
  Loader2,
  LockKeyhole,
} from 'lucide-react';
import { formatCountdown, formatCredits } from '../../grid-ui-format';

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

type PageState = 'loading' | 'auth-required' | 'not-found' | 'error' | 'ready';

export default function GridAuctionDetailClient(props: { auctionId: string }) {
  const [state, setState] = useState<PageState>('loading');
  const [auction, setAuction] = useState<AuctionListing | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [bidError, setBidError] = useState<string | null>(null);
  const [bidNotice, setBidNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    const [auctionResponse, worldResponse] = await Promise.all([
      fetch(`/api/grid/auctions/${props.auctionId}`, { cache: 'no-store' }),
      fetch('/api/grid/world', { cache: 'no-store' }),
    ]);

    if (auctionResponse.status === 401) {
      setState('auth-required');
      return;
    }
    if (auctionResponse.status === 404) {
      setState('not-found');
      return;
    }

    const payload = await auctionResponse.json().catch(() => null);
    if (!auctionResponse.ok || !payload?.success || !payload.auction) {
      setError(payload?.error ?? 'This auction could not be loaded.');
      setState('error');
      return;
    }

    const worldPayload = await worldResponse.json().catch(() => null);
    setCredits(worldPayload?.projection?.player?.wallet?.credits ?? null);

    setAuction(payload.auction as AuctionListing);
    setBidAmount(String((payload.auction as AuctionListing).minimumNextBidCredits));
    setState('ready');
  }, [props.auctionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitBid = useCallback(async () => {
    if (!auction) return;
    const amountCredits = Number(bidAmount);
    if (!Number.isSafeInteger(amountCredits) || amountCredits <= 0) {
      setBidError('Enter a whole number of Credits.');
      return;
    }

    setBusy(true);
    setBidError(null);
    setBidNotice(null);
    try {
      const response = await fetch(`/api/grid/auctions/${auction.auctionId}/bid`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amountCredits,
          idempotencyKey: window.crypto.randomUUID(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Bid was rejected.');
      }
      setBidNotice('Bid accepted. Standings updated below.');
      await load();
    } catch (cause) {
      setBidError(cause instanceof Error ? cause.message : 'Bid was rejected.');
    } finally {
      setBusy(false);
    }
  }, [auction, bidAmount, load]);

  const countdown = auction ? formatCountdown(auction.endsAt, now) : null;
  const affordable =
    credits !== null && auction ? credits >= auction.minimumNextBidCredits : true;

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <main className="relative mx-auto max-w-3xl px-4 py-7 sm:px-7">
        <Link
          href="/grid/auctions"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 transition hover:text-amber-200"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          AUCTIONS
        </Link>

        {state === 'loading' ? (
          <section className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-amber-200">
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              LOADING AUCTION
            </div>
          </section>
        ) : state === 'auth-required' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <LockKeyhole size={30} className="text-amber-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Sign in
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : state === 'not-found' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <Gavel size={30} className="text-stone-600" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Auction no longer active
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              This auction has ended, been cancelled, or never existed.
            </p>
          </section>
        ) : state === 'error' ? (
          <section className="mt-8 rounded-3xl border border-rose-400/25 bg-rose-400/[.06] p-7">
            <p className="text-sm text-rose-100">{error}</p>
          </section>
        ) : auction && countdown ? (
          <>
            <header className="mt-6 border-b border-white/10 pb-6">
              <div className="font-mono text-[10px] font-black tracking-[.2em] text-amber-300">
                LIVE AUCTION
              </div>
              <h1 className="mt-3 font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
                {auction.propertyName}
              </h1>
            </header>

            <section className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
                <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                  CURRENT BID
                </div>
                <div className="mt-2 font-display text-2xl font-black text-amber-100">
                  {auction.leadingBidCredits
                    ? `${formatCredits(auction.leadingBidCredits)} CR`
                    : `${formatCredits(auction.reserveCredits)} CR reserve`}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
                <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                  NEXT VALID BID
                </div>
                <div className="mt-2 font-display text-2xl font-black text-white">
                  {formatCredits(auction.minimumNextBidCredits)} CR
                </div>
              </div>
              <div
                className={
                  'rounded-2xl border p-4 ' +
                  (countdown.urgent
                    ? 'border-rose-400/40 bg-rose-400/[.06]'
                    : 'border-white/10 bg-black/45')
                }
              >
                <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                  TIME REMAINING
                </div>
                <div
                  className={
                    'mt-2 font-display text-2xl font-black ' +
                    (countdown.urgent ? 'text-rose-200' : 'text-white')
                  }
                >
                  {countdown.label}
                </div>
              </div>
            </section>

            {auction.viewerIsLeadingBidder ? (
              <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-400/[.06] px-4 py-3 font-mono text-xs font-black tracking-[.08em] text-emerald-100">
                <Crown size={15} aria-hidden="true" />
                YOU ARE CURRENTLY LEADING THIS AUCTION
              </div>
            ) : null}

            <section className="mt-6 rounded-3xl border border-amber-300/20 bg-amber-300/[.035] p-5 sm:p-7">
              <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-amber-300">
                <Gavel size={13} aria-hidden="true" />
                PLACE A BID
              </div>

              {countdown.ended ? (
                <p className="mt-4 text-sm text-stone-400">
                  Bidding has closed on this auction.
                </p>
              ) : (
                <>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className="sr-only" htmlFor="bid-amount">
                      Bid amount in Credits
                    </label>
                    <input
                      id="bid-amount"
                      type="number"
                      inputMode="numeric"
                      min={auction.minimumNextBidCredits}
                      step={auction.minimumBidIncrementCredits}
                      value={bidAmount}
                      onChange={(event) => setBidAmount(event.target.value)}
                      className="w-40 rounded-xl border border-white/15 bg-black/50 px-3 py-2.5 font-mono text-sm text-white outline-none focus:border-amber-300/50"
                    />
                    <button
                      type="button"
                      disabled={busy || countdown.ended}
                      onClick={() => void submitBid()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-300 px-5 py-2.5 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Gavel size={16} aria-hidden="true" />
                      )}
                      Place bid
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2 font-mono text-[11px] text-stone-500">
                    <Coins size={13} className="text-amber-300" aria-hidden="true" />
                    {credits !== null
                      ? `${formatCredits(credits)} CR available`
                      : 'Credits unavailable'}
                    {!affordable ? (
                      <span className="text-rose-300">— insufficient Credits</span>
                    ) : null}
                  </div>
                </>
              )}

              {bidError ? (
                <p className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/[.07] px-3 py-2 text-xs text-rose-100">
                  {bidError}
                </p>
              ) : null}
              {bidNotice ? (
                <p className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/[.07] px-3 py-2 text-xs text-emerald-100">
                  {bidNotice}
                </p>
              ) : null}

              <p className="mt-4 text-[11px] leading-relaxed text-stone-600">
                The server resolves the winner, final price, and settlement.
                This countdown is a display estimate only.
              </p>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
