'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft, Check, ChevronRight, Coins, Loader2, LockKeyhole,
  MapPinned, Radio, ShieldCheck, Sparkles, Zap,
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  ordinal: number;
  title: string;
  lesson: string;
  complete: boolean;
  available: boolean;
}

interface OnboardingProjection {
  complete: boolean;
  completedCount: number;
  totalSteps: number;
  nextStep: OnboardingStep | null;
  readyForFullCityUnlock: boolean;
  invariantViolations: string[];
  steps: OnboardingStep[];
}

interface StarterOption {
  territoryId: string;
  slug: string;
  name: string;
  districtSlug: string;
  baseValue: number;
  cost: { credits: number; commandPoints: number };
  affordable: boolean;
}

interface StarterProjection {
  state:
    | 'season-unavailable'
    | 'join-required'
    | 'choose-starter'
    | 'starter-claim-complete'
    | 'no-starters-available';
  availableCount: number;
  unavailableCount: number;
  options: StarterOption[];
}

interface OnboardingResponse {
  success: boolean;
  onboarding?: OnboardingProjection;
  error?: string;
}

interface StarterResponse {
  success: boolean;
  starterTerritories?: StarterProjection;
  error?: string;
}

function commandKey(scope: string): string {
  const storageKey = 'grid:onboarding:' + scope + ':idempotency';
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const next = window.crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, next);
  return next;
}

function clearCommandKey(scope: string): void {
  window.sessionStorage.removeItem('grid:onboarding:' + scope + ':idempotency');
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function ActionButton(props: {
  busy: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={props.busy}
      onClick={props.onClick}
      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/35 bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {props.busy ? (
        <Loader2 size={17} className="animate-spin" aria-hidden="true" />
      ) : (
        <ChevronRight size={17} aria-hidden="true" />
      )}
      {props.children}
    </button>
  );
}

function stepCardClass(step: OnboardingStep): string {
  if (step.complete) {
    return 'rounded-2xl border border-emerald-400/25 bg-emerald-400/[.05] p-4';
  }
  if (step.available) {
    return 'rounded-2xl border border-cyan-300/30 bg-cyan-300/[.05] p-4';
  }
  return 'rounded-2xl border border-white/10 bg-white/[.02] p-4';
}

function stepNumberClass(step: OnboardingStep): string {
  const base =
    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-black ';
  if (step.complete) return base + 'border-emerald-300/50 text-emerald-200';
  if (step.available) return base + 'border-cyan-300/50 text-cyan-200';
  return base + 'border-white/10 text-stone-600';
}

export default function GridOnboardingClient() {
  const [onboarding, setOnboarding] =
    useState<OnboardingProjection | null>(null);
  const [starters, setStarters] = useState<StarterProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const loadState = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResponse, starterResponse] = await Promise.all([
        fetch('/api/grid/onboarding/status', { cache: 'no-store' }),
        fetch('/api/grid/onboarding/starter-territories', {
          cache: 'no-store',
        }),
      ]);

      if (statusResponse.status === 401 || starterResponse.status === 401) {
        setAuthRequired(true);
        setOnboarding(null);
        setStarters(null);
        return;
      }

      const status = await readJson<OnboardingResponse>(statusResponse);
      const starter = await readJson<StarterResponse>(starterResponse);
      if (!statusResponse.ok || !status.success || !status.onboarding) {
        throw new Error(status.error ?? 'Grid onboarding is unavailable.');
      }
      if (
        !starterResponse.ok ||
        !starter.success ||
        !starter.starterTerritories
      ) {
        throw new Error(
          starter.error ?? 'Starter territory feed is unavailable.',
        );
      }

      setAuthRequired(false);
      setOnboarding(status.onboarding);
      setStarters(starter.starterTerritories);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Grid onboarding unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const postAction = useCallback(
    async (
      name: string,
      url: string,
      body?: Record<string, unknown>,
      idempotencyScope?: string,
    ) => {
      setBusyAction(name);
      setError(null);
      setNotice(null);
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: body ? { 'content-type': 'application/json' } : undefined,
          body: body ? JSON.stringify(body) : undefined,
        });
        const payload = await readJson<{ success: boolean; error?: string }>(
          response,
        );
        if (!response.ok || !payload.success) {
          if (response.status === 404) {
            throw new Error('This onboarding step is staged but not open yet.');
          }
          throw new Error(payload.error ?? 'Grid command failed.');
        }

        if (idempotencyScope) clearCommandKey(idempotencyScope);
        setNotice('Grid state updated.');
        await loadState();
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : 'Grid command failed.',
        );
      } finally {
        setBusyAction(null);
      }
    },
    [loadState],
  );

  const nextStep = onboarding?.nextStep ?? null;
  const progress = onboarding
    ? Math.round((onboarding.completedCount / onboarding.totalSteps) * 100)
    : 0;

  const confirmHomeCity = () =>
    void postAction('home-city', '/api/grid/onboarding/home-city');

  const joinSeason = () => {
    const scope = 'join-season';
    void postAction(
      'join-season',
      '/api/grid/onboarding/join',
      { idempotencyKey: commandKey(scope) },
      scope,
    );
  };

  const claimStarter = (territoryId: string) => {
    const scope = 'starter-claim:' + territoryId;
    void postAction(
      scope,
      '/api/grid/onboarding/starter-territories/claim',
      {
        territoryId,
        idempotencyKey: commandKey(scope),
      },
      scope,
    );
  };

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
                CANTON, OHIO // CITY 001 // FIRST SESSION
              </div>
              <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
                ENTER THE GRID
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-400 sm:text-base">
                Establish your city identity, enter the Founding Season, and
                secure your first foothold on the real Canton board.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[.05] px-5 py-4">
              <div className="font-mono text-[10px] font-black tracking-[.18em] text-stone-500">
                FIRST-SESSION PROGRESS
              </div>
              <div className="mt-2 font-display text-3xl font-black text-cyan-100">
                {onboarding
                  ? onboarding.completedCount + '/' + onboarding.totalSteps
                  : '—'}
              </div>
            </div>
          </div>
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

        {loading ? (
          <section className="flex min-h-[420px] items-center justify-center">
            <div className="flex items-center gap-3 font-mono text-xs font-black tracking-[.15em] text-cyan-200">
              <Loader2 className="animate-spin" size={18} aria-hidden="true" />
              SYNCING CITY STATE
            </div>
          </section>
        ) : authRequired ? (
          <section className="mt-8 rounded-3xl border border-white/10 bg-black/45 p-7 sm:p-10">
            <LockKeyhole size={30} className="text-cyan-300" aria-hidden="true" />
            <h2 className="mt-5 font-display text-3xl font-black uppercase">
              Player authentication required
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
              Sign in with your Canton Quests player account before entering
              the persistent city.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 font-display text-sm font-black uppercase tracking-[.08em] text-slate-950"
            >
              Sign in
              <ChevronRight size={17} aria-hidden="true" />
            </Link>
          </section>
        ) : onboarding && starters ? (
          <>
            <section className="mt-7 rounded-3xl border border-white/10 bg-black/45 p-5 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-mono text-[10px] font-black tracking-[.18em] text-stone-500">
                    FOUNDATION SEQUENCE
                  </div>
                  <div className="mt-1 text-sm text-stone-400">
                    Claim → build → earn → contest → expand
                  </div>
                </div>
                <div className="font-display text-2xl font-black text-cyan-200">
                  {progress}%
                </div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-cyan-300 transition-[width]"
                  style={{ width: String(progress) + '%' }}
                />
              </div>

              <ol className="mt-6 grid gap-3 md:grid-cols-3">
                {onboarding.steps.map((step) => (
                  <li key={step.id} className={stepCardClass(step)}>
                    <div className="flex items-center gap-3">
                      <div className={stepNumberClass(step)}>
                        {step.complete ? <Check size={15} /> : step.ordinal}
                      </div>
                      <div className="font-display text-sm font-black uppercase">
                        {step.title}
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-stone-500">
                      {step.lesson}
                    </p>
                  </li>
                ))}
              </ol>
            </section>

            <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="rounded-3xl border border-cyan-300/20 bg-cyan-300/[.045] p-6 sm:p-8">
                <div className="flex items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
                  <Zap size={13} aria-hidden="true" />
                  NEXT DIRECTIVE
                </div>

                {onboarding.complete ? (
                  <>
                    <h2 className="mt-4 font-display text-4xl font-black uppercase">
                      Foundation complete
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                      Your first-session sequence is complete. The persistent
                      city can now become your primary game board.
                    </p>
                  </>
                ) : nextStep?.id === 'confirm-home-city' ? (
                  <>
                    <h2 className="mt-4 font-display text-4xl font-black uppercase">
                      Confirm Canton
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                      Set Canton, Ohio as your Home City. Onboarding will never
                      silently replace a different Home City.
                    </p>
                    <div className="mt-6">
                      <ActionButton
                        busy={busyAction === 'home-city'}
                        onClick={confirmHomeCity}
                      >
                        Confirm Canton
                      </ActionButton>
                    </div>
                  </>
                ) : nextStep?.id === 'join-season' ? (
                  <>
                    <h2 className="mt-4 font-display text-4xl font-black uppercase">
                      Enter the Founding Season
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                      Create your seasonal wallet and initialize the resources
                      that power claims, building, and contests.
                    </p>
                    <div className="mt-6">
                      <ActionButton
                        busy={busyAction === 'join-season'}
                        onClick={joinSeason}
                      >
                        Join season
                      </ActionButton>
                    </div>
                  </>
                ) : nextStep?.id === 'select-starter-territory' ||
                  nextStep?.id === 'claim-first-territory' ? (
                  <>
                    <h2 className="mt-4 font-display text-4xl font-black uppercase">
                      Choose your foothold
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                      Only configured neutral starter territory is shown here.
                      Rival identity stays private.
                    </p>

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {starters.options.map((territory) => {
                        const scope =
                          'starter-claim:' + territory.territoryId;
                        return (
                          <article
                            key={territory.territoryId}
                            className="rounded-2xl border border-white/10 bg-black/35 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-display text-lg font-black uppercase">
                                  {territory.name}
                                </div>
                                <div className="mt-1 font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                                  {territory.districtSlug.toUpperCase()}
                                </div>
                              </div>
                              <MapPinned
                                size={18}
                                className="text-cyan-300"
                                aria-hidden="true"
                              />
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px]">
                              <span className="rounded-full border border-amber-300/20 px-2.5 py-1 text-amber-100">
                                {territory.cost.credits} CR
                              </span>
                              <span className="rounded-full border border-cyan-300/20 px-2.5 py-1 text-cyan-100">
                                {territory.cost.commandPoints} CP
                              </span>
                            </div>

                            <button
                              type="button"
                              disabled={
                                !territory.affordable ||
                                busyAction !== null
                              }
                              onClick={() =>
                                claimStarter(territory.territoryId)
                              }
                              className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/[.08] px-3 py-2 font-display text-xs font-black uppercase tracking-[.08em] text-cyan-100 transition hover:bg-cyan-300/[.14] disabled:cursor-not-allowed disabled:opacity-35"
                            >
                              {busyAction === scope ? (
                                <Loader2
                                  size={14}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              ) : null}
                              {territory.affordable
                                ? 'Claim starter'
                                : 'Resources required'}
                            </button>
                          </article>
                        );
                      })}
                    </div>

                    {starters.options.length === 0 ? (
                      <p className="mt-5 text-sm text-amber-100">
                        No neutral starter territory is currently available.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <h2 className="mt-4 font-display text-4xl font-black uppercase">
                      {nextStep?.title ?? 'Stand by'}
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-400">
                      {nextStep?.lesson ??
                        'Your next Grid system is not available in this staged client yet.'}
                    </p>
                    <div className="mt-6 rounded-xl border border-amber-300/20 bg-amber-300/[.05] px-4 py-3 text-xs leading-relaxed text-amber-100">
                      This step remains server-controlled and will activate
                      here when its gameplay command is integrated.
                    </div>
                  </>
                )}
              </div>

              <aside className="space-y-4">
                <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                  <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                    <ShieldCheck size={18} className="text-emerald-300" />
                    Server authority
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-500">
                    Identity, city, season, command time, costs, ownership, and
                    claim legality are resolved on the server. The browser
                    never receives mutation authority.
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                  <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                    <Coins size={18} className="text-amber-300" />
                    Starter availability
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-white/[.035] p-3">
                      <div className="font-display text-2xl font-black">
                        {starters.availableCount}
                      </div>
                      <div className="mt-1 font-mono text-[9px] text-stone-600">
                        AVAILABLE
                      </div>
                    </div>
                    <div className="rounded-xl bg-white/[.035] p-3">
                      <div className="font-display text-2xl font-black">
                        {starters.unavailableCount}
                      </div>
                      <div className="mt-1 font-mono text-[9px] text-stone-600">
                        OCCUPIED
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
                  <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                    <Sparkles size={18} className="text-cyan-300" />
                    Persistent city
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-stone-500">
                    Your progress persists. When you return, The Grid can show
                    what changed while you were away.
                  </p>
                </div>
              </aside>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
