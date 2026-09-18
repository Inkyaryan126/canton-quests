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
  propertySlug: string;
  propertyName: string;
  priceCredits: number;
  expiresAt: string;
  viewerIsSeller: boolean;
}

interface OwnedProperty {
  slug: string;
  name: string;
}

type PageState = 'loading' | 'auth-required' | 'disabled' | 'error' | 'ready';

function commandKey(scope: string): string {
  const storageKey = 'grid:market-command:' + scope;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key = 'grid-market:' + scope + ':' + window.crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, key);
  return key;
}

function clearCommandKey(scope: string): void {
  window.sessionStorage.removeItem('grid:market-command:' + scope);
}

export default function GridMarketListingsClient() {
  const [state, setState] = useState<PageState>('loading');
  const [listings, setListings] = useState<MarketListingSummary[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [ownedProperties, setOwnedProperties] = useState<OwnedProperty[]>([]);
  const [selectedPropertySlug, setSelectedPropertySlug] = useState('');
  const [priceCredits, setPriceCredits] = useState('500');
  const [durationMinutes, setDurationMinutes] = useState('1440');
  const [error, setError] = useState<string | null>(null);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchaseNotice, setPurchaseNotice] = useState<string | null>(null);
  const [busySellerAction, setBusySellerAction] = useState<string | null>(null);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [sellerNotice, setSellerNotice] = useState<string | null>(null);

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
    const nextOwnedProperties = (
      worldPayload?.projection?.properties ?? []
    )
      .filter((property: { ownership?: string }) => property.ownership === 'you')
      .map((property: { slug: string; name: string }) => ({
        slug: property.slug,
        name: property.name,
      })) as OwnedProperty[];
    const nextListings = (payload.listings ?? []) as MarketListingSummary[];
    const sellerListedSlugs = new Set(
      nextListings
        .filter((listing) => listing.viewerIsSeller)
        .map((listing) => listing.propertySlug),
    );
    setOwnedProperties(nextOwnedProperties);
    setSelectedPropertySlug((current) =>
      nextOwnedProperties.some(
        (property) =>
          property.slug === current && !sellerListedSlugs.has(property.slug),
      )
        ? current
        : nextOwnedProperties.find(
            (property) => !sellerListedSlugs.has(property.slug),
          )?.slug ?? '',
    );

    setListings(nextListings);
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

  const openListing = useCallback(async () => {
    const price = Number(priceCredits);
    const duration = Number(durationMinutes);
    const scope =
      'open:' + selectedPropertySlug + ':' + priceCredits + ':' + durationMinutes;

    setBusySellerAction('open');
    setSellerError(null);
    setSellerNotice(null);
    try {
      const response = await fetch('/api/grid/market/listings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertySlug: selectedPropertySlug,
          priceCredits: price,
          durationMinutes: duration,
          idempotencyKey: commandKey(scope),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Listing was rejected.');
      }

      clearCommandKey(scope);
      setSellerNotice('Listing opened. Your property is now on the market.');
      await load();
    } catch (cause) {
      setSellerError(
        cause instanceof Error ? cause.message : 'Listing was rejected.',
      );
    } finally {
      setBusySellerAction(null);
    }
  }, [durationMinutes, load, priceCredits, selectedPropertySlug]);

  const cancelListing = useCallback(
    async (listingId: string) => {
      const scope = 'cancel:' + listingId;
      setBusySellerAction(listingId);
      setSellerError(null);
      setSellerNotice(null);
      try {
        const response = await fetch(
          `/api/grid/market/listings/${listingId}`,
          {
            method: 'DELETE',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ idempotencyKey: commandKey(scope) }),
          },
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? 'Cancellation was rejected.');
        }

        clearCommandKey(scope);
        setSellerNotice('Listing cancelled. The property is off the market.');
        await load();
      } catch (cause) {
        setSellerError(
          cause instanceof Error ? cause.message : 'Cancellation was rejected.',
        );
      } finally {
        setBusySellerAction(null);
      }
    },
    [load],
  );

  const listedPropertySlugs = new Set(
    listings
      .filter((listing) => listing.viewerIsSeller)
      .map((listing) => listing.propertySlug),
  );
  const sellableProperties = ownedProperties.filter(
    (property) => !listedPropertySlugs.has(property.slug),
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
        {sellerError ? (
          <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-100">
            {sellerError}
          </div>
        ) : null}
        {sellerNotice ? (
          <div className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[.07] px-4 py-3 text-sm text-emerald-100">
            {sellerNotice}
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
        ) : (
          <>
            <div className="mt-6 flex items-center gap-2 font-mono text-[11px] text-stone-500">
              <Coins size={13} className="text-amber-300" aria-hidden="true" />
              {credits !== null
                ? `${formatCredits(credits)} CR available`
                : 'Credits unavailable'}
            </div>

            <section className="mt-5 rounded-3xl border border-amber-300/20 bg-amber-300/[.035] p-5 sm:p-6">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <Tag size={18} className="text-amber-300" aria-hidden="true" />
                Sell a property
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                Ownership, cooldowns, price limits, duration limits, and duplicate
                listings are enforced again on the server when you publish.
              </p>

              {sellableProperties.length === 0 ? (
                <p className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-stone-500">
                  You do not have an unlisted property available to sell.
                </p>
              ) : (
                <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_.8fr_.8fr_auto]">
                  <label className="text-xs text-stone-400">
                    Property
                    <select
                      value={selectedPropertySlug}
                      onChange={(event) => setSelectedPropertySlug(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-sm text-white"
                    >
                      {sellableProperties.map((property) => (
                        <option key={property.slug} value={property.slug}>
                          {property.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-stone-400">
                    Price (CR)
                    <input
                      inputMode="numeric"
                      value={priceCredits}
                      onChange={(event) => setPriceCredits(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-stone-400">
                    Duration
                    <select
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(event.target.value)}
                      className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-sm text-white"
                    >
                      <option value="60">1 hour</option>
                      <option value="1440">24 hours</option>
                      <option value="10080">7 days</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={
                      !selectedPropertySlug ||
                      !Number.isSafeInteger(Number(priceCredits)) ||
                      Number(priceCredits) <= 0 ||
                      busySellerAction !== null
                    }
                    onClick={() => void openListing()}
                    className="min-h-11 self-end rounded-xl border border-amber-300/30 bg-amber-300/[.1] px-4 font-display text-xs font-black uppercase tracking-[.08em] text-amber-100 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {busySellerAction === 'open' ? (
                      <Loader2 size={14} className="mx-auto animate-spin" aria-hidden="true" />
                    ) : (
                      'List property'
                    )}
                  </button>
                </div>
              )}
            </section>

            {listings.length === 0 ? (
              <section className="mt-5 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
                <Tag size={30} className="text-stone-600" aria-hidden="true" />
                <h2 className="mt-5 font-display text-3xl font-black uppercase">
                  No properties listed
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                  No one has listed a property for sale right now.
                </p>
              </section>
            ) : (
              <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listings.map((listing) => {
                  const affordable =
                    credits === null || credits >= listing.priceCredits;
                  const busy = busyListingId === listing.listingId;
                  const cancelling = busySellerAction === listing.listingId;
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
                        <button
                          type="button"
                          disabled={busySellerAction !== null}
                          onClick={() => void cancelListing(listing.listingId)}
                          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/[.07] px-3 py-2.5 font-display text-xs font-black uppercase tracking-[.08em] text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          {cancelling ? (
                            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                          ) : null}
                          Cancel your listing
                        </button>
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
