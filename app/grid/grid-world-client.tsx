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
  Users,
  Zap,
} from 'lucide-react';
import type { GridWorldProjection } from '@/lib/grid/server/world-projection';

interface GridWorldResponse {
  projection: GridWorldProjection;
  runtimeEnabled: boolean;
  economyWriteEnabled: boolean;
  runtimeWarning: string | null;
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
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadWorld = useCallback(async () => {
    const response = await fetch('/api/grid/world', { cache: 'no-store' });
    if (!response.ok) throw new Error('Grid world feed unavailable');
    const data = (await response.json()) as GridWorldResponse;
    setProjection(data.projection);
    setRuntimeEnabled(data.runtimeEnabled);
    setEconomyWriteEnabled(data.economyWriteEnabled);
    setRuntimeWarning(data.runtimeWarning);
  }, []);

  useEffect(() => {
    void loadWorld().catch((error) => {
      setRuntimeWarning(
        error instanceof Error ? error.message : 'Grid world feed unavailable',
      );
    });
  }, [loadWorld]);

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

  const bounds = useMemo(() => getBounds(projection), [projection]);
  const wallet = projection.player.wallet;
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
              ) : (
                <p className="mt-3 text-sm leading-relaxed text-stone-400">
                  {projection.player.authenticated
                    ? 'Your Canton Quests identity is recognized, but you have not joined an activated Grid season.'
                    : 'Sign in to Canton Quests to attach your player identity when the Grid runtime opens.'}
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

            <div className="rounded-3xl border border-white/10 bg-black/45 p-5">
              <div className="flex items-center gap-2 font-display text-lg font-black uppercase">
                <Building2 size={18} className="text-cyan-300" />
                Property Layer
              </div>
              <div className="mt-3 space-y-2">
                {projection.properties.slice(0, 8).map((property) => (
                  <div key={property.slug} className="flex items-center justify-between gap-3 border-b border-white/[.06] py-2 text-xs">
                    <span className="truncate text-stone-300">{property.name}</span>
                    <span className="font-mono text-[9px] text-stone-500">
                      {property.developmentLevel > 0
                        ? `${property.developmentBranch?.toUpperCase()} L${property.developmentLevel}`
                        : property.ownership.toUpperCase()}
                    </span>
                  </div>
                ))}
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
