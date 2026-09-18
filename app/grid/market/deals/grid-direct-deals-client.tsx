'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRightLeft,
  ChevronRight,
  Coins,
  Handshake,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { formatCredits, formatCountdown } from '../../grid-ui-format';

interface PropertyTerm {
  slug: string;
  name: string;
}

interface DealSummary {
  proposalId: string;
  role: 'sent' | 'received';
  counterpartyCallsign: string;
  yourCredits: number;
  theirCredits: number;
  yourProperties: PropertyTerm[];
  theirProperties: PropertyTerm[];
  createdAt: string;
  expiresAt: string;
}

interface WorldProperty {
  slug: string;
  name: string;
  ownership: 'neutral' | 'you' | 'occupied';
}

interface WorldProjection {
  player: {
    authenticated: boolean;
    joined: boolean;
    wallet: { credits: number } | null;
  };
  properties: WorldProperty[];
}

type PageState =
  | 'loading'
  | 'auth-required'
  | 'disabled'
  | 'error'
  | 'ready';

function commandKey(scope: string): string {
  const storageKey = 'grid:direct-deal-command:' + scope;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key = 'grid-direct-deal:' + scope + ':' + window.crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, key);
  return key;
}

function clearCommandKey(scope: string): void {
  window.sessionStorage.removeItem('grid:direct-deal-command:' + scope);
}

function TermList(props: {
  credits: number;
  properties: PropertyTerm[];
  label: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-3">
      <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
        {props.label}
      </div>
      <div className="mt-2 font-display text-lg font-black text-amber-100">
        {formatCredits(props.credits)} CR
      </div>
      {props.properties.length > 0 ? (
        <div className="mt-2 space-y-1">
          {props.properties.map((property) => (
            <div key={property.slug} className="text-xs text-stone-400">
              + {property.name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function GridDirectDealsClient() {
  const [state, setState] = useState<PageState>('loading');
  const [deals, setDeals] = useState<DealSummary[]>([]);
  const [world, setWorld] = useState<WorldProjection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [callsign, setCallsign] = useState('');
  const [offerCredits, setOfferCredits] = useState('0');
  const [requestCredits, setRequestCredits] = useState('0');
  const [durationMinutes, setDurationMinutes] = useState('1440');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    const [dealResponse, worldResponse] = await Promise.all([
      fetch('/api/grid/market/deals', { cache: 'no-store' }),
      fetch('/api/grid/world', { cache: 'no-store' }),
    ]);

    if (dealResponse.status === 401) {
      setState('auth-required');
      return;
    }
    if (dealResponse.status === 404) {
      setState('disabled');
      return;
    }

    const dealPayload = await dealResponse.json().catch(() => null);
    const worldPayload = await worldResponse.json().catch(() => null);
    if (!dealResponse.ok || !dealPayload?.success) {
      setError(dealPayload?.error ?? 'Direct Deals are unavailable.');
      setState('error');
      return;
    }
    if (!worldResponse.ok || !worldPayload?.projection) {
      setError('The Grid world state is unavailable.');
      setState('error');
      return;
    }

    setDeals(dealPayload.deals ?? []);
    setWorld(worldPayload.projection as WorldProjection);
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ownedProperties = useMemo(
    () => world?.properties.filter((property) => property.ownership === 'you') ?? [],
    [world],
  );

  const toggleProperty = (slug: string) => {
    setSelectedProperties((current) =>
      current.includes(slug)
        ? current.filter((value) => value !== slug)
        : current.length < 4
          ? [...current, slug]
          : current,
    );
  };

  const createDeal = async () => {
    const offered = Number(offerCredits);
    const requested = Number(requestCredits);
    const duration = Number(durationMinutes);
    const scope =
      'create:' +
      callsign.trim().toLowerCase() +
      ':' +
      offerCredits +
      ':' +
      requestCredits +
      ':' +
      selectedProperties.slice().sort().join(',');

    setBusy('create');
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/grid/market/deals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          counterpartyCallsign: callsign,
          proposerCredits: offered,
          counterpartyCredits: requested,
          proposerPropertySlugs: selectedProperties,
          durationMinutes: duration,
          idempotencyKey: commandKey(scope),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Direct Deal was rejected.');
      }
      clearCommandKey(scope);
      setNotice('Direct Deal sent. The other player must explicitly accept it.');
      setCallsign('');
      setOfferCredits('0');
      setRequestCredits('0');
      setSelectedProperties([]);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Direct Deal was rejected.',
      );
    } finally {
      setBusy(null);
    }
  };

  const resolveDeal = async (
    proposalId: string,
    action: 'accept' | 'cancel',
  ) => {
    const scope = action + ':' + proposalId;
    setBusy(scope);
    setError(null);
    setNotice(null);
    try {
      const endpoint =
        action === 'accept'
          ? `/api/grid/market/deals/${encodeURIComponent(proposalId)}/accept`
          : `/api/grid/market/deals/${encodeURIComponent(proposalId)}`;
      const response = await fetch(endpoint, {
        method: action === 'accept' ? 'POST' : 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: commandKey(scope) }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? 'Direct Deal action was rejected.');
      }
      clearCommandKey(scope);
      setNotice(
        action === 'accept'
          ? 'Direct Deal accepted and settled atomically.'
          : 'Direct Deal cancelled.',
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Direct Deal action was rejected.',
      );
    } finally {
      setBusy(null);
    }
  };

  const offerValueMovement =
    Number(offerCredits) > 0 ||
    Number(requestCredits) > 0 ||
    selectedProperties.length > 0;

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <main className="relative mx-auto max-w-6xl px-4 py-7 sm:px-7">
        <Link
          href="/grid/market"
          className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 hover:text-cyan-200"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          MARKET
        </Link>

        <header className="mt-6 border-b border-white/10 pb-7">
          <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
            <Handshake size={14} aria-hidden="true" />
            PRIVATE PLAYER-TO-PLAYER CONSENT
          </div>
          <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-6xl">
            DIRECT DEALS
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-400">
            Send a private offer by callsign. The recipient must accept the exact
            frozen terms before Credits or property can move.
          </p>
        </header>

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[.07] px-4 py-3 text-sm text-emerald-100">
            {notice}
          </div>
        ) : null}

        {state === 'loading' ? (
          <section className="flex min-h-[360px] items-center justify-center">
            <Loader2 className="animate-spin text-cyan-300" size={22} />
          </section>
        ) : state === 'auth-required' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-8">
            <LockKeyhole size={30} className="text-cyan-300" />
            <h2 className="mt-4 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <Link href="/login" className="mt-5 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase text-slate-950">
              Sign in
            </Link>
          </section>
        ) : state === 'disabled' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-8">
            <ShieldCheck size={30} className="text-stone-600" />
            <h2 className="mt-4 font-display text-3xl font-black uppercase">
              Direct Deals are staged
            </h2>
            <p className="mt-3 text-sm text-stone-500">
              Private deal reads are not enabled in this environment.
            </p>
          </section>
        ) : state === 'error' ? null : (
          <>
            <section className="mt-6 rounded-3xl border border-cyan-300/20 bg-cyan-300/[.035] p-5 sm:p-7">
              <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
                <ArrowRightLeft size={18} className="text-cyan-300" />
                Propose a deal
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                This first player surface lets you offer your own properties and
                Credits in exchange for Credits. It does not expose which
                properties another player owns.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="text-xs text-stone-400">
                  Counterparty callsign
                  <input
                    value={callsign}
                    onChange={(event) => setCallsign(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                    placeholder="PLAYER CALLSIGN"
                  />
                </label>
                <label className="text-xs text-stone-400">
                  Offer Credits
                  <input
                    inputMode="numeric"
                    value={offerCredits}
                    onChange={(event) => setOfferCredits(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  />
                </label>
                <label className="text-xs text-stone-400">
                  Request Credits
                  <input
                    inputMode="numeric"
                    value={requestCredits}
                    onChange={(event) => setRequestCredits(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  />
                </label>
                <label className="text-xs text-stone-400">
                  Offer expires
                  <select
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  >
                    <option value="60">1 hour</option>
                    <option value="1440">24 hours</option>
                    <option value="10080">7 days</option>
                  </select>
                </label>
              </div>

              <div className="mt-4">
                <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                  YOUR PROPERTIES // MAX 4
                </div>
                {ownedProperties.length === 0 ? (
                  <p className="mt-2 text-xs text-stone-500">
                    You do not own a property to add to this offer.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ownedProperties.map((property) => {
                      const selected = selectedProperties.includes(property.slug);
                      return (
                        <button
                          type="button"
                          key={property.slug}
                          onClick={() => toggleProperty(property.slug)}
                          className={
                            'rounded-full border px-3 py-2 text-xs transition ' +
                            (selected
                              ? 'border-cyan-300/50 bg-cyan-300/[.12] text-cyan-100'
                              : 'border-white/10 bg-black/30 text-stone-500')
                          }
                        >
                          {property.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={
                  busy !== null ||
                  callsign.trim().length < 2 ||
                  !Number.isSafeInteger(Number(offerCredits)) ||
                  Number(offerCredits) < 0 ||
                  !Number.isSafeInteger(Number(requestCredits)) ||
                  Number(requestCredits) < 0 ||
                  !offerValueMovement
                }
                onClick={() => void createDeal()}
                className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {busy === 'create' ? <Loader2 size={16} className="animate-spin" /> : <Handshake size={16} />}
                Send Direct Deal
              </button>
            </section>

            <section className="mt-6">
              <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
                <Tag size={18} className="text-amber-300" />
                Open proposals
              </div>

              {deals.length === 0 ? (
                <p className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-5 text-sm text-stone-500">
                  No open Direct Deals.
                </p>
              ) : (
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {deals.map((deal) => {
                    const countdown = formatCountdown(deal.expiresAt, now);
                    const actionScope =
                      (deal.role === 'received' ? 'accept:' : 'cancel:') +
                      deal.proposalId;
                    return (
                      <article
                        key={deal.proposalId}
                        className="rounded-3xl border border-white/10 bg-black/45 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                              {deal.role === 'received' ? 'RECEIVED FROM' : 'SENT TO'}
                            </div>
                            <div className="mt-1 font-display text-xl font-black uppercase">
                              {deal.counterpartyCallsign}
                            </div>
                          </div>
                          <div className="rounded-full border border-white/10 px-3 py-1 font-mono text-[9px] text-stone-500">
                            {countdown.label}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <TermList
                            label="YOU GIVE"
                            credits={deal.yourCredits}
                            properties={deal.yourProperties}
                          />
                          <TermList
                            label="YOU RECEIVE"
                            credits={deal.theirCredits}
                            properties={deal.theirProperties}
                          />
                        </div>

                        <button
                          type="button"
                          disabled={busy !== null}
                          onClick={() =>
                            void resolveDeal(
                              deal.proposalId,
                              deal.role === 'received' ? 'accept' : 'cancel',
                            )
                          }
                          className={
                            'mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 font-display text-xs font-black uppercase tracking-[.08em] disabled:cursor-not-allowed disabled:opacity-35 ' +
                            (deal.role === 'received'
                              ? 'border-emerald-300/25 bg-emerald-300/[.08] text-emerald-100'
                              : 'border-rose-300/25 bg-rose-300/[.07] text-rose-100')
                          }
                        >
                          {busy === actionScope ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : null}
                          {deal.role === 'received'
                            ? 'Accept exact terms'
                            : 'Cancel proposal'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.04] p-4">
              <div className="flex items-center gap-2 font-display text-sm font-black uppercase">
                <ShieldCheck size={16} className="text-emerald-300" />
                Server-authoritative consent
              </div>
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                Callsign resolution, balances, ownership, property values,
                cooldowns, taxes, and settlement are rebuilt and rechecked on
                the server at acceptance.
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
