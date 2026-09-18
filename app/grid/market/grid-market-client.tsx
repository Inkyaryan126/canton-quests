'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  ChevronRight,
  Coins,
  Gavel,
  Handshake,
  History,
  Loader2,
  LockKeyhole,
  Radio,
  ShieldCheck,
  Store,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatCountdown, formatCredits, timeAgo } from '../grid-ui-format';

interface WorldWallet {
  credits: number;
  influence: number;
  commandPoints: number;
}

interface WorldProperty {
  slug: string;
  name: string;
  ownership: 'neutral' | 'you' | 'occupied';
  developmentLevel: number;
}

interface WorldProjection {
  city: { name: string };
  season: { name: string; runtimeActive: boolean };
  player: {
    authenticated: boolean;
    joined: boolean;
    wallet: WorldWallet | null;
  };
  properties: WorldProperty[];
}

interface AuctionListing {
  auctionId: string;
  propertySlug: string;
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

interface MarketListingSummary {
  listingId: string;
  propertySlug: string;
  propertyName: string;
  priceCredits: number;
  expiresAt: string;
  viewerIsSeller: boolean;
}

interface MarketTransactionFeedEntry {
  transactionId: string;
  occurredAt: string;
  source: 'direct-deal' | 'fixed-price';
  netCreditsDelta: number;
  propertyTransfers: Array<{
    propertySlug: string;
    propertyName: string;
    direction: 'acquired' | 'sold';
  }>;
}

type Availability = 'loading' | 'ready' | 'disabled' | 'error';

export default function GridMarketClient() {
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [world, setWorld] = useState<WorldProjection | null>(null);
  const [worldError, setWorldError] = useState<string | null>(null);

  const [auctions, setAuctions] = useState<AuctionListing[]>([]);
  const [auctionsState, setAuctionsState] = useState<Availability>('loading');

  const [listings, setListings] = useState<MarketListingSummary[]>([]);
  const [listingsState, setListingsState] = useState<Availability>('loading');

  const [transactions, setTransactions] = useState<MarketTransactionFeedEntry[]>([]);
  const [transactionsState, setTransactionsState] = useState<Availability>('loading');

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const worldResponse = await fetch('/api/grid/world', { cache: 'no-store' });
      const worldPayload = await worldResponse.json().catch(() => null);
      if (cancelled) return;

      if (!worldResponse.ok || !worldPayload?.projection) {
        setWorldError('The Grid world state is unavailable.');
        setLoading(false);
        return;
      }

      const projection = worldPayload.projection as WorldProjection;
      setWorld(projection);

      if (!projection.player.authenticated) {
        setAuthRequired(true);
        setLoading(false);
        return;
      }
      setAuthRequired(false);

      const [auctionsResponse, listingsResponse, transactionsResponse] =
        await Promise.all([
          fetch('/api/grid/auctions/active', { cache: 'no-store' }),
          fetch('/api/grid/market/listings', { cache: 'no-store' }),
          fetch('/api/grid/market/transactions', { cache: 'no-store' }),
        ]);
      if (cancelled) return;

      if (auctionsResponse.status === 404) {
        setAuctionsState('disabled');
      } else {
        const payload = await auctionsResponse.json().catch(() => null);
        if (auctionsResponse.ok && payload?.success) {
          setAuctions(payload.auctions ?? []);
          setAuctionsState('ready');
        } else {
          setAuctionsState('error');
        }
      }

      if (listingsResponse.status === 404) {
        setListingsState('disabled');
      } else {
        const payload = await listingsResponse.json().catch(() => null);
        if (listingsResponse.ok && payload?.success) {
          setListings(payload.listings ?? []);
          setListingsState('ready');
        } else {
          setListingsState('error');
        }
      }

      if (transactionsResponse.status === 404) {
        setTransactionsState('disabled');
      } else {
        const payload = await transactionsResponse.json().catch(() => null);
        if (transactionsResponse.ok && payload?.success) {
          setTransactions(payload.transactions ?? []);
          setTransactionsState('ready');
        } else {
          setTransactionsState('error');
        }
      }

      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const ownedProperties = world?.properties.filter((p) => p.ownership === 'you') ?? [];
  const endingSoon = [...auctions].sort(
    (a, b) => Date.parse(a.endsAt) - Date.parse(b.endsAt),
  );

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.08) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <main className="relative mx-auto max-w-6xl px-4 py-7 sm:px-7">
        <header className="border-b border-white/10 pb-7">
          <Link
            href="/grid"
            className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 transition hover:text-cyan-200"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            THE GRID
          </Link>

          <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
                <Radio size={13} className="animate-pulse" aria-hidden="true" />
                {(world ? world.city.name.toUpperCase() : 'THE GRID') + ' // CITY EXCHANGE'}
              </div>
              <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
                MARKET
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-base">
                Trade properties, track live auctions, and watch where your Credits go.
              </p>
            </div>

            <nav className="flex flex-wrap gap-2">
              <Link
                href="/grid/auctions"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[.06] px-4 py-2.5 font-display text-xs font-black uppercase tracking-[.08em] text-amber-100 transition hover:bg-amber-300/[.12]"
              >
                <Gavel size={15} aria-hidden="true" />
                Auctions
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
              <Link
                href="/grid/market/listings"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[.06] px-4 py-2.5 font-display text-xs font-black uppercase tracking-[.08em] text-cyan-100 transition hover:bg-cyan-300/[.12]"
              >
                <Store size={15} aria-hidden="true" />
                Listings
                <ChevronRight size={14} aria-hidden="true" />
              </Link>
            </nav>
          </div>
        </header>

        {loading ? (
          <section className="flex min-h-[420px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-cyan-200">
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              SYNCING MARKET STATE
            </div>
          </section>
        ) : authRequired ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <LockKeyhole size={30} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Sign in with your Canton Quests player account to trade on the
              Grid market.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Sign in
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : worldError ? (
          <section className="mt-8 rounded-3xl border border-rose-400/25 bg-rose-400/[.06] p-7">
            <p className="text-sm text-rose-100">{worldError}</p>
          </section>
        ) : world && !world.player.joined ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <Radio size={30} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Join the season to trade
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              The market opens once you have a seasonal wallet and a foothold
              in {world.city.name}.
            </p>
            <Link
              href="/grid/onboarding"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Enter The Grid
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : world ? (
          <>
            <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={<Coins size={18} className="text-amber-300" aria-hidden="true" />}
                label="CREDITS AVAILABLE"
                value={formatCredits(world.player.wallet?.credits ?? 0)}
              />
              <StatTile
                icon={<Building2 size={18} className="text-emerald-300" aria-hidden="true" />}
                label="OWNED PROPERTIES"
                value={String(ownedProperties.length)}
              />
              <StatTile
                icon={<Store size={18} className="text-cyan-300" aria-hidden="true" />}
                label="OPEN LISTINGS"
                value={
                  listingsState === 'ready'
                    ? String(listings.length)
                    : listingsState === 'disabled'
                      ? 'OFFLINE'
                      : '—'
                }
              />
              <StatTile
                icon={<Gavel size={18} className="text-amber-300" aria-hidden="true" />}
                label="ACTIVE AUCTIONS"
                value={
                  auctionsState === 'ready'
                    ? String(auctions.length)
                    : auctionsState === 'disabled'
                      ? 'OFFLINE'
                      : '—'
                }
              />
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div className="rounded-3xl border border-amber-300/20 bg-amber-300/[.035] p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-amber-300">
                      <Gavel size={13} aria-hidden="true" />
                      AUCTIONS ENDING SOON
                    </div>
                    <Link
                      href="/grid/auctions"
                      className="flex items-center gap-1 font-mono text-[10px] font-black tracking-[.14em] text-stone-500 hover:text-amber-200"
                    >
                      VIEW ALL
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </div>

                  {auctionsState === 'disabled' ? (
                    <EmptyNote>
                      Auctions are not live in {world.city.name} yet.
                    </EmptyNote>
                  ) : auctionsState === 'error' ? (
                    <EmptyNote>Auction data is temporarily unavailable.</EmptyNote>
                  ) : endingSoon.length === 0 ? (
                    <EmptyNote>
                      No auctions are active right now. Check back soon.
                    </EmptyNote>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {endingSoon.slice(0, 3).map((auction) => {
                        const countdown = formatCountdown(auction.endsAt, now);
                        return (
                          <li key={auction.auctionId}>
                            <Link
                              href={`/grid/auctions/${auction.auctionId}`}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 transition hover:border-amber-300/30"
                            >
                              <div>
                                <div className="font-display text-sm font-black uppercase">
                                  {auction.propertyName}
                                </div>
                                <div className="mt-1 font-mono text-[10px] text-stone-500">
                                  {auction.leadingBidCredits
                                    ? `${formatCredits(auction.leadingBidCredits)} CR LEADING`
                                    : `${formatCredits(auction.reserveCredits)} CR RESERVE`}
                                  {auction.viewerIsLeadingBidder ? ' • YOU LEAD' : ''}
                                </div>
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
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[.035] p-5 sm:p-7">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
                      <Store size={13} aria-hidden="true" />
                      MARKET LISTINGS
                    </div>
                    <Link
                      href="/grid/market/listings"
                      className="flex items-center gap-1 font-mono text-[10px] font-black tracking-[.14em] text-stone-500 hover:text-cyan-200"
                    >
                      BROWSE
                      <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                  </div>

                  {listingsState === 'disabled' ? (
                    <EmptyNote>
                      The property market is not open in {world.city.name} yet.
                    </EmptyNote>
                  ) : listingsState === 'error' ? (
                    <EmptyNote>Listing data is temporarily unavailable.</EmptyNote>
                  ) : listings.length === 0 ? (
                    <EmptyNote>
                      No properties are listed for sale right now.
                    </EmptyNote>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {listings.slice(0, 3).map((listing) => (
                        <li key={listing.listingId}>
                          <Link
                            href="/grid/market/listings"
                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 p-4 transition hover:border-cyan-300/30"
                          >
                            <div className="font-display text-sm font-black uppercase">
                              {listing.propertyName}
                            </div>
                            <div className="font-mono text-xs font-black text-cyan-100">
                              {formatCredits(listing.priceCredits)} CR
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <Link
                  href="/grid/market/deals"
                  className="block rounded-3xl border border-emerald-300/20 bg-emerald-300/[.035] p-5 transition hover:border-emerald-300/40 sm:p-7"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-emerald-300">
                        <Handshake size={13} aria-hidden="true" />
                        DIRECT DEALS
                      </div>
                      <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                        Send private Credit/property offers by callsign and
                        accept only the exact terms you were shown.
                      </p>
                    </div>
                    <ArrowRight size={18} className="text-emerald-200" aria-hidden="true" />
                  </div>
                </Link>

                <div className="rounded-3xl border border-white/10 bg-black/45 p-5 sm:p-7">
                  <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-stone-400">
                    <History size={13} aria-hidden="true" />
                    TRANSACTION FEED
                  </div>

                  {transactionsState === 'disabled' ? (
                    <EmptyNote>
                      Market history is not available in {world.city.name} yet.
                    </EmptyNote>
                  ) : transactionsState === 'error' ? (
                    <EmptyNote>Transaction history is temporarily unavailable.</EmptyNote>
                  ) : transactions.length === 0 ? (
                    <EmptyNote>
                      No market activity yet. Your trades will appear here.
                    </EmptyNote>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {transactions.slice(0, 5).map((entry) => (
                        <li
                          key={entry.transactionId}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 p-4"
                        >
                          <div>
                            <div className="font-display text-sm font-black uppercase">
                              {entry.propertyTransfers[0]?.propertyName ??
                                (entry.source === 'fixed-price' ? 'Market trade' : 'Direct deal')}
                            </div>
                            <div className="mt-1 font-mono text-[10px] text-stone-500">
                              {timeAgo(entry.occurredAt, now)}
                            </div>
                          </div>
                          <div
                            className={
                              'flex items-center gap-1 font-mono text-xs font-black ' +
                              (entry.netCreditsDelta >= 0
                                ? 'text-emerald-300'
                                : 'text-rose-300')
                            }
                          >
                            {entry.netCreditsDelta >= 0 ? (
                              <TrendingUp size={13} aria-hidden="true" />
                            ) : (
                              <TrendingDown size={13} aria-hidden="true" />
                            )}
                            {entry.netCreditsDelta >= 0 ? '+' : ''}
                            {formatCredits(entry.netCreditsDelta)} CR
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                  <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                    <ShieldCheck size={18} className="text-emerald-300" aria-hidden="true" />
                    Server authority
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-500">
                    Ownership, pricing, eligibility, and settlement are resolved
                    on the server. The browser only displays what the Grid
                    already decided.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                  <div className="font-display text-lg font-black uppercase">
                    Your properties
                  </div>
                  {ownedProperties.length === 0 ? (
                    <p className="mt-3 text-xs leading-relaxed text-stone-500">
                      You don&apos;t own any tradable property yet.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {ownedProperties.slice(0, 6).map((property) => (
                        <li
                          key={property.slug}
                          className="rounded-xl bg-white/[.035] px-3 py-2 text-xs text-stone-300"
                        >
                          {property.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

function StatTile(props: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/45 p-4">
      <div className="flex items-center gap-2">{props.icon}</div>
      <div className="mt-3 font-display text-2xl font-black text-white">
        {props.value}
      </div>
      <div className="mt-1 font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
        {props.label}
      </div>
    </div>
  );
}

function EmptyNote(props: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-xs leading-relaxed text-stone-500">
      {props.children}
    </p>
  );
}
