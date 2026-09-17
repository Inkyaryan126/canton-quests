'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Coins,
  Loader2,
  LockKeyhole,
  Store,
  Tag,
} from 'lucide-react';
import { formatCredits } from '../../grid-ui-format';

interface MarketListingSummary {
  listingId: string;
  propertyName: string;
  priceCredits: number;
  expiresAt: string;
  viewerIsSeller: boolean;
}

type PageState = 'loading' | 'auth-required' | 'disabled' | 'error' | 'ready';

export default function GridMarketListingsClient() {
  const [state, setState] = useState<PageState>('loading');
  const [listings, setListings] = useState<MarketListingSummary[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [listingsResponse, worldResponse] = await Promise.all([
      fetch('/api/grid/market/listings', { cache: 'no-store' }),
      fetch('/api/grid/world', { cache: 'no-store' }),
    ]);

    if (listingsResponse.status === 401) {
      setState('auth-required');
      return;
    }
    if (listingsResponse.status === 404) {
      setState('disabled');
      return;
    }

    const payload = await listingsResponse.json().catch(() => null);
    if (!listingsResponse.ok || !payload?.success) {
      setError(payload?.error ?? 'Grid market listings are unavailable.');
      setState('error');
      return;
    }

    const worldPayload = await worldResponse.json().catch(() => null);
    setCredits(worldPayload?.projection?.player?.wallet?.credits ?? null);

    setListings(payload.listings ?? []);
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const buy = useCallback(
    async (listingId: string) => {
      setBusyListingId(listingId);
      setPurchaseError(null);
      setPurchaseNotice(null);
      try {
        const response = await fetch(
          `/api/grid/market/listings/${listingId}/purchase`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ idempotencyKey: window.crypto.randomUUID() }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? 'Purchase was rejected.');
        }
        setPurchaseNotice('Purchase complete. The property is now yours.');
        await load();
      } catch (cause) {
        setPurchaseError(
          cause instanceof Error ? cause.message : 'Purchase was rejected.',
        );
      } finally {
        setBusyListingId(null);
      }
    },
    [load],
  );

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <main className="relative mx-auto max-w-5xl px-4 py-7 sm:px-7">
        <Link
          href="/grid/market"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 transition hover:text-cyan-200"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          MARKET
        </Link>

        <header className="mt-6 border-b border-white/10 pb-7">
          <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
            <Store size={13} aria-hidden="true" />
            FIXED-PRICE PROPERTY LISTINGS
          </div>
          <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">
            LISTINGS
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400">
            Buy properties instantly at the seller&apos;s asking price. No
            bidding required.
          </p>
        </header>

        {purchaseError ? (
          <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-100">
            {purchaseError}
          </div>
        ) : null}
        {purchaseNotice ? (
          <div className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[.07] px-4 py-3 text-sm text-emerald-100">
            {purchaseNotice}
          </div>
        ) : null}

        {state === 'loading' ? (
          <section className="flex min-h-[320px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-cyan-200">
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              SCANNING LISTINGS
            </div>
          </section>
        ) : state === 'auth-required' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <LockKeyhole size={30} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Sign in
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : state === 'disabled' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <Store size={30} className="text-stone-600" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              The property market is not open yet
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Fixed-price listings have not gone live in this city. Check
              back soon.
            </p>
          </section>
        ) : state === 'error' ? (
          <section className="mt-8 rounded-3xl border border-rose-400/25 bg-rose-400/[.06] p-7">
            <p className="text-sm text-rose-100">{error}</p>
          </section>
        ) : listings.length === 0 ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <Tag size={30} className="text-stone-600" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              No properties listed
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              No one has listed a property for sale right now. New listings
              appear here the moment they open.
            </p>
          </section>
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-stone-500">
              <Coins size={13} className="text-amber-300" aria-hidden="true" />
              {credits !== null
                ? `${formatCredits(credits)} CR available`
                : 'Credits unavailable'}
            </div>

            <section className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((listing) => {
                const affordable = credits === null || credits >= listing.priceCredits;
                const busy = busyListingId === listing.listingId;
                return (
                  <article
                    key={listing.listingId}
                    className="rounded-3xl border border-white/10 bg-black/45 p-5"
                  >
                    <div className="font-display text-lg font-black uppercase">
                      {listing.propertyName}
                    </div>
                    <div className="mt-3 font-display text-2xl font-black text-cyan-100">
                      {formatCredits(listing.priceCredits)} CR
                    </div>

                    {listing.viewerIsSeller ? (
                      <div className="mt-4 rounded-lg border border-white/10 bg-white/[.03] px-3 py-2 text-center font-mono text-[10px] font-black tracking-[.08em] text-stone-500">
                        YOUR LISTING
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={!affordable || busy}
                        onClick={() => void buy(listing.listingId)}
                        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[.08] px-3 py-2.5 font-display text-xs font-black uppercase tracking-[.08em] text-cyan-100 transition hover:bg-cyan-300/[.14] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {busy ? (
                          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                        ) : null}
                        {affordable ? 'Buy now' : 'Insufficient Credits'}
                      </button>
                    )}
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
