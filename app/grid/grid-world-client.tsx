'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Coins,
  Crosshair,
  Loader2,
  MapPinned,
  Radio,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import type { GridDevelopmentBranch } from '@/lib/grid/core/economy-types';
import {
  GRID_REVISION_HIDDEN_POLL_MS,
  normalizeGridRevisionPollMs,
} from '@/lib/grid/client/world-revision-polling';
import type { GridWorldProjection } from '@/lib/grid/server/world-projection';
import type { GridDynamicEventWorldProjection } from '@/lib/grid/server/dynamic-event-world';
import type { GridNpcStrongholdWorldProjection } from '@/lib/grid/server/npc-stronghold-world';
import type { GridProgressionSnapshot, GridStatDefinition } from '@/lib/grid/core/progression-types';

interface GridWorldResponse {
  projection: GridWorldProjection;
  dynamicEvents: GridDynamicEventWorldProjection[];
  strongholds: GridNpcStrongholdWorldProjection[];
  runtimeEnabled: boolean;
  economyWriteEnabled: boolean;
  contestWriteEnabled: boolean;
  runtimeWarning: string | null;
}

interface GridProgressionResponse {
  authenticated: boolean;
  season: GridProgressionSnapshot | null;
  lifetime: GridProgressionSnapshot | null;
  statCatalog: GridStatDefinition[];
  warning: string | null;
}

interface GridTerritoryClaimResponse {
  success: boolean;
  claim?: {
    territorySlug: string;
    claimMode: 'starter' | 'adjacent';
    claimedAt: string;
    creditsSpent: number;
    commandPointsSpent: number;
    credits: number;
    influence: number;
    commandPoints: number;
  };
  error?: string;
}

interface GridPropertyActionResponse {
  success: boolean;
  property?: {
    propertySlug: string;
    creditsSpent: number;
    commandPointsSpent: number;
    credits: number;
    influence: number;
    commandPoints: number;
    developmentBranch?: GridDevelopmentBranch;
    developmentLevel?: number;
    skylineFormed?: boolean;
  };
  error?: string;
}

interface GridContestLaunchResponse {
  success: boolean;
  contest?: {
    outcome: 'contest-started' | 'captured-by-auto-retreat';
    contestId?: string;
    sourceTerritorySlug: string;
    targetTerritorySlug: string;
    attackerCommittedInfluence?: number;
    defenderCommittedInfluence?: number;
    status?: string;
    startedAt?: string;
    capturedAt?: string;
  };
  error?: string;
}

interface GridContestRoundResponse {
  success: boolean;
  contest?: {
    contestId: string;
    roundNumber: number;
    status: string;
    attackerRolls: number[];
    defenderRolls: number[];
    attackerRemainingInfluence: number;
    defenderRemainingInfluence: number;
    territoryCaptured: boolean;
  };
  error?: string;
}

interface GridIncomeCollectResponse {
  success: boolean;
  income?: {
    credits: number;
    influence: number;
    commandPoints: number;
    resourcesSettledAt: string;
  };
  error?: string;
}

function humanizeWait(milliseconds: number): string {
  if (milliseconds <= 0) return 'ready now';
  const seconds = Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function commandKey(scope: string): string {
  const storageKey = 'grid:world-command:' + scope;
  const existing = window.sessionStorage.getItem(storageKey);
  if (existing) return existing;
  const key = 'grid-world:' + scope + ':' + crypto.randomUUID();
  window.sessionStorage.setItem(storageKey, key);
  return key;
}

function clearCommandKey(scope: string): void {
  window.sessionStorage.removeItem('grid:world-command:' + scope);
}

interface Bounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

const WIDTH = 1000;
const HEIGHT = 650;
const PAD = 30;

export function surgeStatusPresentation(
  timing: GridWorldProjection['season']['surgeTiming'],
): { label: string; detail: string } {
  if (timing.state === 'unavailable' || timing.millisecondsRemaining === null) {
    return { label: 'SURGE', detail: 'TIMING UNAVAILABLE' };
  }
  if (timing.state === 'finished') {
    return { label: 'SURGE FINISHED', detail: 'SURGE COMPLETE' };
  }

  const totalHours = Math.floor(Math.max(0, timing.millisecondsRemaining) / 3_600_000);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const remaining = days > 0 ? `${days}D ${hours}H` : `${hours}H`;

  return timing.state === 'live'
    ? { label: 'SURGE LIVE', detail: `${remaining} REMAINING` }
    : { label: 'SURGE UPCOMING', detail: `${remaining} UNTIL SURGE` };
}

function allCoordinates(geometry?: GeoJSON.MultiPolygon): [number, number][] {
  if (!geometry) return [];
  return geometry.coordinates.flatMap((polygon) =>
    polygon.flatMap((ring) =>
      ring.map((position) => [position[0], position[1]] as [number, number]),
    ),
  );
}

function getBounds(projection: GridWorldProjection): Bounds {
  const coordinates = projection.territories.flatMap((territory) =>
    allCoordinates(territory.geometry),
  );
  if (coordinates.length === 0) {
    const { lng, lat } = projection.city.mapCenter;
    return { minLng: lng - 0.01, maxLng: lng + 0.01, minLat: lat - 0.01, maxLat: lat + 0.01 };
  }

  return coordinates.reduce<Bounds>(
    (bounds, [lng, lat]) => ({
      minLng: Math.min(bounds.minLng, lng),
      maxLng: Math.max(bounds.maxLng, lng),
      minLat: Math.min(bounds.minLat, lat),
      maxLat: Math.max(bounds.maxLat, lat),
    }),
    { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity },
  );
}

function projectPoint(lng: number, lat: number, bounds: Bounds): [number, number] {
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, 0.000001);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, 0.000001);
  const x = PAD + ((lng - bounds.minLng) / lngSpan) * (WIDTH - PAD * 2);
  const y = PAD + ((bounds.maxLat - lat) / latSpan) * (HEIGHT - PAD * 2);
  return [x, y];
}

function geometryPath(geometry: GeoJSON.MultiPolygon | undefined, bounds: Bounds): string {
  if (!geometry) return '';
  return geometry.coordinates
    .flatMap((polygon) =>
      polygon.map((ring) =>
        ring
          .map(([lng, lat], index) => {
            const [x, y] = projectPoint(lng, lat, bounds);
            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ') + ' Z',
      ),
    )
    .join(' ');
}

function territoryClass(
  ownership: GridWorldProjection['territories'][number]['ownership'],
  claimable: boolean,
  starterEligible: boolean,
): string {
  if (ownership === 'you') return 'fill-cyan-400/35 stroke-cyan-200';
  if (ownership === 'occupied') return 'fill-fuchsia-500/25 stroke-fuchsia-300/80';
  if (claimable) return 'fill-amber-300/25 stroke-amber-200';
  if (starterEligible) return 'fill-emerald-400/15 stroke-emerald-300/70';
  return 'fill-white/[0.035] stroke-white/20';
}

function StatCard({
  label,
  value,
  note,
}: {
  label: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
      <div className="font-mono text-[10px] font-black tracking-[.18em] text-stone-500">{label}</div>
      <div className="mt-2 font-display text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-xs text-stone-500">{note}</div>
    </div>
  );
}

export default function GridWorldClient({
  initialProjection,
}: {
  initialProjection: GridWorldProjection;
}) {
  const [projection, setProjection] = useState(initialProjection);
  const [runtimeEnabled, setRuntimeEnabled] = useState(false);
  const [economyWriteEnabled, setEconomyWriteEnabled] = useState(false);
  const [contestWriteEnabled, setContestWriteEnabled] = useState(false);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const [dynamicEvents, setDynamicEvents] = useState<GridDynamicEventWorldProjection[]>([]);
  const [strongholds, setStrongholds] = useState<GridNpcStrongholdWorldProjection[]>([]);
  const [progression, setProgression] = useState<GridProgressionSnapshot | null>(null);
  const [progressionCatalogCount, setProgressionCatalogCount] = useState(0);
  const [progressionWarning, setProgressionWarning] = useState<string | null>(null);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);
  const [busyPropertyAction, setBusyPropertyAction] = useState<string | null>(null);
  const [busyContestAction, setBusyContestAction] = useState<string | null>(null);
  const [busyIncome, setBusyIncome] = useState(false);
  const [clockMs, setClockMs] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadWorld = useCallback(async () => {
    const response = await fetch('/api/grid/world', { cache: 'no-store' });
    if (!response.ok) throw new Error('Grid world feed unavailable');
    const data = (await response.json()) as GridWorldResponse;
    setProjection(data.projection);
    setDynamicEvents(data.dynamicEvents ?? []);
    setStrongholds(data.strongholds ?? []);
    setRuntimeEnabled(data.runtimeEnabled);
    setEconomyWriteEnabled(data.economyWriteEnabled);
    setContestWriteEnabled(data.contestWriteEnabled);
    setRuntimeWarning(data.runtimeWarning);
  }, []);

  useEffect(() => {
    void loadWorld().catch((error) => {
      setRuntimeWarning(
        error instanceof Error ? error.message : 'Grid world feed unavailable',
      );
    });
  }, [loadWorld]);

  useEffect(() => {
    setClockMs(Date.now());
    const timer = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/grid/progression', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Grid progression feed unavailable');
        return (await response.json()) as GridProgressionResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setProgression(data.season ?? data.lifetime);
        setProgressionCatalogCount(data.statCatalog.length);
        setProgressionWarning(data.warning);
      })
      .catch((error) => {
        if (!cancelled) {
          setProgressionWarning(
            error instanceof Error ? error.message : 'Grid progression feed unavailable',
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtimeEnabled || !projection.player.authenticated) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let revisionEtag: string | null = null;

    const schedule = (delayMs: number) => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void pollRevision();
      }, delayMs);
    };

    const pollRevision = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'hidden') {
        schedule(GRID_REVISION_HIDDEN_POLL_MS);
        return;
      }

      try {
        const response = await fetch('/api/grid/world/revision', {
          cache: 'no-store',
          headers: revisionEtag ? { 'If-None-Match': revisionEtag } : undefined,
        });
        if (cancelled) return;
        if (response.status === 401 || response.status === 404) return;

        const pollAfterMs = normalizeGridRevisionPollMs(
          response.headers.get('x-grid-poll-after-ms'),
        );
        if (response.status === 304) {
          schedule(pollAfterMs);
          return;
        }
        if (!response.ok) throw new Error('Grid world revision unavailable');

        const nextEtag = response.headers.get('etag');
        const needsWorldRefresh =
          revisionEtag === null || nextEtag === null || nextEtag !== revisionEtag;
        revisionEtag = nextEtag;

        if (needsWorldRefresh) await loadWorld();
        schedule(pollAfterMs);
      } catch {
        schedule(GRID_REVISION_HIDDEN_POLL_MS);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      if (timer) clearTimeout(timer);
      void pollRevision();
    };

    void pollRevision();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadWorld, projection.player.authenticated, runtimeEnabled]);

  const claimTerritory = async (territorySlug: string) => {
    const scope = 'claim:' + territorySlug;
    setBusyClaim(territorySlug);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await fetch('/api/grid/territories/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          territorySlug,
          idempotencyKey: commandKey(scope),
        }),
      });
      const payload = (await response.json()) as GridTerritoryClaimResponse;
      if (!response.ok || !payload.success || !payload.claim) {
        if (response.status === 404) {
          throw new Error('City expansion is not enabled yet.');
        }
        throw new Error(payload.error ?? 'Territory claim failed.');
      }

      clearCommandKey(scope);
      setActionNotice(
        'Territory claimed. Spent ' +
          payload.claim.creditsSpent +
          ' Credits and ' +
          payload.claim.commandPointsSpent +
          ' Command.',
      );
      await loadWorld();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Territory claim failed.',
      );
    } finally {
      setBusyClaim(null);
    }
  };

  const acquireProperty = async (propertySlug: string) => {
    const scope = 'property-acquire:' + propertySlug;
    setBusyPropertyAction(scope);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await fetch('/api/grid/properties/acquire', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertySlug,
          idempotencyKey: commandKey(scope),
        }),
      });
      const payload = (await response.json()) as GridPropertyActionResponse;
      if (!response.ok || !payload.success || !payload.property) {
        if (response.status === 404) {
          throw new Error('Property economy actions are not enabled yet.');
        }
        throw new Error(payload.error ?? 'Property acquisition failed.');
      }

      clearCommandKey(scope);
      setActionNotice(
        'Property acquired. Spent ' +
          payload.property.creditsSpent +
          ' Credits and ' +
          payload.property.commandPointsSpent +
          ' Command.',
      );
      await loadWorld();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Property acquisition failed.',
      );
    } finally {
      setBusyPropertyAction(null);
    }
  };

  const developProperty = async (
    propertySlug: string,
    branch: GridDevelopmentBranch,
  ) => {
    const scope = 'property-develop:' + propertySlug + ':' + branch;
    setBusyPropertyAction(scope);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await fetch('/api/grid/properties/develop', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          propertySlug,
          branch,
          idempotencyKey: commandKey(scope),
        }),
      });
      const payload = (await response.json()) as GridPropertyActionResponse;
      if (!response.ok || !payload.success || !payload.property) {
        if (response.status === 404) {
          throw new Error('Property economy actions are not enabled yet.');
        }
        throw new Error(payload.error ?? 'Property development failed.');
      }

      clearCommandKey(scope);
      setActionNotice(
        'Property developed to level ' +
          String(payload.property.developmentLevel ?? '?') +
          (payload.property.skylineFormed ? ' — Skyline formed.' : '.'),
      );
      await loadWorld();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Property development failed.',
      );
    } finally {
      setBusyPropertyAction(null);
    }
  };

  const collectIncome = async () => {
    const scope = 'income-collect';
    setBusyIncome(true);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await fetch('/api/grid/income/collect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idempotencyKey: commandKey(scope) }),
      });
      const payload = (await response.json()) as GridIncomeCollectResponse;
      if (!response.ok || !payload.success || !payload.income) {
        if (response.status === 404) {
          throw new Error('Grid economy writes are not enabled yet.');
        }
        throw new Error(payload.error ?? 'Income collection failed.');
      }

      clearCommandKey(scope);
      setActionNotice('Production collected into your Grid wallet.');
      await loadWorld();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Income collection failed.',
      );
    } finally {
      setBusyIncome(false);
    }
  };

  const launchContest = async (
    sourceTerritorySlug: string,
    targetTerritorySlug: string,
    attackerCommittedInfluence: number,
  ) => {
    const scope =
      'contest-launch:' +
      sourceTerritorySlug +
      ':' +
      targetTerritorySlug +
      ':' +
      attackerCommittedInfluence;
    setBusyContestAction(scope);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await fetch('/api/grid/contests/launch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceTerritorySlug,
          targetTerritorySlug,
          attackerCommittedInfluence,
          idempotencyKey: commandKey(scope),
        }),
      });
      const payload = (await response.json()) as GridContestLaunchResponse;
      if (!response.ok || !payload.success || !payload.contest) {
        if (response.status === 404) {
          throw new Error('Grid contests are not enabled yet.');
        }
        throw new Error(payload.error ?? 'Contest launch failed.');
      }

      clearCommandKey(scope);
      setActionNotice(
        payload.contest.outcome === 'captured-by-auto-retreat'
          ? 'Target captured after the defender auto-retreated.'
          : 'Contest started. Roll Signal Dice to resolve the next round.',
      );
      await loadWorld();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Contest launch failed.',
      );
    } finally {
      setBusyContestAction(null);
    }
  };

  const resolveContestRound = async (
    contestId: string,
    nextRoundNumber: number,
  ) => {
    const scope = 'contest-round:' + contestId + ':' + nextRoundNumber;
    setBusyContestAction(scope);
    setActionError(null);
    setActionNotice(null);

    try {
      const response = await fetch(
        '/api/grid/contests/' + contestId + '/round',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ idempotencyKey: commandKey(scope) }),
        },
      );
      const payload = (await response.json()) as GridContestRoundResponse;
      if (!response.ok || !payload.success || !payload.contest) {
        if (response.status === 404) {
          throw new Error('Grid contests are not enabled yet.');
        }
        throw new Error(payload.error ?? 'Contest round failed.');
      }

      clearCommandKey(scope);
      setActionNotice(
        'Signal Dice: ' +
          payload.contest.attackerRolls.join(', ') +
          ' vs ' +
          payload.contest.defenderRolls.join(', ') +
          '. Contest status: ' +
          payload.contest.status +
          '.',
      );
      await loadWorld();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Contest round failed.',
      );
    } finally {
      setBusyContestAction(null);
    }
  };

  const bounds = useMemo(() => getBounds(projection), [projection]);
  const wallet = projection.player.wallet;
  const income = projection.player.income;
  const incomeReady = Boolean(
    income &&
      (income.pendingCredits > 0 ||
        income.pendingInfluence > 0 ||
        (income.collectibleAt && clockMs >= Date.parse(income.collectibleAt))),
  );
  const incomeWaitMs =
    income?.collectibleAt
      ? Math.max(0, Date.parse(income.collectibleAt) - clockMs)
      : 0;
  const surgeStatus = surgeStatusPresentation(projection.season.surgeTiming);
  const sourceLabel =
    projection.source === 'database'
      ? 'LIVE READ'
      : runtimeEnabled
        ? 'PACKAGE PREVIEW // RUNTIME EMPTY'
        : 'PACKAGE PREVIEW // RUNTIME LOCKED';

  return (
    <div className="min-h-screen bg-[#05080c] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-25"
        aria-hidden="true"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,.08) 1px, transparent 1px)',
          backgroundSize: '34px 34px',
        }}
      />

      <main className="relative mx-auto max-w-7xl px-4 py-7 sm:px-7">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] font-black tracking-[.2em] text-cyan-300">
              <Radio size={13} className="animate-pulse" />
              THE GRID // {projection.city.name.toUpperCase()} CITY 001 // {sourceLabel}
            </div>
            <h1 className="mt-3 font-display text-5xl font-black uppercase tracking-tight sm:text-7xl">
              CITY BOARD
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-stone-400 sm:text-base">
              Real Canton geography. Territory control, property development, and Skyline state are projected here without giving the browser any mutation authority.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[.05] px-4 py-3 font-mono text-xs">
            <div className="text-stone-500">SEASON</div>
            <div className="mt-1 font-black text-cyan-200">{projection.season.name.toUpperCase()}</div>
            <div className="mt-1 text-[10px] text-stone-500">{projection.season.status.toUpperCase()}</div>
            <div className="mt-3 border-t border-cyan-400/15 pt-3">
              <div className="font-black text-cyan-200">{surgeStatus.label}</div>
              <div className="mt-1 text-[10px] text-stone-400">{surgeStatus.detail}</div>
            </div>
          </div>
        </header>

        {runtimeWarning ? (
          <div className="mt-5 rounded-xl border border-amber-400/25 bg-amber-400/[.06] px-4 py-3 text-xs text-amber-100">
            Runtime read warning: {runtimeWarning}. Showing the verified compiled Canton package instead.
          </div>
        ) : null}
        {actionError ? (
          <div className="mt-5 rounded-xl border border-rose-400/25 bg-rose-400/[.07] px-4 py-3 text-sm text-rose-100">
            {actionError}
          </div>
        ) : null}
        {actionNotice ? (
          <div className="mt-5 rounded-xl border border-emerald-400/25 bg-emerald-400/[.07] px-4 py-3 text-sm text-emerald-100">
            {actionNotice}
          </div>
        ) : null}

        {dynamicEvents.length > 0 || strongholds.length > 0 ? (
          <section className="mt-6 rounded-3xl border border-cyan-400/15 bg-cyan-400/[.035] p-4 sm:p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                  <Radio size={17} className="text-cyan-300" />
                  Live Operations
                </div>
                <div className="mt-1 font-mono text-[9px] tracking-[.14em] text-stone-500">
                  ACTIVE CITY EFFECTS // NPC PRESSURE // SERVER VERIFIED
                </div>
              </div>
              <div className="font-mono text-[9px] text-stone-500">
                {dynamicEvents.length} EVENT{dynamicEvents.length === 1 ? '' : 'S'}{' // '}{strongholds.length} STRONGHOLD{strongholds.length === 1 ? '' : 'S'}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {dynamicEvents.map((event) => (
                <div
                  key={event.instanceId}
                  className="rounded-2xl border border-cyan-300/15 bg-black/35 p-4"
                >
                  <div className="font-mono text-[9px] font-black tracking-[.14em] text-cyan-300">
                    DYNAMIC EVENT
                  </div>
                  <div className="mt-2 font-display text-lg font-black uppercase text-white">
                    {event.kind.replaceAll('-', ' ')}
                  </div>
                  <div className="mt-2 text-xs text-stone-400">
                    {event.target.entities.map((entity) => entity.name).join(' · ')}
                  </div>
                  <div className="mt-3 font-mono text-[9px] text-stone-500">
                    {clockMs > 0
                      ? humanizeWait(Date.parse(event.endsAt) - clockMs).toUpperCase() + ' REMAINING'
                      : 'SYNCING EVENT CLOCK'}
                  </div>
                </div>
              ))}

              {strongholds.map((stronghold) => (
                <div
                  key={stronghold.strongholdId}
                  className="rounded-2xl border border-fuchsia-300/15 bg-black/35 p-4"
                >
                  <div className="flex items-center gap-2 font-mono text-[9px] font-black tracking-[.14em] text-fuchsia-300">
                    <ShieldCheck size={13} />
                    NPC STRONGHOLD
                  </div>
                  <div className="mt-2 font-display text-lg font-black uppercase text-white">
                    {stronghold.target.kind === 'pve-landmark'
                      ? stronghold.target.landmark.name
                      : stronghold.target.territoryName}
                  </div>
                  <div className="mt-2 text-xs text-stone-400">
                    {stronghold.status.toUpperCase()}{' // '}{stronghold.factionId}
                  </div>
                  <div className="mt-3 font-mono text-[9px] text-stone-500">
                    GARRISON {stronghold.garrisonInfluence} INFLUENCE
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="TERRITORIES" value={projection.counts.territories} note={`${projection.counts.occupiedTerritories} occupied`} />
          <StatCard label="PROPERTIES" value={projection.counts.properties} note={`${projection.counts.occupiedProperties} occupied`} />
          <StatCard label="DISTRICTS" value={projection.counts.districts} note="compiled Canton zones" />
          <StatCard label="VALID EXPANSIONS" value={projection.validClaimSlugs.length} note={projection.player.joined ? 'for your current position' : 'join required'} />
          <StatCard label="YOUR SKYLINES" value={projection.yourSkylines.length} note="qualified connected builds" />
        </section>

        <section className="mt-6 grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-3xl border border-cyan-400/20 bg-black/55">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <div className="flex items-center gap-2 font-display text-xl font-black uppercase">
                  <MapPinned size={18} className="text-cyan-300" />
                  Canton Territory Layer
                </div>
                <div className="mt-1 font-mono text-[10px] text-stone-500">
                  SOURCE-BACKED POLYGONS // SERVER-AUTHORITATIVE COMMANDS
                </div>
              </div>
              <div className="flex flex-wrap gap-3 font-mono text-[9px] text-stone-400">
                <span>CYAN: YOU</span>
                <span>MAGENTA: OCCUPIED</span>
                <span>AMBER: CLAIMABLE</span>
                <span>GREEN: STARTER</span>
              </div>
            </div>

            <div className="relative aspect-[1000/650] min-h-[420px] w-full bg-[#060b10] p-2">
              <svg
                  viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                  className="h-full w-full"
                  role="img"
                  aria-label="The Grid Canton territory map"
                >
                  <rect width={WIDTH} height={HEIGHT} className="fill-[#060b10]" />
                  {projection.territories.map((territory) => (
                    <path
                      key={territory.slug}
                      d={geometryPath(territory.geometry, bounds)}
                      fillRule="evenodd"
                      className={`${territoryClass(territory.ownership, territory.claimable, territory.starterEligible)} transition-opacity hover:opacity-80`}
                      strokeWidth={territory.claimable ? 3 : 1.4}
                    >
                      <title>{territory.name} — {territory.ownership}{territory.claimable ? ' — valid expansion' : ''}</title>
                    </path>
                  ))}
                {projection.properties.map((property) => {
                    if (!property.point) return null;
                    const [x, y] = projectPoint(property.point.lng, property.point.lat, bounds);
                    return (
                      <circle
                        key={property.slug}
                        cx={x}
                        cy={y}
                        r={property.developmentLevel > 0 ? 7 : 4.5}
                        className={
                          property.ownership === 'you'
                            ? 'fill-cyan-200 stroke-black'
                            : property.ownership === 'occupied'
                              ? 'fill-fuchsia-300 stroke-black'
                                : 'fill-amber-200/80 stroke-black'
                        }
                        strokeWidth={2}
                      >
                        <title>
                          {property.name}
                          {property.developmentLevel > 0
                            ? ` — ${property.developmentBranch} L${property.developmentLevel}`
                            : ''}
                        </title>
                      </circle>
                    );
                  })}
              </svg>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <Coins size={18} className="text-amber-300" />
                Player Economy
              </div>
              {wallet ? (
                <>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white/[.04] p-3 text-center">
                      <div className="font-display text-xl font-black">{wallet.credits}</div>
                      <div className="mt-1 font-mono text-[9px] text-stone-500">CREDITS</div>
                    </div>
                    <div className="rounded-xl bg-white/[.04] p-3 text-center">
                      <div className="font-display text-xl font-black">{wallet.influence}</div>
                      <div className="mt-1 font-mono text-[9px] text-stone-500">INFLUENCE</div>
                    </div>
                    <div className="rounded-xl bg-white/[.04] p-3 text-center">
                      <div className="font-display text-xl font-black">{wallet.commandPoints}</div>
                      <div className="mt-1 font-mono text-[9px] text-stone-500">COMMAND</div>
                    </div>
                  </div>

                  {income ? (
                    <div className="mt-4 rounded-xl border border-amber-300/15 bg-amber-300/[.035] p-3">
                      <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                        LIVE PRODUCTION
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-black/25 p-2.5">
                          <div className="font-display text-lg font-black text-amber-100">
                            +{income.pendingCredits}
                          </div>
                          <div className="mt-1 font-mono text-[8px] text-stone-500">
                            CREDITS · {income.creditsPerHour}/HR
                          </div>
                        </div>
                        <div className="rounded-lg bg-black/25 p-2.5">
                          <div className="font-display text-lg font-black text-cyan-100">
                            +{income.pendingInfluence}
                          </div>
                          <div className="mt-1 font-mono text-[8px] text-stone-500">
                            INFLUENCE · {income.influencePerHour}/HR
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={
                          !economyWriteEnabled ||
                          !incomeReady ||
                          busyIncome
                        }
                        onClick={() => void collectIncome()}
                        className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[.08] px-3 py-2 font-display text-[11px] font-black uppercase tracking-[.08em] text-amber-100 transition hover:bg-amber-300/[.14] disabled:cursor-not-allowed disabled:opacity-35"
                      >
                        {busyIncome ? (
                          <Loader2
                            size={13}
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : null}
                        {!economyWriteEnabled
                          ? 'Economy actions locked'
                          : incomeReady
                            ? 'Collect production'
                            : income.collectibleAt
                              ? `Ready in ${humanizeWait(incomeWaitMs)}`
                              : 'No production available'}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-stone-400">
                  {projection.player.authenticated
                    ? 'Your Canton Quests identity is recognized, but you have not joined an activated Grid season.'
                    : 'Sign in to Canton Quests to attach your player identity when the Grid runtime opens.'}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-fuchsia-400/20 bg-fuchsia-400/[.04] p-5">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <Trophy size={18} className="text-fuchsia-300" />
                Grid Rank Profile
              </div>
              {progression ? (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-white/[.04] p-3 text-center">
                      <div className="font-display text-2xl font-black">{progression.gridRating}</div>
                      <div className="mt-1 font-mono text-[9px] text-stone-500">GRID RATING</div>
                    </div>
                    <div className="rounded-xl bg-white/[.04] p-3 text-center">
                      <div className="font-display text-2xl font-black">{progression.level}</div>
                      <div className="mt-1 font-mono text-[9px] text-stone-500">LEVEL</div>
                    </div>
                  </div>
                  <div className="mt-3 font-mono text-[10px] text-fuchsia-200">
                    {progression.primaryTitle ?? 'NO TITLE EARNED YET'}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[9px] text-stone-500">
                    {Object.entries(progression.categoryScores).map(([category, score]) => (
                      <div key={category} className="flex justify-between gap-2">
                        <span>{category.toUpperCase()}</span>
                        <span className="text-stone-300">{score}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-stone-400">
                  {progressionWarning
                    ? 'The ranking engine is built, but its database snapshot is not activated on this environment yet.'
                    : `${progressionCatalogCount || 47} tracked stats are armed across missions, discovery, territory, property, scrimmage, teamwork, and legacy play.`}
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <Crosshair size={18} className="text-amber-300" />
                Expansion
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                Neutral blocks touching your controlled network are valid expansion targets. Costs and adjacency are rechecked atomically on the server when you claim.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-3 font-mono text-[10px] text-amber-100">
                <Zap size={14} />
                {projection.validClaimSlugs.length > 0
                  ? `${projection.validClaimSlugs.length} VALID CLAIM TARGETS`
                  : 'NO VALID EXPANSION TARGETS'}
              </div>
              {projection.validClaimSlugs.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {projection.territories
                    .filter((territory) => territory.claimable)
                    .map((territory) => {
                      const affordable = Boolean(
                        wallet &&
                          wallet.credits >= territory.claimCost.credits &&
                          wallet.commandPoints >= territory.claimCost.commandPoints,
                      );
                      return (
                        <div
                          key={territory.slug}
                          className="rounded-xl border border-white/10 bg-white/[.025] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs font-black text-stone-200">
                                {territory.name}
                              </div>
                              <div className="mt-1 font-mono text-[9px] text-stone-600">
                                {territory.districtSlug.toUpperCase()}
                              </div>
                            </div>
                            <div className="text-right font-mono text-[9px] text-amber-100">
                              {territory.claimCost.credits} CR
                              <br />
                              {territory.claimCost.commandPoints} CP
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={
                              !economyWriteEnabled ||
                              !affordable ||
                              busyClaim !== null
                            }
                            onClick={() => void claimTerritory(territory.slug)}
                            className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-amber-300/25 bg-amber-300/[.08] px-3 py-2 font-display text-[11px] font-black uppercase tracking-[.08em] text-amber-100 transition hover:bg-amber-300/[.14] disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {busyClaim === territory.slug ? (
                              <Loader2
                                size={13}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : null}
                            {!economyWriteEnabled
                              ? 'Expansion locked'
                              : affordable
                                ? 'Claim territory'
                                : 'Resources required'}
                          </button>
                        </div>
                      );
                    })}
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-fuchsia-300/20 bg-black/45 p-5">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <Crosshair size={18} className="text-fuchsia-300" />
                Contests
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                Attack only occupied territory touching your network. Signal Dice,
                defender policy, adjacency, ownership, and final capture remain
                server-authoritative.
              </p>

              {projection.player.activeContests.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                    ACTIVE CONTESTS
                  </div>
                  {projection.player.activeContests.map((contest) => {
                    const nextRound = contest.roundNumber + 1;
                    const roundScope =
                      'contest-round:' + contest.contestId + ':' + nextRound;
                    return (
                      <div
                        key={contest.contestId}
                        className="rounded-xl border border-fuchsia-300/15 bg-fuchsia-300/[.035] p-3"
                      >
                        <div className="text-xs font-black text-stone-200">
                          {contest.sourceTerritorySlug} →{' '}
                          {contest.targetTerritorySlug}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[9px] text-stone-500">
                          <span>YOU: {contest.yourRemainingInfluence} INF</span>
                          <span>
                            OPPONENT: {contest.opponentRemainingInfluence} INF
                          </span>
                          <span>ROUND {contest.roundNumber}</span>
                          <span>{contest.role.toUpperCase()}</span>
                        </div>
                        {contest.role === 'attacker' ? (
                          <button
                            type="button"
                            disabled={
                              !contestWriteEnabled ||
                              busyContestAction !== null
                            }
                            onClick={() =>
                              void resolveContestRound(
                                contest.contestId,
                                nextRound,
                              )
                            }
                            className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-fuchsia-300/25 bg-fuchsia-300/[.08] px-3 py-2 font-display text-[11px] font-black uppercase tracking-[.08em] text-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {busyContestAction === roundScope ? (
                              <Loader2
                                size={13}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : null}
                            {contestWriteEnabled
                              ? 'Roll next round'
                              : 'Contests locked'}
                          </button>
                        ) : (
                          <div className="mt-3 rounded-lg border border-white/10 bg-white/[.02] px-3 py-2 font-mono text-[9px] text-stone-500">
                            DEFENDER // ATTACKER ROLLS NEXT ROUND
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}

              {projection.territories.some((territory) => territory.attackable) ? (
                <div className="mt-4 space-y-3">
                  <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-600">
                    ATTACKABLE TARGETS
                  </div>
                  {projection.territories
                    .filter((territory) => territory.attackable)
                    .map((territory) => (
                      <div
                        key={territory.slug}
                        className="rounded-xl border border-white/10 bg-white/[.025] p-3"
                      >
                        <div className="text-xs font-black text-stone-200">
                          {territory.name}
                        </div>
                        <div className="mt-1 font-mono text-[9px] text-stone-600">
                          {territory.districtSlug.toUpperCase()}
                        </div>
                        {territory.attackSourceSlugs.map((sourceSlug) => (
                          <div
                            key={sourceSlug}
                            className="mt-3 border-t border-white/[.06] pt-3"
                          >
                            <div className="font-mono text-[9px] text-stone-500">
                              ATTACK FROM {sourceSlug.toUpperCase()}
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2">
                              {projection.player.attackCommitOptions.map(
                                (option) => {
                                  const scope =
                                    'contest-launch:' +
                                    sourceSlug +
                                    ':' +
                                    territory.slug +
                                    ':' +
                                    option.influence;
                                  return (
                                    <button
                                      key={option.influence}
                                      type="button"
                                      disabled={
                                        !contestWriteEnabled ||
                                        !option.affordable ||
                                        busyContestAction !== null
                                      }
                                      onClick={() =>
                                        void launchContest(
                                          sourceSlug,
                                          territory.slug,
                                          option.influence,
                                        )
                                      }
                                      className="rounded-lg border border-fuchsia-300/20 bg-fuchsia-300/[.055] px-2 py-2 text-center disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                      {busyContestAction === scope ? (
                                        <Loader2
                                          size={12}
                                          className="mx-auto animate-spin"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <>
                                          <span className="block font-display text-[11px] font-black text-fuchsia-100">
                                            {option.influence} INF
                                          </span>
                                          <span className="mt-1 block font-mono text-[8px] text-stone-500">
                                            {option.dice} DIE
                                            {option.dice === 1 ? '' : 'S'}
                                          </span>
                                        </>
                                      )}
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              ) : projection.player.activeContests.length === 0 ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-white/[.02] px-3 py-3 text-xs text-stone-500">
                  No adjacent occupied territory is currently attackable.
                </div>
              ) : null}
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <Building2 size={18} className="text-cyan-300" />
                Property Actions
              </div>
              <p className="mt-3 text-sm leading-relaxed text-stone-400">
                Property actions appear only inside territory you control.
                Acquisition and every upgrade are revalidated atomically on the server.
              </p>
              <div className="mt-4 space-y-3">
                {projection.properties
                  .filter(
                    (property) =>
                      property.acquirable || property.ownership === 'you',
                  )
                  .map((property) => (
                    <div
                      key={property.slug}
                      className="rounded-xl border border-white/10 bg-white/[.025] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-black text-stone-200">
                            {property.name}
                          </div>
                          <div className="mt-1 font-mono text-[9px] text-stone-600">
                            {property.territorySlug.toUpperCase()}
                          </div>
                        </div>
                        <div className="font-mono text-[9px] text-cyan-100">
                          {property.developmentLevel > 0
                            ? `${property.developmentBranch?.toUpperCase()} L${property.developmentLevel}`
                            : property.ownership === 'you'
                              ? 'OWNED'
                              : 'AVAILABLE'}
                        </div>
                      </div>

                      {property.acquirable ? (
                        <>
                          <div className="mt-3 font-mono text-[9px] text-stone-500">
                            ACQUIRE · {property.acquisitionCost.credits} CR ·{' '}
                            {property.acquisitionCost.commandPoints} CP
                          </div>
                          <button
                            type="button"
                            disabled={
                              !economyWriteEnabled ||
                              !property.affordableToAcquire ||
                              busyPropertyAction !== null
                            }
                            onClick={() => void acquireProperty(property.slug)}
                            className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/[.08] px-3 py-2 font-display text-[11px] font-black uppercase tracking-[.08em] text-cyan-100 transition hover:bg-cyan-300/[.14] disabled:cursor-not-allowed disabled:opacity-35"
                          >
                            {busyPropertyAction ===
                            'property-acquire:' + property.slug ? (
                              <Loader2
                                size={13}
                                className="animate-spin"
                                aria-hidden="true"
                              />
                            ) : null}
                            {!economyWriteEnabled
                              ? 'Property actions locked'
                              : property.affordableToAcquire
                                ? 'Acquire property'
                                : 'Resources required'}
                          </button>
                        </>
                      ) : null}

                      {property.ownership === 'you' ? (
                        property.developmentOptions.length > 0 ? (
                          <div className="mt-3 grid gap-2">
                            {property.developmentOptions.map((option) => {
                              const actionKey =
                                'property-develop:' +
                                property.slug +
                                ':' +
                                option.branch;
                              return (
                                <button
                                  key={option.branch}
                                  type="button"
                                  disabled={
                                    !economyWriteEnabled ||
                                    !option.affordable ||
                                    busyPropertyAction !== null
                                  }
                                  onClick={() =>
                                    void developProperty(
                                      property.slug,
                                      option.branch,
                                    )
                                  }
                                  className="rounded-lg border border-cyan-300/20 bg-cyan-300/[.055] p-2.5 text-left disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  <span className="font-display text-[11px] font-black uppercase text-cyan-100">
                                    {option.branch} · Level {option.level}
                                  </span>
                                  <span className="mt-1 block font-mono text-[9px] text-stone-500">
                                    {option.cost.credits} CR ·{' '}
                                    {option.cost.commandPoints} CP
                                  </span>
                                  {busyPropertyAction === actionKey ? (
                                    <Loader2
                                      size={12}
                                      className="mt-2 animate-spin"
                                      aria-hidden="true"
                                    />
                                  ) : null}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-3 rounded-lg border border-white/10 bg-white/[.02] px-3 py-2 font-mono text-[9px] text-stone-500">
                            NO FURTHER UPGRADE AVAILABLE
                          </div>
                        )
                      ) : null}
                    </div>
                  ))}
                {projection.properties.every(
                  (property) =>
                    !property.acquirable && property.ownership !== 'you',
                ) ? (
                  <div className="rounded-xl border border-white/10 bg-white/[.02] px-3 py-3 text-xs text-stone-500">
                    Control territory containing a property to unlock acquisition and development here.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[.04] p-5">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <ShieldCheck size={18} className="text-emerald-300" />
                Server Authority
              </div>
              <p className="mt-3 text-xs leading-relaxed text-stone-400">
                The board can request guarded actions, but identity, season, database IDs, costs, adjacency, ownership, and final legality are resolved on the server.
              </p>
            </div>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <Users size={18} className="text-fuchsia-300" />
            <div className="mt-3 font-display font-black uppercase">Ownership Without Doxxing</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Rival territory is exposed as occupied, not as another player&apos;s raw database identity.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <Sparkles size={18} className="text-amber-300" />
            <div className="mt-3 font-display font-black uppercase">Skyline Ready</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Connected developed properties are projected through the deterministic Skyline engine.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <Radio size={18} className="text-cyan-300" />
            <div className="mt-3 font-display font-black uppercase">Activation Separate</div>
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Building this world view does not activate the Grid economy or apply any production migration.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
