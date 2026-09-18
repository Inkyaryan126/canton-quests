import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import {
  buildGridMapRenderPacket,
  buildGridMapScene,
  resolveGridMapSelection,
} from '../lib/grid/map';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

const ROOT = join(__dirname, '..');

// ── Engine integration ────────────────────────────────────────────────────────

describe('GridCityMap engine integration', () => {
  it('produces correct zoom bands for the three UI zoom levels', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);

    const city = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 10 }));
    expect(city.zoomBand).toBe('city');
    expect(city.territories.features).toHaveLength(0);
    expect(city.properties.features).toHaveLength(0);

    const district = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 13 }));
    expect(district.zoomBand).toBe('district');
    expect(district.territories.features.length).toBeGreaterThan(0);
    expect(district.properties.features).toHaveLength(0);

    const property = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 16 }));
    expect(property.zoomBand).toBe('property');
    expect(property.properties.features.length).toBeGreaterThan(0);
  });

  it('city zoom packet exposes district interaction targets only', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 10 }));

    expect(packet.interactionTargets.length).toBeGreaterThan(0);
    expect(packet.interactionTargets.every((t) => t.kind === 'district')).toBe(true);
  });

  it('district zoom packet exposes territory interaction targets', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 13 }));

    expect(packet.interactionTargets.some((t) => t.kind === 'territory')).toBe(true);
    expect(packet.interactionTargets.every((t) => t.kind !== 'property')).toBe(true);
  });

  it('property zoom packet exposes property interaction targets', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 16 }));

    expect(packet.interactionTargets.some((t) => t.kind === 'property')).toBe(true);
  });
});

// ── Selection resolution ──────────────────────────────────────────────────────

describe('GridCityMap selection hooks', () => {
  it('resolves district selection with control summary', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 10 }));
    const target = packet.interactionTargets.find((t) => t.kind === 'district');
    expect(target).toBeDefined();

    const sel = resolveGridMapSelection(packet, target!);
    expect(sel?.kind).toBe('district');
    if (sel?.kind === 'district') {
      expect(typeof sel.controlRole).toBe('string');
      expect(typeof sel.territoryCount).toBe('number');
      expect(sel.territoryCount).toBeGreaterThan(0);
    }
  });

  it('resolves territory selection with name and claim state', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 13 }));
    const target = packet.interactionTargets.find((t) => t.kind === 'territory');
    expect(target).toBeDefined();

    const sel = resolveGridMapSelection(packet, target!);
    expect(sel?.kind).toBe('territory');
    if (sel?.kind === 'territory') {
      expect(typeof sel.name).toBe('string');
      expect(sel.name.length).toBeGreaterThan(0);
      expect(typeof sel.claimable).toBe('boolean');
      expect(typeof sel.contested).toBe('boolean');
      expect(typeof sel.propertyCount).toBe('number');
    }
  });

  it('resolves property selection at property zoom', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 16 }));
    const target = packet.interactionTargets.find((t) => t.kind === 'property');
    expect(target).toBeDefined();

    const sel = resolveGridMapSelection(packet, target!);
    expect(sel?.kind).toBe('property');
    if (sel?.kind === 'property') {
      expect(typeof sel.name).toBe('string');
      expect(typeof sel.ownership).toBe('string');
      expect(typeof sel.conditionBand).toBe('string');
    }
  });

  it('returns null for a target not present in the packet', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 10 }));
    const ghost = {
      kind: 'territory' as const,
      slug: 'nonexistent-territory',
      districtSlug: null,
      territorySlug: 'nonexistent-territory',
      propertySlug: null,
    };
    expect(resolveGridMapSelection(packet, ghost)).toBeNull();
  });
});

// ── Accessible fallback ───────────────────────────────────────────────────────

describe('GridCityMap accessible fallback list', () => {
  it('every interaction target in the packet resolves to non-null selection details', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);

    for (const zoom of [10, 13, 16] as const) {
      const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom }));
      for (const target of packet.interactionTargets) {
        const details = resolveGridMapSelection(packet, target);
        expect(details).not.toBeNull();
      }
    }
  });

  it('territory targets in fallback list carry a human-readable name', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 13 }));
    const territoryTargets = packet.interactionTargets.filter(
      (t) => t.kind === 'territory',
    );
    expect(territoryTargets.length).toBeGreaterThan(0);
    for (const target of territoryTargets) {
      const sel = resolveGridMapSelection(packet, target);
      if (sel?.kind === 'territory') {
        expect(sel.name.length).toBeGreaterThan(0);
      }
    }
  });

  it('property targets in fallback list carry name and ownership', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 16 }));
    const propertyTargets = packet.interactionTargets.filter(
      (t) => t.kind === 'property',
    );
    expect(propertyTargets.length).toBeGreaterThan(0);
    for (const target of propertyTargets) {
      const sel = resolveGridMapSelection(packet, target);
      if (sel?.kind === 'property') {
        expect(['neutral', 'you', 'occupied']).toContain(sel.ownership);
      }
    }
  });
});

// ── Source-level integration checks ──────────────────────────────────────────

describe('GridCityMap component wiring', () => {
  it('GridWorldClient imports and renders GridCityMap', () => {
    const src = readFileSync(
      join(ROOT, 'app/grid/grid-world-client.tsx'),
      'utf-8',
    );
    expect(src).toContain('GridCityMap');
    expect(src).toContain('./grid-city-map');
    // old inline SVG helpers must be absent
    expect(src).not.toContain('geometryPath');
    expect(src).not.toContain('territoryClass');
    expect(src).not.toContain('getBounds');
  });

  it('GridCityMap component uses all three engine functions', () => {
    const src = readFileSync(
      join(ROOT, 'app/grid/grid-city-map.tsx'),
      'utf-8',
    );
    expect(src).toContain('buildGridMapScene');
    expect(src).toContain('buildGridMapRenderPacket');
    expect(src).toContain('resolveGridMapSelection');
  });

  it('GridCityMap component exposes accessible fallback via interactionTargets', () => {
    const src = readFileSync(
      join(ROOT, 'app/grid/grid-city-map.tsx'),
      'utf-8',
    );
    expect(src).toContain('interactionTargets');
    // must have an aria-live region for selection detail
    expect(src).toContain('aria-live');
    // must have keyboard event handler
    expect(src).toContain('onKeyDown');
  });
});
