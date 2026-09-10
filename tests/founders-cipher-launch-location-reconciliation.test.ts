// Canton Quests — Founder's Cipher Launch Location Reconciliation
//
// Every one of the 14 canonical September launch district quests
// (lib/finale.ts LAUNCH_DISTRICT_QUESTS) must have exactly one
// authoritative physical location, and its player-facing instructions must
// never duplicate or contradict that location: quest.instructions = WHAT
// TO DO, quest.location = WHERE TO GO.
//
// This reconciliation pass found the codebase's TypeScript source of truth
// (lib/seed-data.ts) was already substantially correct — 12 of 14 quests
// already had distinct, correctly-bound dedicated locations, none of them
// pointing at the generic McKinley Memorial location. The two real gaps
// fixed here:
//   1. Two instructions embedded a literal street address that belongs
//      solely on the location object (9th-street-opening: "at 9th St NW";
//      goose-land-cipher: "at 714 12th St NW", explicitly flagged in the
//      task brief as duplicating a DIFFERENT location's address — 714 12th
//      St NW is The Tower's address, and Mother Goose Land's own address
//      already happens to match it, so this was a real duplication smell
//      even though not a factual contradiction).
//   2. Kraken Wall's dedicated location (loc-octopus-mural) had no
//      coordinates at all — now resolved per the task brief, reusing the
//      exact, already-verified 4th St NW & Court Ave NW corridor
//      coordinates already on file for the nearby Butterfly Mural.
//
// A parallel Supabase migration (20260910000000_founders_cipher_launch_
// location_reconciliation.sql) applies the same reconciliation to
// production — see that file's header for the significant separate
// finding that 13 of the 14 canonical quest rows do not yet exist in the
// production `quests` table at all (a quest-content gap, not a location
// one — out of scope for this reconciliation).

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_QUESTS, SEED_LOCATIONS, SEED_EVENT } from '../lib/seed-data';
import { LAUNCH_DISTRICT_QUESTS } from '../lib/finale';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const ALL_14_SLUGS = Object.values(LAUNCH_DISTRICT_QUESTS).flat();
const canonicalQuestBySlug = new Map(
  SEED_QUESTS.filter((q) => q.eventId === SEED_EVENT.id && ALL_14_SLUGS.includes(q.slug as any)).map((q) => [q.slug, q])
);
const locationById = new Map(SEED_LOCATIONS.map((l) => [l.id, l]));

// A street-address-shaped fragment: a house/building number followed by a
// street-type word. Deliberately does NOT flag bare landmark names like
// "McKinley National Memorial" or "Fort Hill" (no leading number).
const STREET_ADDRESS_PATTERN = /\b\d{2,5}\s+(?:[A-Za-z0-9.]+\s+){0,3}(?:St|Street|Ave|Avenue|Dr|Drive|Rd|Road|Blvd)\b/i;

describe('Every canonical launch quest has exactly one intended, distinct location_id', () => {
  it('all 14 canonical slugs resolve to a real quest record in lib/seed-data.ts', () => {
    for (const slug of ALL_14_SLUGS) {
      expect(canonicalQuestBySlug.has(slug), `expected a seed quest for slug "${slug}"`).toBe(true);
    }
  });

  it('every canonical quest has a non-empty locationId', () => {
    for (const slug of ALL_14_SLUGS) {
      const quest = canonicalQuestBySlug.get(slug)!;
      expect(quest.locationId, `expected ${slug} to have a locationId`).toBeTruthy();
      expect(typeof quest.locationId).toBe('string');
    }
  });

  it('every canonical quest\'s locationId resolves to a real row in SEED_LOCATIONS', () => {
    for (const slug of ALL_14_SLUGS) {
      const quest = canonicalQuestBySlug.get(slug)!;
      expect(locationById.has(quest.locationId!), `expected locationId "${quest.locationId}" (from ${slug}) to exist in SEED_LOCATIONS`).toBe(true);
    }
  });
});

describe('Specific known-bad location bindings are confirmed fixed', () => {
  it('Draft Lineup and Kraken Wall resolve to different, correct locations (Draft != Kraken)', () => {
    const draft = canonicalQuestBySlug.get('draft-lineup')!;
    const kraken = canonicalQuestBySlug.get('kraken-wall')!;
    expect(draft.locationId).not.toBe(kraken.locationId);
    expect(draft.locationId).toBe('loc-nfl-draft-plaza');
    expect(kraken.locationId).toBe('loc-octopus-mural');
    // Draft Lineup must not be bound to the 4th Street mural row.
    expect(draft.locationId).not.toBe('loc-4th-st-mural');
  });

  it('Golden Mark does not use the generic McKinley Memorial location', () => {
    const goldenMark = canonicalQuestBySlug.get('golden-mark-cipher')!;
    expect(goldenMark.locationId).not.toBe('loc-mckinley-monument');
    expect(goldenMark.locationId).toBe('loc-golden-mark');
  });

  it('Spring Water Shelter does not use the generic McKinley Memorial location', () => {
    const springWater = canonicalQuestBySlug.get('spring-water-shelter')!;
    expect(springWater.locationId).not.toBe('loc-mckinley-monument');
    expect(springWater.locationId).toBe('loc-spring-water-shelter');
  });

  it('Eternal Flame does not use the generic McKinley Memorial location either', () => {
    // Same class of bug the task brief warned about; verified fixed for
    // all three previously-at-risk Secret District quests, not just two.
    const eternalFlame = canonicalQuestBySlug.get('eternal-flame')!;
    expect(eternalFlame.locationId).not.toBe('loc-mckinley-monument');
    expect(eternalFlame.locationId).toBe('loc-eternal-flame');
  });

  it('Kraken Wall\'s dedicated location now has real, non-invented coordinates (reused from the existing 4th St corridor location)', () => {
    const kraken = canonicalQuestBySlug.get('kraken-wall')!;
    const loc = locationById.get(kraken.locationId!)!;
    const mural = locationById.get('loc-4th-st-mural')!;
    expect(loc.latitude).toBe(mural.latitude);
    expect(loc.longitude).toBe(mural.longitude);
    expect(loc.address).toBe(mural.address);
  });
});

describe('No canonical quest instruction contains a street address that disagrees with quest.location', () => {
  it('no canonical quest instructions embed a street-address-shaped fragment at all (address belongs on quest.location only)', () => {
    for (const slug of ALL_14_SLUGS) {
      const quest = canonicalQuestBySlug.get(slug)!;
      const match = quest.instructions.match(STREET_ADDRESS_PATTERN);
      expect(match, `expected no street address in ${slug}'s instructions, found: ${match?.[0]}`).toBeNull();
    }
  });

  it('specifically confirms the two known-bad addresses were removed from instructions text', () => {
    const nineThStreet = canonicalQuestBySlug.get('9th-street-opening')!;
    const gooseLand = canonicalQuestBySlug.get('goose-land-cipher')!;
    expect(nineThStreet.instructions).not.toContain('9th St NW');
    expect(gooseLand.instructions).not.toContain('714 12th St NW');
    // The underlying task/place is still clearly named — this is a
    // duplication fix, not a content deletion.
    expect(nineThStreet.instructions).toContain('9th Street DIY Skate Park');
    expect(gooseLand.instructions).toContain('Mother Goose Land');
  });
});

describe('Open Map uses quest.location only, never quest.instructions', () => {
  it('getDirectionsUrl builds its query exclusively from quest.location fields', () => {
    const pageSource = readSource('app/events/[slug]/quests/[questId]/page.tsx');
    const fnBlock = pageSource.slice(
      pageSource.indexOf('function getDirectionsUrl'),
      pageSource.indexOf('function getDirectionsUrl') + 300
    );
    expect(fnBlock).toContain('quest.location?.name');
    expect(fnBlock).toContain('quest.location?.address');
    expect(fnBlock).not.toContain('quest.instructions');
  });
});

describe('The production migration exists and matches the same 14-quest reconciliation', () => {
  const migrationSource = readSource('supabase/migrations/20260910000000_founders_cipher_launch_location_reconciliation.sql');

  it('rebinds all 14 canonical quest slugs by (event_id, slug), never by a TypeScript qst-*/loc-* id', () => {
    for (const slug of ALL_14_SLUGS) {
      expect(migrationSource, `expected an UPDATE for slug "${slug}"`).toContain(`slug = '${slug}'`);
    }
    expect(migrationSource).not.toMatch(/'qst-[a-z0-9-]+'::uuid/);
  });

  it('creates each new dedicated location by resolve-or-create-by-name, never a bare unconditional INSERT', () => {
    const insertCount = (migrationSource.match(/INSERT INTO public\.locations/g) || []).length;
    const selectByNameCount = (migrationSource.match(/FROM public\.locations WHERE name = /g) || []).length;
    expect(insertCount).toBeGreaterThan(0);
    // Every INSERT is guarded by a prior SELECT-by-name lookup (IF ... IS NULL).
    expect(selectByNameCount).toBeGreaterThanOrEqual(insertCount);
  });

  it('does not invent coordinates for still-unresolved locations (Bell, Sign, Draft Plaza, JFK, Golden Mark, Spring Water)', () => {
    const unresolvedNames = [
      'Bicentennial Bell',
      'Canton Sign Sculpture',
      'NFL Draft Plaza (1936 NFL Draft Statues)',
      'John F. Kennedy Memorial Fountain (Eternal Flame)',
      'The Golden Mark (Canton Road)',
      'Spring Water Shelter (Fort Hill Park)',
    ];
    for (const name of unresolvedNames) {
      const idx = migrationSource.indexOf(`VALUES (v_city_id, '${name}'`);
      expect(idx, `expected an INSERT VALUES clause for location "${name}"`).toBeGreaterThan(-1);
      const block = migrationSource.slice(idx, idx + 220);
      expect(block, `expected NULL, NULL coordinates for "${name}"`).toMatch(/,\s*NULL,\s*NULL,/);
    }
  });

  it('resolves Kraken Wall coordinates by reusing the existing 4th Street corridor values, not inventing new numbers', () => {
    const idx = migrationSource.indexOf("'Octopus Mural (Kraken Wall)'");
    expect(idx).toBeGreaterThan(-1);
    const block = migrationSource.slice(idx, idx + 300);
    expect(block).toContain('40.7995');
    expect(block).toContain('-81.3755');
  });

  it('strips the two known-bad hardcoded addresses from instructions in the same migration', () => {
    expect(migrationSource).toContain("slug = '9th-street-opening'");
    expect(migrationSource).toContain("slug = 'goose-land-cipher'");
    const nineThBlock = migrationSource.slice(
      migrationSource.indexOf("slug = '9th-street-opening'") - 400,
      migrationSource.indexOf("slug = '9th-street-opening'")
    );
    expect(nineThBlock).not.toContain('at 9th St NW');
    const gooseBlock = migrationSource.slice(
      migrationSource.indexOf("slug = 'goose-land-cipher'") - 400,
      migrationSource.indexOf("slug = 'goose-land-cipher'")
    );
    expect(gooseBlock).not.toContain('at 714 12th St NW');
  });

  it('documents, rather than silently masks, that most canonical quest rows do not yet exist in production', () => {
    expect(migrationSource).toContain('have never actually been inserted');
    expect(migrationSource).toContain('no-op');
  });
});
