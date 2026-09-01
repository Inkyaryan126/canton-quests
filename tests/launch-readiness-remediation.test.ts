// Canton Quests — Launch-Readiness Remediation Regression Suite
//
// Regression coverage for the production audit remediation pass: prize/RPC
// lockdown migration content, the spectator "default-event" UUID bug, the
// signup-drawing-entry copy correction, register-page auto-scroll, the
// duplicate-callsign confirm-page prompt, robots.txt/sitemap.xml public
// routes, and continued Command Center XP consistency.

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import { GET as spectatorGET } from '../app/api/game/spectator/route';
import { resolveSpectatorEventId } from '../lib/spectator-db';
import { resetSpectatorStores } from '../lib/spectator-engine';
import robots from '../app/robots';
import sitemap from '../app/sitemap';

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8');
}

describe('Launch-readiness remediation', () => {
  beforeEach(() => {
    resetSpectatorStores();
  });

  describe('1. Prize/reward RPC privilege lockdown migration', () => {
    it('revokes anon/authenticated execute on the two prize-mutating RPCs and grants only service_role', () => {
      const migration = readFile('supabase/migrations/20260825120000_lock_down_reward_rpcs.sql');
      for (const fn of [
        'public.claim_quest_placement(UUID)',
        'public.increment_drawing_entries(UUID, UUID, UUID, INTEGER, UUID, TEXT, TEXT)',
      ]) {
        expect(migration).toContain(`REVOKE EXECUTE ON FUNCTION ${fn} FROM PUBLIC`);
        expect(migration).toContain(`REVOKE EXECUTE ON FUNCTION ${fn} FROM anon`);
        expect(migration).toContain(`REVOKE EXECUTE ON FUNCTION ${fn} FROM authenticated`);
        expect(migration).toContain(`GRANT EXECUTE ON FUNCTION ${fn} TO service_role`);
      }
    });

    it('pins the mutable search_path on validate_player_featured_badges', () => {
      const migration = readFile('supabase/migrations/20260825120000_lock_down_reward_rpcs.sql');
      expect(migration).toContain('ALTER FUNCTION public.validate_player_featured_badges() SET search_path = public');
    });

    it('guardrail: no migration after the lockdown re-grants these RPCs to anon/authenticated', () => {
      const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
      const files = fs.readdirSync(migrationsDir).filter((f) => f > '20260825120000' && f.endsWith('.sql'));
      for (const file of files) {
        const contents = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        expect(contents).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.claim_quest_placement.*TO\s+(anon|authenticated|PUBLIC)/is);
        expect(contents).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.increment_drawing_entries.*TO\s+(anon|authenticated|PUBLIC)/is);
      }
    });

    it('only the trusted service-role reward pipeline calls these RPCs — no anon/authenticated-client call site exists', () => {
      const dbSource = readFile('lib/supabase-db.ts');
      expect(dbSource).toContain("rpc('claim_quest_placement'");
      expect(dbSource).toContain("rpc('increment_drawing_entries'");
      // Both RPC calls live inside awardQuestRewardsDB, which requires supabaseAdmin (service-role).
      const fnStart = dbSource.indexOf('export async function awardQuestRewardsDB');
      const fnBody = dbSource.slice(fnStart, fnStart + 1500);
      expect(fnBody).toContain('if (!isSupabaseConfigured || !supabaseAdmin)');
      expect(fnBody).toContain("throw new Error('awardQuestRewardsDB requires Supabase service-role configuration.')");
    });
  });

  describe('2. Spectator "default-event" UUID bug', () => {
    it('resolveSpectatorEventId never returns the literal placeholder string "default-event"', async () => {
      const resolved = await resolveSpectatorEventId(null);
      expect(resolved).not.toBe('default-event');
      const resolvedFromPlaceholder = await resolveSpectatorEventId('default-event');
      expect(resolvedFromPlaceholder).not.toBe('default-event');
    });

    it('a caller-supplied real UUID is trusted as-is (not re-resolved)', async () => {
      const fakeUuid = '11111111-2222-3333-4444-555555555555';
      const resolved = await resolveSpectatorEventId(fakeUuid);
      expect(resolved).toBe(fakeUuid);
    });

    it('resolves the canonical Volume 1 event by its stable slug when no eventId is supplied', async () => {
      const resolved = await resolveSpectatorEventId(undefined);
      expect(resolved).toBeTruthy();
      expect(resolved).not.toBe('default-event');
    });

    it('GET /api/game/spectator with no eventId query param succeeds (200), never 500s on an invalid UUID', async () => {
      const req = new Request('http://localhost:3000/api/game/spectator?action=feed');
      const res = await spectatorGET(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.feed)).toBe(true);
    });

    it('GET events/broadcasts/settings/districts/stats all succeed with no eventId query param', async () => {
      for (const action of ['events', 'broadcasts', 'settings', 'districts', 'stats']) {
        const req = new Request(`http://localhost:3000/api/game/spectator?action=${action}`);
        const res = await spectatorGET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
      }
    });

    it('the spectator route source no longer defaults eventId to the literal "default-event" placeholder', () => {
      const routeSource = readFile('app/api/game/spectator/route.ts');
      expect(routeSource).not.toContain("|| 'default-event'");
      expect(routeSource).toContain('resolveSpectatorEventId');
    });
  });

  describe('3. No free-signup drawing-entry claims anywhere in public copy', () => {
    const FORBIDDEN = [/sign\s?up[^.]{0,40}(1\s+)?free\s+(drawing\s+)?entry/i, /sign\s?up[^.]{0,40}get[^.]{0,30}entry/i];

    const scannedFiles = [
      'app/page.tsx',
      'app/how-it-works/page.tsx',
      'app/register/page.tsx',
      'app/auth/confirm/page.tsx',
      'components/ThreePathSelector.tsx',
      'components/FastPlayerOnboardForm.tsx',
    ];

    it.each(scannedFiles)('%s contains no forbidden signup-implies-entry claim', (file) => {
      const source = readFile(file);
      for (const pattern of FORBIDDEN) {
        expect(source).not.toMatch(pattern);
      }
    });

    it('backend registration never grants a drawing entry on signup', () => {
      const registerRoute = readFile('app/api/auth/register/route.ts');
      expect(registerRoute).not.toMatch(/drawing_entry_ledger|drawingEntriesAwarded|entries_count/);
    });
  });

  describe('4. Register-page auto-scroll on path selection', () => {
    it('ThreePathSelector scrolls the onboarding form into view on selection, respecting prefers-reduced-motion', () => {
      const source = readFile('components/ThreePathSelector.tsx');
      expect(source).toContain('confirmationRef.current.scrollIntoView');
      expect(source).toContain("prefers-reduced-motion: reduce");
      expect(source).toContain("behavior: prefersReducedMotion ? 'auto' : 'smooth'");
      expect(source).toContain('confirmationRef');
    });

    it('focuses the first onboarding field without stealing focus from an already-filled field', () => {
      const source = readFile('components/ThreePathSelector.tsx');
      expect(source).toContain('onboard-callsign');
      expect(source).toContain('!firstField.value');
    });
  });

  describe('5. Callsign is not redundantly requested after email verification', () => {
    // Superseded: live production verification proved Supabase's real
    // "Confirm signup" email link carries type=email, not type=signup, so
    // gating on the URL's `type` never actually worked. The confirm page
    // now derives this from the server's needsCallsign response field
    // (computeNeedsCallsignPrompt in lib/supabase-auth.ts), which checks
    // the verified auth user's real user_metadata.display_name instead.
    it('the confirm page derives the callsign step from the server-computed needsCallsign field, not from the URL `type`', () => {
      const source = readFile('app/auth/confirm/page.tsx');
      expect(source).not.toMatch(/type !== 'signup'/);
      expect(source).toContain('data.needsCallsign && data.player');
    });

    it('computeNeedsCallsignPrompt is the shared source of truth, used by the confirm route', () => {
      const source = readFile('lib/supabase-auth.ts');
      expect(source).toContain('export function computeNeedsCallsignPrompt');
      const routeSource = readFile('app/api/auth/confirm/route.ts');
      expect(routeSource).toContain('computeNeedsCallsignPrompt(verifyRes.user, player)');
    });

    it('resolveOrCreatePlayerForAuthUser honors the callsign captured at registration via user_metadata before falling back to the email prefix', () => {
      const source = readFile('lib/supabase-auth.ts');
      const idx = source.indexOf('export async function resolveOrCreatePlayerForAuthUser');
      const body = source.slice(idx, idx + 2000);
      expect(body).toContain('authUser.user_metadata?.display_name');
      // The metadata fallback must come before the email-prefix fallback.
      expect(body.indexOf('authUser.user_metadata?.display_name')).toBeLessThan(body.indexOf("authUser.email?.split('@')[0]"));
    });

    it('signUpWithPassword persists the chosen callsign into Supabase Auth user_metadata at registration time', () => {
      const source = readFile('lib/supabase-auth.ts');
      const idx = source.indexOf('export async function signUpWithPassword');
      const body = source.slice(idx, idx + 1500);
      expect(body).toContain('display_name: cleanDisplayName');
    });
  });

  describe('6. Command Center XP consistency (continued regression)', () => {
    it('stats.totalXp is still sourced from the authoritative player.totalXp field', () => {
      const routeSource = readFile('app/api/player/command-center/route.ts');
      expect(routeSource).toMatch(/totalXp:\s*player\.totalXp/);
      expect(routeSource).not.toMatch(/stats:\s*\{\s*totalXp:\s*progress\.totalPoints/);
    });
  });

  describe('7. robots.txt / sitemap.xml', () => {
    it('robots.ts points to the canonical sitemap and allows public pages', () => {
      const result = robots();
      expect(result.sitemap).toBe('https://www.cantonquests.com/sitemap.xml');
      const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
      expect(rules?.allow).toBe('/');
    });

    it('robots.ts disallows admin/API surfaces', () => {
      const result = robots();
      const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules;
      const disallow = Array.isArray(rules?.disallow) ? rules?.disallow : [rules?.disallow];
      expect(disallow).toEqual(expect.arrayContaining(['/api/', expect.stringContaining('/admin')]));
    });

    it('sitemap.ts includes every required public route with the canonical production base URL', () => {
      const entries = sitemap();
      const urls = entries.map((e) => e.url);
      const expectedPaths = [
        '/',
        '/quests',
        '/leaderboard',
        '/how-it-works',
        '/register',
        '/login',
        '/watch',
        '/events',
        '/events/canton-weekend-1',
        '/events/canton-weekend-1/drawing',
      ];
      for (const p of expectedPaths) {
        expect(urls).toContain(`https://www.cantonquests.com${p}`);
      }
    });

    it('sitemap.ts never includes an admin or API route', () => {
      const entries = sitemap();
      for (const entry of entries) {
        expect(entry.url).not.toMatch(/\/admin/);
        expect(entry.url).not.toMatch(/\/api\//);
      }
    });
  });

  describe('8. Public quest_steps view is narrowed to active quests only', () => {
    it('the view migration filters by quest status = active, matching public_quests', () => {
      const migration = readFile('supabase/migrations/20260825130000_narrow_public_quest_steps_view.sql');
      expect(migration).toContain("WHERE q.status = 'active'");
      expect(migration).toContain('GRANT SELECT ON public.public_quest_steps TO anon, authenticated');
    });
  });

  describe('9. Seed endpoint is no longer wide open in production', () => {
    it('the seed route rejects production and requires Game Master authorization', () => {
      const source = readFile('app/api/game/seed/route.ts');
      expect(source).toContain("process.env.NODE_ENV === 'production'");
      expect(source).toContain('authorizeGameMasterRequest');
    });
  });
});
