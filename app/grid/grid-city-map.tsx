'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  buildGridMapLabelPlan,
  buildGridMapRenderPacket,
  buildGridMapScene,
  resolveGridMapSelection,
  toggleGridMapSelection,
} from '@/lib/grid/map';
import type {
  GridMapInteractionTarget,
  GridMapRenderPacket,
  GridMapSelectionDetails,
} from '@/lib/grid/map';
import type { GridDevelopmentBranch } from '@/lib/grid/core/economy-types';
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

export function propertyMarkerRadii(developmentLevel: number): {
  visual: number;
  hit: number;
} {
  const visual = developmentLevel > 0 ? 7 : 4.5;
  return { visual, hit: Math.max(10, visual * 2) };
}

// ── Selection detail panel ────────────────────────────────────────────────────

interface GridCityMapProps {
  projection: GridWorldProjection;
  economyWriteEnabled?: boolean;
  busyClaim?: string | null;
  busyPropertyAction?: string | null;
  onClaimTerritory?: (territorySlug: string) => void;
  onAcquireProperty?: (propertySlug: string) => void;
  onDevelopProperty?: (
    propertySlug: string,
    branch: GridDevelopmentBranch,
  ) => void;
}

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

export function GridCityMap({
  projection,
  economyWriteEnabled = false,
  busyClaim = null,
  busyPropertyAction = null,
  onClaimTerritory,
  onAcquireProperty,
  onDevelopProperty,
}: GridCityMapProps) {
  const [zoom, setZoom] = useState(10);
  const [selectedTarget, setSelectedTarget] = useState<GridMapInteractionTarget | null>(null);

  const packet = useMemo(
    () => buildGridMapRenderPacket(buildGridMapScene(projection, { zoom })),
    [projection, zoom],
  );
  const labels = useMemo(() => buildGridMapLabelPlan(packet), [packet]);

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
    setSelectedTarget((prev) => toggleGridMapSelection(prev, target));
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

  useEffect(() => {
    if (
      selectedTarget &&
      !targetMap.has(`${selectedTarget.kind}:${selectedTarget.slug}`)
    ) {
      setSelectedTarget(null);
    }
  }, [selectedTarget, targetMap]);

  const selectedTerritory =
    selection?.kind === 'territory'
      ? projection.territories.find((row) => row.slug === selection.slug)
      : null;
  const selectedProperty =
    selection?.kind === 'property'
      ? projection.properties.find((row) => row.slug === selection.slug)
      : null;

  const clearSelection = () => setSelectedTarget(null);

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
                } ${selected ? 'opacity-100 stroke-cyan-200' : 'hover:opacity-80'} outline-none focus-visible:opacity-100`}
                strokeWidth={0.8}
                data-selected={selected ? 'true' : undefined}
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
                    {`${p.slug} district — ${p.controlRole}`}
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
                className={`${territoryFillClass(p.fillRole)} ${territoryStrokeClass(p.borderRole)} cursor-pointer motion-safe:transition-opacity ${selected ? 'opacity-100 stroke-white' : 'hover:opacity-80'} outline-none focus-visible:opacity-100`}
                strokeWidth={selected ? territoryStrokeWidth(p.borderRole) + 2 : territoryStrokeWidth(p.borderRole)}
                data-selected={selected ? 'true' : undefined}
                tabIndex={target ? 0 : -1}
                role={target ? 'button' : undefined}
                aria-pressed={selected ? true : undefined}
                aria-label={`${p.name} territory — ${p.districtSlug} district`}
                onClick={() => target && handleTarget(target)}
                onKeyDown={(e) => target && handleKeyDown(e, target)}
              >
                <title>
                  {`${p.name} — ${p.districtSlug}${p.claimable ? ' — valid expansion' : ''}${p.contested ? ' — contested' : ''}`}
                </title>
              </path>
            );
          })}

          {/* Labels remain visible at the current zoom band, while tooltips stay
              available on each interactive shape for assistive technology. */}
          {labels.map((label) => {
            const [x, y] = projectPoint(label.anchor.lng, label.anchor.lat, bounds);
            return (
              <text
                key={`label-${label.kind}-${label.slug}`}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(230, 250, 255, 0.82)"
                fontSize="10"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                pointerEvents="none"
              >
                {label.text}
              </text>
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
            const radii = propertyMarkerRadii(p.developmentLevel);
            return (
              <g key={`property-${p.slug}`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={radii.hit}
                  fill="transparent"
                  stroke="transparent"
                  tabIndex={target ? 0 : -1}
                  role={target ? 'button' : undefined}
                  aria-pressed={selected ? true : undefined}
                  aria-label={`${p.name} property — ${p.ownership}`}
                  onClick={() => target && handleTarget(target)}
                  onKeyDown={(e) => target && handleKeyDown(e, target)}
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={radii.visual}
                  className={`${propertyFillClass(p.ownership)} stroke-black pointer-events-none motion-safe:transition-opacity ${selected ? 'opacity-100 stroke-white' : 'opacity-90'}`}
                  strokeWidth={selected ? 3.5 : 2}
                  data-selected={selected ? 'true' : undefined}
                >
                  <title>
                    {`${p.name}${p.developmentLevel > 0
                      ? ` — ${p.developmentBranch} L${p.developmentLevel}`
                      : ''}`}
                  </title>
                </circle>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected item detail */}
      {selection ? (
        <div
          className="rounded-xl border border-cyan-300/25 bg-cyan-300/[.06] px-4 py-3 text-sm"
          aria-live="polite"
          aria-atomic="true"
        >
          <SelectionDetail selection={selection} />
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[.08] pt-3">
            {selectedTerritory?.claimable && onClaimTerritory ? (
              <button
                type="button"
                disabled={!economyWriteEnabled || busyClaim !== null}
                onClick={() => onClaimTerritory(selectedTerritory.slug)}
                className="min-h-9 rounded-lg border border-amber-300/25 bg-amber-300/[.08] px-3 py-2 font-display text-[11px] font-black uppercase tracking-[.08em] text-amber-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {busyClaim === selectedTerritory.slug
                  ? 'Claiming…'
                  : !economyWriteEnabled
                    ? 'Expansion locked'
                    : `Claim · ${selectedTerritory.claimCost.credits} CR · ${selectedTerritory.claimCost.commandPoints} CP`}
              </button>
            ) : null}
            {selectedProperty?.acquirable && onAcquireProperty ? (
              <button
                type="button"
                disabled={!economyWriteEnabled || !selectedProperty.affordableToAcquire || busyPropertyAction !== null}
                onClick={() => onAcquireProperty(selectedProperty.slug)}
                className="min-h-9 rounded-lg border border-cyan-300/25 bg-cyan-300/[.08] px-3 py-2 font-display text-[11px] font-black uppercase tracking-[.08em] text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
              >
                {!economyWriteEnabled
                  ? 'Property actions locked'
                  : selectedProperty.affordableToAcquire
                    ? `Acquire · ${selectedProperty.acquisitionCost.credits} CR · ${selectedProperty.acquisitionCost.commandPoints} CP`
                    : 'Resources required'}
              </button>
            ) : null}
            {selectedProperty?.ownership === 'you' && onDevelopProperty
              ? selectedProperty.developmentOptions.map((option) => {
                  const actionKey = `property-develop:${selectedProperty.slug}:${option.branch}`;
                  return (
                    <button
                      key={option.branch}
                      type="button"
                      disabled={!economyWriteEnabled || !option.affordable || busyPropertyAction !== null}
                      onClick={() => onDevelopProperty(selectedProperty.slug, option.branch)}
                      className="min-h-9 rounded-lg border border-cyan-300/20 bg-cyan-300/[.055] px-3 py-2 text-left font-display text-[11px] font-black uppercase tracking-[.05em] text-cyan-100 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      {busyPropertyAction === actionKey
                        ? 'Developing…'
                        : `${option.branch} · L${option.level} · ${option.cost.credits} CR · ${option.cost.commandPoints} CP`}
                    </button>
                  );
                })
              : null}
            <button
              type="button"
              onClick={clearSelection}
              className="min-h-9 rounded-lg border border-white/15 px-3 py-2 font-mono text-[10px] font-black uppercase tracking-[.1em] text-stone-300 hover:border-white/30 hover:text-white focus-visible:outline-none"
            >
              Clear selection
            </button>
          </div>
        </div>
      ) : selectedTarget ? (
        <div
          className="rounded-xl border border-amber-300/20 bg-amber-300/[.05] px-4 py-3 text-sm text-amber-100"
          aria-live="polite"
        >
          That map target is no longer available in this world update.
          <button
            type="button"
            onClick={clearSelection}
            className="ml-2 underline underline-offset-2 hover:text-white focus-visible:outline-none"
          >
            Clear selection
          </button>
        </div>
      ) : packet.interactionTargets.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-stone-500" aria-live="polite">
          No map targets are available at this zoom level.
        </div>
      ) : null}

      {/* Accessible text/list fallback — all map information without relying on SVG */}
      <details className="rounded-xl border border-white/[.06] bg-black/20">
        <summary className="cursor-pointer select-none px-4 py-2.5 font-mono text-[10px] font-black tracking-[.14em] text-stone-600 hover:text-stone-400">
          MAP FALLBACK LIST ({packet.interactionTargets.length} TARGETS)
        </summary>
        <ul
          className="max-h-64 overflow-y-auto px-4 pb-3 pt-1 text-xs text-stone-400"
          aria-label="Map interaction targets list"
        >
          {packet.interactionTargets.length > 0 ? packet.interactionTargets.map((target) => {
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
          }) : (
            <li className="px-4 pb-3 pt-1 text-xs text-stone-600">No targets available.</li>
          )}
        </ul>
      </details>
    </div>
  );
}
