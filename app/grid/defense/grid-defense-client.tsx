'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Gauge,
  Loader2,
  LockKeyhole,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  Swords,
} from 'lucide-react';
import { DEFAULT_GRID_OFFLINE_DEFENSE_POLICY } from '@/lib/grid/core/offline-defense-default';
import type {
  GridOfflineDefensePolicy,
  GridOfflineDefensePriorityRule,
} from '@/lib/grid/core/offline-defense-types';
import type { GridContestTactic } from '@/lib/grid/core/contest-types';

interface DefenseResponse {
  success: boolean;
  policy?: GridOfflineDefensePolicy | null;
  updatedAt?: string | null;
  error?: string;
}

interface WorldResponse {
  projection?: {
    player: {
      wallet: { influence: number } | null;
    };
    territories: Array<{
      slug: string;
      name: string;
      ownership: 'neutral' | 'you' | 'occupied';
    }>;
  };
}

type PageState = 'loading' | 'auth-required' | 'disabled' | 'error' | 'ready';

const TACTICS: Array<{ value: GridContestTactic; label: string }> = [
  { value: 'fortify', label: 'Fortify' },
  { value: 'pressure', label: 'Pressure' },
  { value: 'flank', label: 'Flank' },
  { value: 'feint', label: 'Feint' },
];

function clonePolicy(policy: GridOfflineDefensePolicy): GridOfflineDefensePolicy {
  return {
    ...policy,
    priorityRules: policy.priorityRules.map((rule) => ({ ...rule })),
  };
}

function commandKey(scope: string): string {
  const storageKey = 'grid:defense-command:' + scope;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key = 'grid-defense:' + window.crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, key);
  return key;
}

function clearCommandKey(scope: string): void {
  window.sessionStorage.removeItem('grid:defense-command:' + scope);
}

function integerValue(raw: string): number {
  const value = Number(raw);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function percentValue(raw: string): number {
  return Math.min(100, integerValue(raw));
}

function policyScope(policy: GridOfflineDefensePolicy): string {
  return 'save:' + JSON.stringify(policy);
}

function formatUpdatedAt(value: string | null): string {
  if (!value) return 'Using safe default';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Saved doctrine';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function GridDefenseClient() {
  const [state, setState] = useState<PageState>('loading');
  const [draft, setDraft] = useState<GridOfflineDefensePolicy>(() =>
    clonePolicy(DEFAULT_GRID_OFFLINE_DEFENSE_POLICY),
  );
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [ownedTerritories, setOwnedTerritories] = useState<
    Array<{ slug: string; name: string }>
  >([]);
  const [walletInfluence, setWalletInfluence] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const [policyResponse, worldResponse] = await Promise.all([
      fetch('/api/grid/offline-defense', { cache: 'no-store' }),
      fetch('/api/grid/world', { cache: 'no-store' }),
    ]);

    if (policyResponse.status === 401) {
      setState('auth-required');
      return;
    }
    if (policyResponse.status === 404) {
      setState('disabled');
      return;
    }

    const policyPayload = (await policyResponse.json().catch(() => null)) as
      | DefenseResponse
      | null;
    const worldPayload = (await worldResponse.json().catch(() => null)) as
      | WorldResponse
      | null;

    if (!policyResponse.ok || !policyPayload?.success) {
      setError(policyPayload?.error ?? 'Defense doctrine is unavailable.');
      setState('error');
      return;
    }

    setDraft(
      clonePolicy(
        policyPayload.policy ?? DEFAULT_GRID_OFFLINE_DEFENSE_POLICY,
      ),
    );
    setUpdatedAt(policyPayload.updatedAt ?? null);

    const projection = worldPayload?.projection;
    setWalletInfluence(projection?.player.wallet?.influence ?? null);
    setOwnedTerritories(
      (projection?.territories ?? [])
        .filter((territory) => territory.ownership === 'you')
        .map(({ slug, name }) => ({ slug, name })),
    );
    setState('ready');
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const defaultCommitCap = useMemo(
    () =>
      Math.floor(
        (Math.min(draft.reserveInfluence, draft.maxCommitPerContest) *
          draft.defaultCommitBps) /
          10_000,
      ),
    [draft],
  );

  const updatePolicy = <K extends keyof GridOfflineDefensePolicy>(
    key: K,
    value: GridOfflineDefensePolicy[K],
  ) => {
    setDraft((current) => ({
      ...current,
      doctrineId: 'player-custom-v1',
      [key]: value,
    }));
    setNotice(null);
  };

  const ruleFor = (territorySlug: string) =>
    draft.priorityRules.find((rule) => rule.territorySlug === territorySlug);

  const setRule = (
    territorySlug: string,
    updater: (
      current: GridOfflineDefensePriorityRule,
    ) => GridOfflineDefensePriorityRule,
  ) => {
    setDraft((current) => {
      const existing = current.priorityRules.find(
        (rule) => rule.territorySlug === territorySlug,
      );
      if (!existing) return current;
      return {
        ...current,
        doctrineId: 'player-custom-v1',
        priorityRules: current.priorityRules.map((rule) =>
          rule.territorySlug === territorySlug ? updater(rule) : rule,
        ),
      };
    });
    setNotice(null);
  };

  const toggleRule = (territorySlug: string) => {
    setDraft((current) => {
      const existing = current.priorityRules.some(
        (rule) => rule.territorySlug === territorySlug,
      );
      return {
        ...current,
        doctrineId: 'player-custom-v1',
        priorityRules: existing
          ? current.priorityRules.filter(
              (rule) => rule.territorySlug !== territorySlug,
            )
          : [
              ...current.priorityRules,
              {
                territorySlug,
                priority: 1,
                commitBps: current.defaultCommitBps,
                tactic: current.defaultTactic,
              },
            ],
      };
    });
    setNotice(null);
  };

  const restoreDefault = () => {
    setDraft(clonePolicy(DEFAULT_GRID_OFFLINE_DEFENSE_POLICY));
    setNotice(null);
    setError(null);
  };

  const save = async () => {
    const policy: GridOfflineDefensePolicy = {
      ...draft,
      doctrineId:
        draft.doctrineId === DEFAULT_GRID_OFFLINE_DEFENSE_POLICY.doctrineId
          ? 'player-custom-v1'
          : draft.doctrineId,
      priorityRules: [...draft.priorityRules].sort((a, b) =>
        a.territorySlug.localeCompare(b.territorySlug),
      ),
    };
    const scope = policyScope(policy);

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/grid/offline-defense', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          policy,
          idempotencyKey: commandKey(scope),
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | DefenseResponse
        | null;
      if (!response.ok || !payload?.success || !payload.policy) {
        throw new Error(payload?.error ?? 'Defense doctrine was rejected.');
      }

      clearCommandKey(scope);
      setDraft(clonePolicy(payload.policy));
      setUpdatedAt(payload.updatedAt ?? null);
      setNotice('Defense doctrine saved. Future offline defenses use these rules.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Defense doctrine was rejected.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-20"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(52,211,153,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(52,211,153,.07) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <main className="relative mx-auto max-w-6xl px-4 py-7 sm:px-7">
        <header className="border-b border-white/10 pb-7">
          <Link
            href="/grid/return"
            className="inline-flex items-center gap-2 font-mono text-[10px] font-black tracking-[.18em] text-stone-500 hover:text-emerald-200"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            RETURN BRIEF
          </Link>
          <div className="mt-6 flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-emerald-300">
            <ShieldCheck size={14} aria-hidden="true" />
            PERSISTENT DEFENSE AUTOMATION
          </div>
          <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
            DEFENSE DOCTRINE
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-400 sm:text-base">
            Decide how your territory fights while you are away. These settings
            are read by the same server-side contest engine that resolves live
            attacks.
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
          <section className="flex min-h-[420px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-emerald-200">
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              LOADING DEFENSE DOCTRINE
            </div>
          </section>
        ) : state === 'auth-required' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-8">
            <LockKeyhole size={30} className="text-emerald-300" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <p className="mt-3 max-w-xl text-sm text-stone-400">
              Sign in to configure the defense policy attached to your Grid
              player state.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Sign in
              <ChevronRight size={17} />
            </Link>
          </section>
        ) : state === 'disabled' ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-8">
            <Shield size={30} className="text-stone-600" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Defense controls staged
            </h2>
            <p className="mt-3 max-w-xl text-sm text-stone-400">
              Contest writes are disabled in this environment, so defense
              doctrine cannot be changed yet.
            </p>
          </section>
        ) : state === 'error' ? null : (
          <>
            <section className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                  CURRENT INFLUENCE
                </div>
                <div className="mt-2 font-display text-3xl font-black">
                  {walletInfluence ?? '—'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                  DEFAULT COMMIT CAP
                </div>
                <div className="mt-2 font-display text-3xl font-black text-emerald-100">
                  {defaultCommitCap}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                  LAST POLICY SAVE
                </div>
                <div className="mt-2 text-sm font-semibold text-stone-300">
                  {formatUpdatedAt(updatedAt)}
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/[.035] p-5 sm:p-7">
              <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
                <Gauge size={18} className="text-emerald-300" />
                Global defense rules
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-stone-500">
                Influence is committed into a contest, not automatically burned.
                Contest losses determine what is actually lost.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="text-xs text-stone-400">
                  Reserve Influence
                  <input
                    type="number"
                    min={0}
                    value={draft.reserveInfluence}
                    onChange={(event) =>
                      updatePolicy(
                        'reserveInfluence',
                        integerValue(event.target.value),
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  />
                  <span className="mt-1 block text-[10px] text-stone-600">
                    Maximum pool available to automated defense.
                  </span>
                </label>

                <label className="text-xs text-stone-400">
                  Max commit per contest
                  <input
                    type="number"
                    min={0}
                    value={draft.maxCommitPerContest}
                    onChange={(event) =>
                      updatePolicy(
                        'maxCommitPerContest',
                        integerValue(event.target.value),
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  />
                  <span className="mt-1 block text-[10px] text-stone-600">
                    Hard exposure cap for any one defense.
                  </span>
                </label>

                <label className="text-xs text-stone-400">
                  Default commit %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={Math.floor(draft.defaultCommitBps / 100)}
                    onChange={(event) =>
                      updatePolicy(
                        'defaultCommitBps',
                        percentValue(event.target.value) * 100,
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  />
                  <span className="mt-1 block text-[10px] text-stone-600">
                    Percentage of the available capped reserve to commit.
                  </span>
                </label>

                <label className="text-xs text-stone-400">
                  Retreat at Influence
                  <input
                    type="number"
                    min={0}
                    value={draft.autoRetreatBelowInfluence}
                    onChange={(event) =>
                      updatePolicy(
                        'autoRetreatBelowInfluence',
                        integerValue(event.target.value),
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  />
                  <span className="mt-1 block text-[10px] text-stone-600">
                    Withdraw when the defender is at or below this amount.
                  </span>
                </label>

                <label className="text-xs text-stone-400">
                  Retreat after losses
                  <input
                    type="number"
                    min={0}
                    value={draft.autoRetreatAfterLosses}
                    onChange={(event) =>
                      updatePolicy(
                        'autoRetreatAfterLosses',
                        integerValue(event.target.value),
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  />
                  <span className="mt-1 block text-[10px] text-stone-600">
                    0 disables the cumulative-loss retreat threshold.
                  </span>
                </label>

                <label className="text-xs text-stone-400">
                  Default tactic
                  <select
                    value={draft.defaultTactic}
                    onChange={(event) =>
                      updatePolicy(
                        'defaultTactic',
                        event.target.value as GridContestTactic,
                      )
                    }
                    className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                  >
                    {TACTICS.map((tactic) => (
                      <option key={tactic.value} value={tactic.value}>
                        {tactic.label}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[10px] text-stone-600">
                    Used unless a territory has its own override.
                  </span>
                </label>
              </div>
            </section>

            <section className="mt-5 rounded-3xl border border-white/10 bg-black/45 p-5 sm:p-7">
              <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
                <Swords size={18} className="text-cyan-300" />
                Territory overrides
              </div>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-stone-500">
                Give important territory its own commitment, tactic, and
                priority. Territories without an override use your global
                doctrine.
              </p>

              {ownedTerritories.length === 0 ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-white/[.025] p-4 text-sm text-stone-500">
                  Claim territory before adding territory-specific defense rules.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {ownedTerritories.map((territory) => {
                    const rule = ruleFor(territory.slug);
                    return (
                      <article
                        key={territory.slug}
                        className="rounded-2xl border border-white/10 bg-white/[.025] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="font-display text-lg font-black uppercase">
                              {territory.name}
                            </div>
                            <div className="mt-1 font-mono text-[9px] text-stone-600">
                              {territory.slug}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleRule(territory.slug)}
                            className={
                              'rounded-full border px-3 py-2 font-mono text-[9px] font-black tracking-[.1em] ' +
                              (rule
                                ? 'border-emerald-300/35 bg-emerald-300/[.08] text-emerald-100'
                                : 'border-white/10 text-stone-500')
                            }
                          >
                            {rule ? 'OVERRIDE ON' : 'USE GLOBAL'}
                          </button>
                        </div>

                        {rule ? (
                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <label className="text-xs text-stone-400">
                              Priority
                              <input
                                type="number"
                                min={0}
                                value={rule.priority}
                                onChange={(event) =>
                                  setRule(territory.slug, (current) => ({
                                    ...current,
                                    priority: integerValue(event.target.value),
                                  }))
                                }
                                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                              />
                            </label>
                            <label className="text-xs text-stone-400">
                              Commit %
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={Math.floor(
                                  (rule.commitBps ?? draft.defaultCommitBps) /
                                    100,
                                )}
                                onChange={(event) =>
                                  setRule(territory.slug, (current) => ({
                                    ...current,
                                    commitBps:
                                      percentValue(event.target.value) * 100,
                                  }))
                                }
                                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                              />
                            </label>
                            <label className="text-xs text-stone-400">
                              Tactic
                              <select
                                value={rule.tactic ?? draft.defaultTactic}
                                onChange={(event) =>
                                  setRule(territory.slug, (current) => ({
                                    ...current,
                                    tactic: event.target
                                      .value as GridContestTactic,
                                  }))
                                }
                                className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/55 px-3 text-white"
                              >
                                {TACTICS.map((tactic) => (
                                  <option key={tactic.value} value={tactic.value}>
                                    {tactic.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-5 flex flex-col gap-4 rounded-3xl border border-emerald-300/20 bg-emerald-300/[.04] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  size={20}
                  className="mt-0.5 shrink-0 text-emerald-300"
                />
                <div>
                  <div className="font-display text-lg font-black uppercase">
                    Server-enforced policy
                  </div>
                  <p className="mt-1 max-w-2xl text-xs leading-relaxed text-stone-500">
                    The server derives your player and season identity, validates
                    every policy field, persists it idempotently, and applies it
                    when your territory is attacked.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={restoreDefault}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 font-display text-xs font-black uppercase tracking-[.08em] text-stone-300 disabled:opacity-40"
                >
                  <RotateCcw size={14} />
                  Safe default
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-5 font-display text-xs font-black uppercase tracking-[.08em] text-slate-950 disabled:opacity-40"
                >
                  {busy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  Save doctrine
                </button>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
