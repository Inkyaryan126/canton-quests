import { describe, expect, it } from 'vitest';
import {
  isKnownCantonLaunchSlug,
  isBeforeLaunchDate,
  isPreLaunchEvent,
  CANONICAL_LAUNCH_DATE_ISO,
  KNOWN_CANTON_LAUNCH_SLUGS,
} from '../lib/launch-status';
import {
  CANONICAL_QUEST_PROOF_SECRETS,
  getServerProofSecretMaps,
  getServerQuestTargetCode,
  getServerQuestStepTargetCode,
} from '../lib/quest-proof-secrets';
import { getEventBySlug, getEvents } from '../lib/game-engine';
import { QuestEvent } from '../lib/types';
import fs from 'node:fs';
import path from 'node:path';

describe('Pre-Launch States & Error Sanitization Suite', () => {
  describe('Launch Status & Pre-Launch Detection Utilities', () => {
    it('identifies canonical launch date as September 11, 2026 at 18:00 UTC', () => {
      expect(CANONICAL_LAUNCH_DATE_ISO).toBe('2026-09-11T18:00:00Z');
    });

    it('recognizes all known Canton launch event slugs', () => {
      const knownSlugs = [
        'canton-weekend-1',
        'canton-launch-2026',
        'canton-vol-1',
        'canton-volume-1',
        'canton-quests-vol-1',
        'canton-founder-cipher',
        'the-founders-cipher',
        'canton-weekend-launch',
        'canton-2026',
        'canton-launch',
        'launch-2026',
        'default-event',
      ];

      for (const slug of knownSlugs) {
        expect(isKnownCantonLaunchSlug(slug)).toBe(true);
      }
    });

    it('rejects arbitrary invalid non-launch slugs', () => {
      const invalidSlugs = [
        'invalid-slug-123',
        'random-quest-404',
        'fake-event-name',
        'test-unknown-foo',
        'akron-quest-1',
        'cleveland-event',
      ];

      for (const slug of invalidSlugs) {
        expect(isKnownCantonLaunchSlug(slug)).toBe(false);
      }
    });

    it('accurately checks whether a date is before official launch', () => {
      // August 18, 2026 is before launch
      expect(isBeforeLaunchDate('2026-08-18T18:00:00Z')).toBe(true);
      // September 10, 2026 is before launch
      expect(isBeforeLaunchDate('2026-09-10T12:00:00Z')).toBe(true);
      // September 11, 2026 19:00 UTC is after launch
      expect(isBeforeLaunchDate('2026-09-11T19:00:00Z')).toBe(false);
      // September 12, 2026 is after launch
      expect(isBeforeLaunchDate('2026-09-12T00:00:00Z')).toBe(false);
    });

    it('resolves pre-launch state for known launch slugs even if event record is missing', () => {
      expect(isPreLaunchEvent(null, 'canton-launch-2026')).toBe(true);
      expect(isPreLaunchEvent(null, 'canton-weekend-1')).toBe(true);
      expect(isPreLaunchEvent(undefined, 'canton-founder-cipher')).toBe(true);
    });

    it('returns false for arbitrary invalid slug when event is missing (preserving true 404)', () => {
      expect(isPreLaunchEvent(null, 'nonexistent-event-slug')).toBe(false);
      expect(isPreLaunchEvent(undefined, 'invalid-random-xyz')).toBe(false);
    });

    it('correctly resolves upcoming or inactive events as pre-launch', () => {
      const upcomingEvent: QuestEvent = {
        id: 'evt-test-1',
        title: 'Upcoming Test Event',
        slug: 'upcoming-test',
        description: 'Test upcoming launch event',
        cityId: 'canton-oh',
        startTime: '2026-09-11T18:00:00Z',
        endTime: '2026-09-14T22:00:00Z',
        status: 'draft',
        currentPhase: 'day_1',
        isPaused: false,
        createdAt: new Date().toISOString(),
      };

      expect(isPreLaunchEvent(upcomingEvent, 'upcoming-test', '2026-08-18T00:00:00Z')).toBe(true);
    });
  });

  describe('Static Quest Proof Secrets Module & Zero-Dynamic-Require Guarantee', () => {
    it('provides statically bundled target code hashes without runtime filesystem reads', () => {
      const maps = getServerProofSecretMaps();
      expect(maps).toBeDefined();
      expect(maps.QUEST_TARGET_CODE_HASHES).toBeDefined();
      expect(maps.STEP_TARGET_CODE_HASHES).toBeDefined();
      expect(maps.SECRET_CODE_HASHES).toBeDefined();

      // Check known quest target hashes
      expect(getServerQuestTargetCode('qst-mckinley-cipher')).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(getServerQuestTargetCode('qst-aura-coffee-qr')).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(getServerQuestTargetCode('qst-palace-theatre-year')).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(getServerQuestTargetCode('qst-onesto-brass-motto')).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(getServerQuestTargetCode('qst-hof-legend-qr')).toMatch(/^sha256:[a-f0-9]{64}$/);

      // Check step target hashes
      expect(getServerQuestStepTargetCode('step-secret-founder-fragment')).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(getServerQuestStepTargetCode('step-secret-mural-fragment')).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(getServerQuestStepTargetCode('step-secret-brass-fragment')).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it('contains no dynamic eval("require") or process.cwd() calls in lib/game-engine.ts or lib/supabase-db.ts', () => {
      const gameEngineCode = fs.readFileSync(path.join(process.cwd(), 'lib/game-engine.ts'), 'utf8');
      const supabaseDbCode = fs.readFileSync(path.join(process.cwd(), 'lib/supabase-db.ts'), 'utf8');

      expect(gameEngineCode).not.toContain("eval('require')");
      expect(gameEngineCode).not.toContain('quest-proof-secrets.server.json');
      expect(supabaseDbCode).not.toContain("eval('require')");
      expect(supabaseDbCode).not.toContain('quest-proof-secrets.server.json');
    });
  });

  describe('Route File Audit for Zero Error Stack or Path Leakage', () => {
    it('verifies drawing API and event API routes never leak raw error stacks or /var/task', () => {
      const drawingRoute = fs.readFileSync(
        path.join(process.cwd(), 'app/api/game/events/[slug]/drawing/route.ts'),
        'utf8'
      );
      const eventRoute = fs.readFileSync(
        path.join(process.cwd(), 'app/api/game/events/[slug]/route.ts'),
        'utf8'
      );
      const drawingPage = fs.readFileSync(
        path.join(process.cwd(), 'app/events/[slug]/drawing/page.tsx'),
        'utf8'
      );

      // Ensure API catch blocks do not blindly pass raw error.message to client
      expect(drawingRoute).not.toContain('error.message ||');
      expect(drawingRoute).toContain('SYSTEM_TEMPORARILY_UNAVAILABLE');
      expect(drawingRoute).toContain('isPreLaunch');

      expect(eventRoute).not.toContain('error.message ||');
      expect(eventRoute).toContain('isPreLaunch');

      // Ensure drawing page contains safe boundary without rendering raw error strings
      expect(drawingPage).toContain('PRIZE DRAWING SYSTEM STANDBY');
      expect(drawingPage).toContain('SYSTEM TEMPORARILY UNAVAILABLE');
      expect(drawingPage).not.toContain('{error}');
    });

    it('verifies event and quest detail pages render intentional pre-launch state', () => {
      const eventHubPage = fs.readFileSync(path.join(process.cwd(), 'app/events/[slug]/page.tsx'), 'utf8');
      const questDetailPage = fs.readFileSync(
        path.join(process.cwd(), 'app/events/[slug]/quests/[questId]/page.tsx'),
        'utf8'
      );

      expect(eventHubPage).toContain('FounderCipherShell');
      expect(eventHubPage).toContain('isKnownCantonLaunchSlug');

      expect(questDetailPage).toContain('MISSION GRID OFFLINE');
      expect(questDetailPage).toContain('CANTON QUESTS ACTIVATES SEPTEMBER 11, 2026');
      expect(questDetailPage).toContain('isKnownCantonLaunchSlug');
    });
  });
});
