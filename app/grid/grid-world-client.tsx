'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Coins,
  Crosshair,
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
  runtimeWarning: string | null;
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
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/grid/world', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Grid world feed unavailable');
        return (await response.json()) as GridWorldResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setProjection(data.projection);
        setRuntimeEnabled(data.runtimeEnabled);
        setRuntimeWarning(data.runtimeWarning);
      })
      .catch((error) => {
        if (!cancelled) setRuntimeWarning(error instanceof Error ? error.message : 'Grid world feed unavailable');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const bounds = useMemo(() => getBounds(projection), [projection]);
  const wallet = projection.player.wallet;
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
                  SOURCE-BACKED POLYGONS // READ-ONLY PROJECTION
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
                Starter territories are highlighted now. Once a player owns territory, valid expansion shifts to neutral zones touching their controlled network.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[.05] p-3 font-mono text-[10px] text-amber-100">
                <Zap size={14} />
                {projection.validClaimSlugs.length > 0
                  ? `${projection.validClaimSlugs.length} VALID CLAIM TARGETS`
                  : 'NO ACTIVE CLAIM COMMANDS ON THIS SCREEN'}
              </div>
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
                Read-Only Safety
              </div>
              <p className="mt-3 text-xs leading-relaxed text-stone-400">
                This screen can read world state only. Claims, purchases, upgrades, and future contests remain server-authoritative commands with their own guarded transaction paths.
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
