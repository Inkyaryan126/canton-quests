'use client';

import { useMemo, useState } from 'react';
import {
  buildGridMapRenderPacket,
  buildGridMapScene,
  resolveGridMapSelection,
} from '@/lib/grid/map';
import type {
  GridMapInteractionTarget,
  GridMapRenderPacket,
  GridMapSelectionDetails,
} from '@/lib/grid/map';
import type { GridWorldProjection } from '@/lib/grid/server/world-projection';

// ── Coordinate helpers (projected SVG canvas) ─────────────────────────────────

const WIDTH = 800;
const HEIGHT = 520;
const PAD = 24;

interface Bounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

function extractCoords(geometry: GeoJSON.MultiPolygon): [number, number][] {
  return geometry.coordinates.flatMap((polygon) =>
    polygon.flatMap((ring) =>
      ring.map((pos) => [pos[0], pos[1]] as [number, number]),
    ),
  );
}

function deriveBounds(
  packet: GridMapRenderPacket,
  fallback: GridWorldProjection['city']['mapCenter'],
): Bounds {
  const coords: [number, number][] = [
    ...packet.territories.features.flatMap((f) => extractCoords(f.geometry)),
    ...packet.districts.features.flatMap((f) => extractCoords(f.geometry)),
  ];
  if (coords.length === 0) {
    const { lng, lat } = fallback;
    return { minLng: lng - 0.01, maxLng: lng + 0.01, minLat: lat - 0.01, maxLat: lat + 0.01 };
  }
  return coords.reduce<Bounds>(
    (b, [lng, lat]) => ({
      minLng: Math.min(b.minLng, lng),
      maxLng: Math.max(b.maxLng, lng),
      minLat: Math.min(b.minLat, lat),
      maxLat: Math.max(b.maxLat, lat),
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

function geometryPath(geometry: GeoJSON.MultiPolygon, bounds: Bounds): string {
  return geometry.coordinates
    .flatMap((polygon) =>
      polygon.map((ring) =>
        ring
          .map(([lng, lat], i) => {
            const [x, y] = projectPoint(lng, lat, bounds);
            return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
          })
          .join(' ') + ' Z',
      ),
    )
    .join(' ');
}

// ── Presentation → CSS ────────────────────────────────────────────────────────

function territoryFillClass(fillRole: string): string {
  if (fillRole === 'controlled-you') return 'fill-cyan-400/35';
  if (fillRole === 'controlled-rival') return 'fill-fuchsia-500/25';
  if (fillRole === 'contested') return 'fill-amber-400/30';
  return 'fill-white/[0.035]';
}

function territoryStrokeClass(borderRole: string): string {
  if (borderRole === 'owned') return 'stroke-cyan-200';
  if (borderRole === 'hostile') return 'stroke-fuchsia-300/80';
  if (borderRole === 'claimable') return 'stroke-amber-200';
  if (borderRole === 'contested') return 'stroke-amber-400';
  return 'stroke-white/20';
}

function territoryStrokeWidth(borderRole: string): number {
  if (borderRole === 'claimable' || borderRole === 'contested') return 3;
  if (borderRole === 'owned') return 2;
  return 1.4;
}

function propertyFillClass(ownership: string): string {
  if (ownership === 'you') return 'fill-cyan-200';
  if (ownership === 'occupied') return 'fill-fuchsia-300';
  return 'fill-amber-200/80';
}

// ── Zoom modes ────────────────────────────────────────────────────────────────

// Zoom values land squarely within each band:
//   city    < 11 → 10
//   district 11–14 → 13
//   property ≥ 15 → 16
const ZOOM_MODES = [
  { label: 'City', zoom: 10 },
  { label: 'District', zoom: 13 },
  { label: 'Property', zoom: 16 },
] as const;

// ── Selection detail panel ────────────────────────────────────────────────────

function SelectionDetail({ selection }: { selection: GridMapSelectionDetails }) {
  if (selection.kind === 'district') {
    return (
      <div>
        <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-500">DISTRICT</div>
        <div className="mt-1 font-display text-lg font-black uppercase">{selection.slug}</div>
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-stone-400">
          <span>{selection.territoryCount} territories</span>
          {selection.yourTerritories > 0 && (
            <span className="text-cyan-300">{selection.yourTerritories} yours</span>
          )}
          {selection.occupiedTerritories > 0 && (
            <span className="text-fuchsia-300">{selection.occupiedTerritories} rival</span>
          )}
          {selection.contestedTerritories > 0 && (
            <span className="text-amber-300">{selection.contestedTerritories} contested</span>
          )}
          <span className="text-stone-500">{selection.neutralTerritories} neutral</span>
        </div>
      </div>
    );
  }

  if (selection.kind === 'territory') {
    return (
      <div>
        <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-500">TERRITORY</div>
        <div className="mt-1 font-display text-lg font-black uppercase">{selection.name}</div>
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-stone-400">
          <span className="text-stone-500">{selection.districtSlug}</span>
          {selection.claimable && <span className="text-amber-300">CLAIMABLE</span>}
          {selection.contested && <span className="text-orange-300">CONTESTED</span>}
          {selection.propertyCount > 0 && (
            <span>
              {selection.propertyCount} props ({selection.developedPropertyCount} developed)
            </span>
          )}
          {selection.totalDevelopmentLevel > 0 && (
            <span>L{selection.totalDevelopmentLevel} total</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="font-mono text-[9px] font-black tracking-[.14em] text-stone-500">PROPERTY</div>
      <div className="mt-1 font-display text-lg font-black uppercase">{selection.name}</div>
      <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-stone-400">
        <span className="capitalize">{selection.ownership}</span>
        {selection.developmentLevel > 0 && (
          <>
            <span>{selection.developmentBranch}</span>
            <span>L{selection.developmentLevel}</span>
          </>
        )}
        <span className="text-stone-500">{selection.conditionBand}</span>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface GridCityMapProps {
  projection: GridWorldProjection;
}

export function GridCityMap({ projection }: GridCityMapProps) {
  const [zoom, setZoom] = useState(10);
  const [selectedTarget, setSelectedTarget] = useState<GridMapInteractionTarget | null>(null);

  const packet = useMemo(
    () => buildGridMapRenderPacket(buildGridMapScene(projection, { zoom })),
    [projection, zoom],
  );

  const selection = useMemo<GridMapSelectionDetails | null>(
    () => (selectedTarget ? resolveGridMapSelection(packet, selectedTarget) : null),
    [packet, selectedTarget],
  );

  const bounds = useMemo(
    () => deriveBounds(packet, projection.city.mapCenter),
    [packet, projection.city.mapCenter],
  );

  // Lookup map for interaction targets by kind+slug
  const targetMap = useMemo(() => {
    const m = new Map<string, GridMapInteractionTarget>();
    for (const t of packet.interactionTargets) {
      m.set(`${t.kind}:${t.slug}`, t);
    }
    return m;
  }, [packet.interactionTargets]);

  function handleTarget(target: GridMapInteractionTarget) {
    setSelectedTarget((prev) =>
      prev?.slug === target.slug && prev.kind === target.kind ? null : target,
    );
  }

  function handleKeyDown(
    event: React.KeyboardEvent,
    target: GridMapInteractionTarget,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleTarget(target);
    }
  }

  const isSelected = (kind: string, slug: string) =>
    selectedTarget?.slug === slug && selectedTarget.kind === kind;

  return (
    <div className="space-y-3">
      {/* Zoom mode controls */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Map zoom level"
      >
        {ZOOM_MODES.map(({ label, zoom: z }) => (
          <button
            key={z}
            type="button"
            onClick={() => {
              setZoom(z);
              setSelectedTarget(null);
            }}
            aria-pressed={zoom === z}
            className={`rounded-lg border px-3 py-1.5 font-mono text-[10px] font-black tracking-[.12em] motion-safe:transition-colors ${
              zoom === z
                ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200'
                : 'border-white/15 bg-black/20 text-stone-400 hover:border-white/30 hover:text-stone-200'
            }`}
          >
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {/* SVG map — aspect-ratio locks height so mobile never needs horizontal scroll */}
      <div
        className="relative w-full overflow-hidden rounded-xl bg-[#060b10]"
        style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      >
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-full w-full"
          role="img"
          aria-label="The Grid Canton territory map"
        >
          <rect width={WIDTH} height={HEIGHT} className="fill-[#060b10]" />

          {/* District outlines — always rendered for geographic context */}
          {packet.districts.features.map((feature) => {
            const p = feature.properties;
            const target = targetMap.get(`district:${p.slug}`);
            const selected = isSelected('district', p.slug);
            return (
              <path
                key={`district-${p.slug}`}
                d={geometryPath(feature.geometry, bounds)}
                fillRule="evenodd"
                className={`stroke-white/10 motion-safe:transition-opacity ${
                  packet.zoomBand === 'city'
                    ? 'fill-white/[0.02] cursor-pointer'
                    : 'fill-transparent'
                } ${selected ? 'opacity-100' : 'hover:opacity-80'} outline-none focus-visible:opacity-100`}
                strokeWidth={0.8}
                tabIndex={packet.zoomBand === 'city' && target ? 0 : -1}
                role={packet.zoomBand === 'city' && target ? 'button' : undefined}
                aria-pressed={
                  packet.zoomBand === 'city' && selected ? true : undefined
                }
                aria-label={
                  packet.zoomBand === 'city'
                    ? `${p.slug} district — ${p.controlRole}`
                    : undefined
                }
                onClick={
                  packet.zoomBand === 'city' && target
                    ? () => handleTarget(target)
                    : undefined
                }
                onKeyDown={
                  packet.zoomBand === 'city' && target
                    ? (e) => handleKeyDown(e, target)
                    : undefined
                }
              >
                {packet.zoomBand === 'city' && (
                  <title>
                    {p.slug} district — {p.controlRole}
                  </title>
                )}
              </path>
            );
          })}

          {/* Territory polygons */}
          {packet.territories.features.map((feature) => {
            const p = feature.properties;
            const target = targetMap.get(`territory:${p.slug}`);
            const selected = isSelected('territory', p.slug);
            return (
              <path
                key={`territory-${p.slug}`}
                d={geometryPath(feature.geometry, bounds)}
                fillRule="evenodd"
                className={`${territoryFillClass(p.fillRole)} ${territoryStrokeClass(p.borderRole)} cursor-pointer motion-safe:transition-opacity ${selected ? 'opacity-100' : 'hover:opacity-80'} outline-none focus-visible:opacity-100`}
                strokeWidth={territoryStrokeWidth(p.borderRole)}
                tabIndex={target ? 0 : -1}
                role={target ? 'button' : undefined}
                aria-pressed={selected ? true : undefined}
                aria-label={`${p.name} territory — ${p.districtSlug} district`}
                onClick={() => target && handleTarget(target)}
                onKeyDown={(e) => target && handleKeyDown(e, target)}
              >
                <title>
                  {p.name} — {p.districtSlug}
                  {p.claimable ? ' — valid expansion' : ''}
                  {p.contested ? ' — contested' : ''}
                </title>
              </path>
            );
          })}

          {/* Property markers */}
          {packet.properties.features.map((feature) => {
            const p = feature.properties;
            const target = targetMap.get(`property:${p.slug}`);
            const selected = isSelected('property', p.slug);
            const geo = feature.geometry;
            const coords =
              geo.type === 'Point'
                ? geo.coordinates
                : null;
            if (!coords) return null;
            const [cx, cy] = projectPoint(coords[0], coords[1], bounds);
            return (
              <circle
                key={`property-${p.slug}`}
                cx={cx}
                cy={cy}
                r={p.developmentLevel > 0 ? 7 : 4.5}
                className={`${propertyFillClass(p.ownership)} stroke-black cursor-pointer motion-safe:transition-opacity ${selected ? 'opacity-100' : 'hover:opacity-80'} outline-none focus-visible:opacity-100`}
                strokeWidth={2}
                tabIndex={target ? 0 : -1}
                role={target ? 'button' : undefined}
                aria-pressed={selected ? true : undefined}
                aria-label={`${p.name} property — ${p.ownership}`}
                onClick={() => target && handleTarget(target)}
                onKeyDown={(e) => target && handleKeyDown(e, target)}
              >
                <title>
                  {p.name}
                  {p.developmentLevel > 0
                    ? ` — ${p.developmentBranch} L${p.developmentLevel}`
                    : ''}
                </title>
              </circle>
            );
          })}
        </svg>
      </div>

      {/* Selected item detail */}
      {selection && (
        <div
          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm"
          aria-live="polite"
          aria-atomic="true"
        >
          <SelectionDetail selection={selection} />
        </div>
      )}

      {/* Accessible text/list fallback — all map information without relying on SVG */}
      <details className="rounded-xl border border-white/[.06] bg-black/20">
        <summary className="cursor-pointer select-none px-4 py-2.5 font-mono text-[10px] font-black tracking-[.14em] text-stone-600 hover:text-stone-400">
          MAP FALLBACK LIST ({packet.interactionTargets.length} TARGETS)
        </summary>
        <ul
          className="max-h-64 overflow-y-auto px-4 pb-3 pt-1 text-xs text-stone-400"
          aria-label="Map interaction targets list"
        >
          {packet.interactionTargets.map((target) => {
            const details = resolveGridMapSelection(packet, target);
            if (!details) return null;
            const label =
              details.kind === 'territory'
                ? details.name
                : details.kind === 'property'
                  ? details.name
                  : details.slug;
            const badge =
              details.kind === 'territory' && details.claimable
                ? 'CLAIMABLE'
                : details.kind === 'territory' && details.contested
                  ? 'CONTESTED'
                  : details.kind === 'property'
                    ? details.ownership.toUpperCase()
                    : details.kind === 'district'
                      ? details.controlRole.toUpperCase()
                      : '';
            return (
              <li
                key={`${target.kind}:${target.slug}`}
                className="flex items-baseline justify-between gap-2 border-b border-white/[.04] py-1.5 last:border-0"
              >
                <button
                  type="button"
                  className="text-left hover:text-white focus-visible:text-white focus-visible:outline-none"
                  onClick={() => handleTarget(target)}
                >
                  <span className="font-mono text-[9px] uppercase text-stone-600">
                    {target.kind}
                  </span>{' '}
                  {label}
                </button>
                {badge && (
                  <span className="shrink-0 font-mono text-[9px] text-stone-600">
                    {badge}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
