// Canton Quests — Stark County Fair Live Map & Mission Scoping Test Suite

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FAIR_MAP_CENTER, FAIR_SECTOR_ZONES, resolveFairZoneId } from '../components/FairLiveMap';
import FairLiveMap from '../components/FairLiveMap';
import FairLiveMapWrapper from '../components/FairLiveMapWrapper';
import { getPublicQuestView } from '../lib/game-engine';
import { SEED_FAIR_QUESTS } from '../lib/seed-data';

const OLD_LEGACY_ZONE_IDS = ['grandstand', 'midway', 'exhibition', 'food_row'];
const OLD_LEGACY_COORDS: Array<[number, number]> = [
  [40.806, -81.3992],
  [40.8042, -81.3975],
  [40.8025, -81.4012],
  [40.8014, -81.3988],
];

const APPROVED_SECTORS = [
  { id: 'track_grandstand', name: 'Track / Grandstand', lat: 40.8038592, lng: -81.4092032, radius: 130 },
  { id: 'livestock', name: 'Livestock', lat: 40.8047277, lng: -81.4108493, radius: 106 },
  { id: 'pavilion_exhibits', name: 'Pavilion / Exhibits', lat: 40.8027898, lng: -81.4107411, radius: 166 },
  { id: 'midway_amusement', name: 'Midway / Amusement', lat: 40.8021115, lng: -81.4099042, radius: 113 },
];

describe('Stark County Fair Live Map Configuration & Coordinates', () => {
  // ---- 1. Canonical Fair Hunt reference center ----
  it('1. exports a single canonical FAIR_MAP_CENTER with the exact corrected Stark County Fairgrounds coordinates', () => {
    expect(FAIR_MAP_CENTER.lat).toBe(40.80192286342209);
    expect(FAIR_MAP_CENTER.lng).toBe(-81.40825970719298);
  });

  it('the Leaflet setView call and the on-map coordinate readout both derive from FAIR_MAP_CENTER — no scattered duplicate literal', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('.setView([FAIR_MAP_CENTER.lat, FAIR_MAP_CENTER.lng]');
    expect(source).toContain('FAIR_MAP_CENTER_LABEL');
  });

  it('zoom remains exactly 15.4 (verified against the real rendered map, not blindly assumed)', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('.setView([FAIR_MAP_CENTER.lat, FAIR_MAP_CENTER.lng], 15.4);');
  });

  // ---- Basemap tile source: production-safe fix ----
  describe('basemap tile source', () => {
    const source = () => fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');

    it('1. no longer uses the broken CARTO tile URL that returns "API KEY REQUIRED" watermarked tiles', () => {
      // "dark_all" may still appear inside the explanatory comment
      // describing the old, now-removed URL — the real assertion is that
      // the actual tileLayer() call no longer points at cartocdn.com.
      expect(source()).not.toContain('basemaps.cartocdn.com');
      expect(source()).not.toContain("L.tileLayer('https://{s}.basemaps.cartocdn.com");
    });

    it('2. uses the same production-safe, no-key OpenStreetMap tile source already proven in CantonMap.tsx', () => {
      expect(source()).toContain('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    });

    it('3. carries the correct, legally-required OpenStreetMap attribution, linked and not hidden', () => {
      const s = source();
      expect(s).toContain('&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors');
      // attributionControl must stay enabled on the map instance — this is
      // what actually surfaces the attribution string to the player.
      expect(s).toContain('attributionControl: true');
    });

    it('does not introduce any API key, token, or secret into client-side code', () => {
      const s = source();
      expect(s).not.toMatch(/api[_-]?key/i);
      expect(s).not.toMatch(/access[_-]?token/i);
    });

    // SectorMap.tsx (Founder's Cipher) had the identical broken CARTO URL,
    // discovered during this Fair map pass. It was NOT touched here — it
    // was fixed independently, in its own separate follow-up pass (see
    // tests/sector-map.test.ts for that pass's own regression coverage).
    // This test only proves the FairLiveMap-scoped edits in this file
    // never reached into SectorMap.tsx's geography/gameplay.
    it("never touches Founder's Cipher's SectorMap.tsx geography — center, zoom, or zone coordinates", () => {
      const sectorMapSource = fs.readFileSync(path.join(process.cwd(), 'components/SectorMap.tsx'), 'utf-8');
      expect(sectorMapSource).toContain('.setView([40.7980, -81.3820], 13.6);');
      expect(sectorMapSource).toContain("lat: 40.8070,\n    lng: -81.3936,");
    });

    it("does not touch Canton citywide CantonMap.tsx's already-correct tile configuration", () => {
      const cantonMapSource = fs.readFileSync(path.join(process.cwd(), 'components/CantonMap.tsx'), 'utf-8');
      expect(cantonMapSource).toContain('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
      expect(cantonMapSource).toContain('Production-safe public tiles: no private API key required.');
    });
  });

  // ---- 2. Old Fair center is absent ----
  // Note: the new Track/Grandstand sector (40.8038592) coincidentally shares
  // a "40.8038" prefix with the old wrong center — a real, independently
  // georeferenced value, not a leftover. So this checks the exact old
  // pair/string, not a bare substring that a legitimate new number could
  // innocently contain.
  it('2. the old, geographically-wrong Fair map center (40.8038, -81.3995) is absent from the component', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).not.toContain('40.8038, -81.3995');
    expect(source).not.toContain('81.3995');
    expect(source).not.toContain('40.8038° N, 81.3995° W');
    expect(FAIR_MAP_CENTER.lat).not.toBe(40.8038);
    expect(FAIR_MAP_CENTER.lng).not.toBe(-81.3995);
  });

  // ---- 3. Old Grandstand/Midway/Exhibition/Food Row coordinate set removed ----
  it('3. the old legacy sector ids and their invented coordinates are completely removed', () => {
    const ids = FAIR_SECTOR_ZONES.map((z) => z.id);
    for (const legacyId of OLD_LEGACY_ZONE_IDS) {
      expect(ids).not.toContain(legacyId);
    }
    for (const [lat, lng] of OLD_LEGACY_COORDS) {
      const stillPresent = FAIR_SECTOR_ZONES.some((z) => z.lat === lat && z.lng === lng);
      expect(stillPresent).toBe(false);
    }
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).not.toContain("id: 'grandstand'");
    expect(source).not.toContain("id: 'midway'");
    expect(source).not.toContain("id: 'exhibition'");
    expect(source).not.toContain("id: 'food_row'");
    expect(source).not.toContain('Grandstand & Track Area');
    expect(source).not.toContain('Midway & Carnival Plaza');
    expect(source).not.toContain('Exhibition & Agri Pavilion');
  });

  // ---- 4. Food Row no longer exists as a sector ----
  it('4. "Food Row" no longer exists as a geographic sector anywhere', () => {
    const ids = FAIR_SECTOR_ZONES.map((z) => z.id);
    const names = FAIR_SECTOR_ZONES.map((z) => z.name.toLowerCase());
    expect(ids).not.toContain('food_row');
    expect(names.some((n) => n.includes('food row'))).toBe(false);

    // "Food Row" may still appear in an explanatory code comment describing
    // its removal — that's legitimate documentation, not a live sector. The
    // real assertion is that no code path can ever return/render it as an
    // active zone id.
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).not.toContain("id: 'food_row'");
    expect(source).not.toContain("return 'food_row'");
  });

  // ---- 5, 6, 7. Four approved sectors, exact centers, correct radii ----
  it('5/6/7. exactly the four approved real sectors exist, with the exact approved approximate centers and radii', () => {
    expect(FAIR_SECTOR_ZONES).toHaveLength(4);
    for (const approved of APPROVED_SECTORS) {
      const zone = FAIR_SECTOR_ZONES.find((z) => z.id === approved.id);
      expect(zone, `sector ${approved.id} should exist`).toBeDefined();
      expect(zone?.name).toBe(approved.name);
      expect(zone?.lat).toBe(approved.lat);
      expect(zone?.lng).toBe(approved.lng);
      expect(zone?.radius).toBe(approved.radius);
    }
  });

  it('every sector is explicitly documented as an approximate center, not survey-grade', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source.toLowerCase()).toContain('approximate');
    expect(source).toContain('radius in meters — not survey-grade');
  });

  it('the four decorative sector zones are explicitly labeled as approximate search areas, not verified Signal placements', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('zone-disclaimer');
    expect(source).toContain('Search sectors show general areas of the fairgrounds. Individual Signal locations must still be discovered on-site.');
  });

  // ---- 8. Sector centers are never used as Signal coordinates ----
  it('8. no sector center coordinate is ever assigned as a real Fair Signal quest coordinate', () => {
    const sectorCoordPairs = new Set(FAIR_SECTOR_ZONES.map((z) => `${z.lat},${z.lng}`));
    for (const quest of SEED_FAIR_QUESTS) {
      const pd = quest.placementDetails as { latitude?: number; longitude?: number } | undefined;
      if (pd?.latitude !== undefined && pd?.longitude !== undefined) {
        expect(sectorCoordPairs.has(`${pd.latitude},${pd.longitude}`)).toBe(false);
      }
      // No seeded Fair quest has placement coordinates at all — none has been physically placed.
      expect(pd?.latitude).toBeUndefined();
      expect(pd?.longitude).toBeUndefined();
    }
  });

  it('the component never derives a Signal marker from FAIR_SECTOR_ZONES or FAIR_MAP_CENTER', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    // The signal-marker render loop must iterate the placedSignals prop only.
    expect(source).toContain('for (const signal of placedSignals || [])');
    expect(source).not.toContain('placedSignals || FAIR_SECTOR_ZONES');
  });

  // ---- 9 & 10. Unplaced / invalid Signals never render markers ----
  it('9/10. a Signal marker only renders when placedSignals supplies finite lat/lng — never a fallback, never for unplaced Signals', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain("if (!Number.isFinite(signal.lat) || !Number.isFinite(signal.lng)) continue;");
    // No default/fallback data source — omitting the prop renders zero markers.
    expect(source).toContain('placedSignals?: FairPlacedSignal[]');
  });

  it('the public Fair dashboard page does not wire any placement coordinate data into the map — default is zero real Signal markers shown', () => {
    const pageSource = fs.readFileSync(path.join(process.cwd(), 'app/events/fair-qr-hunt/page.tsx'), 'utf-8');
    expect(pageSource).not.toContain('placedSignals');
    expect(pageSource).not.toContain('placementDetails');
  });

  // ---- 11. target_code never exposed through public map data ----
  it('11. getPublicQuestView strips target_code and all placement/admin fields from every Fair quest, even ones that (hypothetically) had them set', () => {
    for (const quest of SEED_FAIR_QUESTS.slice(0, 3)) {
      const withHypotheticalPlacement = {
        ...quest,
        targetCode: 'FAIR-SECRET-CODE-SHOULD-NEVER-LEAK',
        gmNotes: 'Private retrieval note',
        placedAt: new Date().toISOString(),
        placementDetails: { latitude: 40.81, longitude: -81.41, setupNotes: 'private', retrievalNotes: 'private' },
      };
      const publicView = getPublicQuestView(withHypotheticalPlacement as typeof quest);
      expect(publicView).not.toHaveProperty('targetCode');
      expect(publicView).not.toHaveProperty('gmNotes');
      expect(publicView).not.toHaveProperty('placementDetails');
      expect(publicView).not.toHaveProperty('placedAt');
      expect(JSON.stringify(publicView)).not.toContain('FAIR-SECRET-CODE-SHOULD-NEVER-LEAK');
    }
  });

  it('FairPlacedSignal — the only public marker shape — carries no target_code, GM notes, or admin metadata by construction', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    const interfaceMatch = source.match(/export interface FairPlacedSignal \{([\s\S]*?)\}/);
    expect(interfaceMatch).toBeTruthy();
    const body = interfaceMatch![1];
    expect(body).not.toMatch(/targetCode/i);
    expect(body).not.toMatch(/gmNotes/i);
    expect(body).not.toMatch(/setupNotes/i);
    expect(body).not.toMatch(/retrievalNotes/i);
  });

  it('exact QR-card coordinates stay admin-only by explicit product decision, documented in code', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('coordinates therefore stay admin-only');
  });

  // ---- 12 & 13. Founder's Cipher / Canton citywide maps unchanged ----
  it("12/13. does not touch Founder's Cipher or Canton citywide map center configuration", () => {
    const cantonMapSource = fs.readFileSync(path.join(process.cwd(), 'components/CantonMap.tsx'), 'utf-8');
    expect(cantonMapSource).toContain('const CANTON_CENTER: [number, number] = [40.7989, -81.3748];');

    const sectorMapSource = fs.readFileSync(path.join(process.cwd(), 'components/SectorMap.tsx'), 'utf-8');
    expect(sectorMapSource).toContain('CANTON, OH · 40.7989° N, 81.3784° W');

    expect(cantonMapSource).not.toContain('40.80192286342209');
    expect(sectorMapSource).not.toContain('40.80192286342209');
    expect(cantonMapSource).not.toContain('Track / Grandstand');
    expect(sectorMapSource).not.toContain('Track / Grandstand');
  });

  // ---- Supporting coverage carried over / extended from the prior pass ----
  it('should export FairLiveMap and FairLiveMapWrapper as functional React components', () => {
    expect(typeof FairLiveMap).toBe('function');
    expect(typeof FairLiveMapWrapper).toBe('function');
  });

  it('correctly maps Signal numbers and keywords to the four real fairground sectors (cosmetic heuristic only)', () => {
    expect(resolveFairZoneId('Agent scanned Signal 01 at the track')).toBe('track_grandstand');
    expect(resolveFairZoneId('Grandstand dispatch')).toBe('track_grandstand');
    expect(resolveFairZoneId('fair-core-03')).toBe('track_grandstand');

    expect(resolveFairZoneId('Agent claimed Signal 07 near the dairy barn')).toBe('livestock');
    expect(resolveFairZoneId('Livestock coliseum flash drop')).toBe('livestock');
    expect(resolveFairZoneId('fair-core-09')).toBe('livestock');

    expect(resolveFairZoneId('Agent claimed Signal 12 at the pavilion')).toBe('pavilion_exhibits');
    expect(resolveFairZoneId('Exhibition hall discovery')).toBe('pavilion_exhibits');
    expect(resolveFairZoneId('fair-core-14')).toBe('pavilion_exhibits');

    expect(resolveFairZoneId('Daily Bonus — Kiddyland secured')).toBe('midway_amusement');
    expect(resolveFairZoneId('Midway games stand')).toBe('midway_amusement');
    expect(resolveFairZoneId('fair-core-18')).toBe('midway_amusement');

    expect(resolveFairZoneId(undefined)).toBe('track_grandstand');
    expect(resolveFairZoneId('')).toBe('track_grandstand');
  });

  it('never claims individual Signal scans stream live to the map, live player GPS, or realtime tracking that does not exist', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).not.toMatch(/signal claims will stream here/i);
    expect(source).not.toMatch(/watch signal discoveries.*unfold in real time/i);
    expect(source).not.toMatch(/live player gps/i);
    expect(source).not.toMatch(/every (qr )?scan (streams|is streamed)/i);
    expect(source).not.toMatch(/real-time signals/i);
  });

  it('uses truthful map heading copy ("Fair Hunt Map" / "Fairgrounds Search Grid")', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('Fair Hunt');
    expect(source).toContain('FAIRGROUNDS SEARCH GRID');
  });

  it('only shows "Active Fair Agents" when a real live count is actually supplied — never a fabricated/frozen zero', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('countProp !== undefined && (');
    expect(source).toContain('Active Fair Agents');
  });

  it('remains responsive on mobile — the two-panel grid still collapses to one column under the existing breakpoint', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('@media (max-width: 900px)');
    expect(source).toContain('grid-template-columns: 1fr;');
  });

  it('sector circles render as translucent areas (fillOpacity), not opaque precise pins, for the sector center itself', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('fillOpacity: 0.06');
    expect(source).toContain('fillOpacity: 0.12');
  });

  it('QuestPlacementDetails supports real per-Signal latitude/longitude for future placements, without inventing any value', () => {
    const typesSource = fs.readFileSync(path.join(process.cwd(), 'lib/types.ts'), 'utf-8');
    expect(typesSource).toContain('latitude?: number;');
    expect(typesSource).toContain('longitude?: number;');

    const adminRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/admin/fair-qr/route.ts'), 'utf-8');
    expect(adminRouteSource).toContain('latitude');
    expect(adminRouteSource).toContain('longitude');
  });

  it('verifies FairLiveMap includes reduced-motion accessibility overrides', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'components/FairLiveMap.tsx'), 'utf-8');
    expect(source).toContain('@media (prefers-reduced-motion: reduce)');
    expect(source).toContain('animation: none !important');
    expect(source).toContain('display: none !important');
  });

  it('verifies Fair QR Hunt dashboard mounts FairLiveMapWrapper', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/events/fair-qr-hunt/page.tsx'), 'utf-8');
    expect(source).toContain("import FairLiveMapWrapper from '@/components/FairLiveMapWrapper'");
    expect(source).toContain('<FairLiveMapWrapper />');
  });

  it("verifies Cipher Mission dashboard mounts SectorMapWrapper in MAP tab", () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/events/[slug]/page.tsx'), 'utf-8');
    expect(source).toContain("import SectorMapWrapper from '@/components/SectorMapWrapper'");
    expect(source).toContain('<SectorMapWrapper />');
    expect(source).toContain('<CantonMapWrapper');
  });

  it('verifies Spectator Watch page conditionally scopes to FairLiveMapWrapper or SectorMapWrapper', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'app/watch/page.tsx'), 'utf-8');
    expect(source).toContain("import FairLiveMapWrapper from '@/components/FairLiveMapWrapper'");
    expect(source).toContain("import SectorMapWrapper from '@/components/SectorMapWrapper'");
    expect(source).toContain("<FairLiveMapWrapper");
    expect(source).toContain("<SectorMapWrapper");
    expect(source).toContain("requestedEventSlug === 'fair-qr-hunt'");
  });
});
