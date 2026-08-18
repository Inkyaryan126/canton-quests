import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Canton Quests — Canonical Production Game Data Restoration Migration', () => {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/20260814020000_restore_canton_volume1_production_seed.sql'
  );
  const sql = readFileSync(migrationPath, 'utf8');

  it('1. Migration file exists and is non-empty', () => {
    expect(sql).toBeDefined();
    expect(sql.length).toBeGreaterThan(1000);
  });

  it('2. Enforces non-destructive idempotency (no DROP, TRUNCATE, DELETE)', () => {
    expect(sql).not.toMatch(/TRUNCATE/i);
    expect(sql).not.toMatch(/DROP\s+TABLE/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.players/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+public\.users/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+auth\.users/i);
  });

  it('3. Enforces zero fake/demo player seeding', () => {
    expect(sql).not.toMatch(/INSERT\s+INTO\s+public\.players/i);
    expect(sql).not.toContain('ApexHunter_330');
    expect(sql).not.toContain('CantonRover');
    expect(sql).not.toContain('DowntownDecoder');
  });

  it('4. Restores Canton, Ohio city record with deterministic UUID', () => {
    expect(sql).toContain("'a0000001-0000-4000-8000-000000000001'::uuid");
    expect(sql).toContain("'Canton'");
    expect(sql).toContain("'canton-oh'");
    expect(sql).toContain("'OH'");
  });

  it('5. Restores all 9 canonical launch locations', () => {
    const expectedLocations = [
      'Centennial Plaza',
      'McKinley National Memorial',
      '4th Street Arts Corridor Mural',
      'Aura Craft Coffee',
      'Downtown Canton Arcade Vault',
      'Canton Palace Theatre',
      'Hall of Fame City Marker',
      'The Onesto Historic Entrance',
      'Frankenstein Monument at West Lawn Cemetery',
    ];

    for (const loc of expectedLocations) {
      expect(sql).toContain(loc);
    }
  });

  it('6. Preserves Frankenstein Monument safety boundaries without invented coordinates', () => {
    expect(sql).toContain('Frankenstein Monument at West Lawn Cemetery');
    expect(sql).toMatch(/1919 7th St NW, Canton, OH 44708',\s+NULL,\s+NULL/);
    expect(sql).toContain('Daylight cemetery visit only during posted visitor hours');
    expect(sql).toContain('Human field verification required before launch');
    expect(sql).toContain('never touch, climb, lean on, decorate, or disturb graves');
  });

  it('7. Restores canonical event: Canton Quests Volume 1 (The Founder\'s Cipher)', () => {
    expect(sql).toContain("'b0000001-0000-4000-8000-000000000001'::uuid");
    expect(sql).toContain("Canton Quests: Volume 1 - The Founder''s Cipher");
    expect(sql).toContain("'canton-weekend-1'");
    expect(sql).toContain("'active'");
    expect(sql).toContain("'day_1'");
    expect(sql).toContain("'2026-09-11T18:00:00Z'");
    expect(sql).toContain("'2026-09-14T22:00:00Z'");
  });

  it('8. Restores all 15 canonical Volume 1 quests with complete Three-Path district assignments', () => {
    const expectedQuestSlugs = [
      'centennial-beacon',
      'mckinley-monument-year',
      '4th-st-mural-pose',
      'aura-coffee-scan',
      'arcade-champion-video',
      'palace-theatre-lore',
      'market-square-flash',
      'onesto-brass-motto',
      'hof-trail-emblem',
      'frankenstein-quiet-signal',
      'secret-cipher-77',
      'founders-secret-clue',
      'palace-marquee-flash',
      'civic-seal-snapshot',
      'grand-finale-cipher',
    ];

    for (const slug of expectedQuestSlugs) {
      expect(sql).toContain(`'${slug}'`);
    }

    // Verify district attribution in SQL
    expect(sql).toContain("'family'");
    expect(sql).toContain("'challenge'");
    expect(sql).toContain("'secret'");
    expect(sql).toContain("'cross_city'");
  });

  it('9. Restores multi-step quest sequence for Secret Quest with cryptographic step hashes', () => {
    expect(sql).toContain('Lock One: Founder Fragment');
    expect(sql).toContain('Lock Two: Painted Fragment');
    expect(sql).toContain('Lock Three: Brass Fragment');
    expect(sql).toContain('sha256:be562e8a568bb4e0d791bca32216ff5ab972809bee874b937820e267f1e27106');
    expect(sql).toContain('sha256:a0075b8e48f2cb31f4d2dc97a9c7326856d300fe0a733099686390f4ae4d632d');
    expect(sql).toContain('sha256:3a5272225a330aba73b7dd79c961313b53c7dbb5dd75d6376505ee2bf5d8403c');
  });

  it('10. Restores Collectibles, Secret Codes, NPC, Business Partners, Event Prizes, and Drawing Lock', () => {
    // Collectibles
    expect(sql).toContain('founder-token');
    expect(sql).toContain('cipher-fragment-1');
    expect(sql).toContain('cipher-fragment-2');
    expect(sql).toContain('cipher-fragment-3');
    expect(sql).toContain('palace-seal');

    // Secret Codes
    expect(sql).toContain('sha256:67a9464364c6f818e5ee997ee0a2b4ce41132639b4498d2a8ceedf70b0d90834');
    expect(sql).toContain('sha256:02afa6fe2b15c793aad3c73636cbc91539816da99dc43144712b3bf405933eca');

    // NPC
    expect(sql).toContain('The Courier');

    // Business Partners
    expect(sql).toContain('Aura Craft Coffee');
    expect(sql).toContain('Downtown Canton Arcade Vault');

    // Event Prizes
    expect(sql).toContain('Canton Quest Champion Trophy');
    expect(sql).toContain('Year of Aura Coffee VIP Pass');

    // Drawing Ledger Lock
    expect(sql).toContain('public.drawing_ledger_locks');
  });

  it('11. Uses valid UUID syntax for all primary and foreign key literals', () => {
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    const matches = sql.match(uuidRegex) || [];
    expect(matches.length).toBeGreaterThan(30);

    for (const match of matches) {
      expect(match).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  });
});
