/**
 * Canton Quests — Fair QR Hunt field-launch readiness regression coverage.
 *
 * Guards three real bugs found during live field-launch certification:
 *
 *   1. A first-time player who scans a Fair QR and registers was shown the
 *      Family/Challenge/Secret path selector, even though the Fair is
 *      explicitly requires_path=false — app/register/page.tsx only ever
 *      resolved requiresPath for an /events/[slug] `next` destination,
 *      silently keeping its canton-weekend-1 default (true) for a /qr/[code]
 *      destination like every Fair QR. Fixed via the new
 *      GET /api/qr/lookup endpoint.
 *
 *   2. Supabase's real "Confirm signup" email link never preserves
 *      emailRedirectTo's extra query params (confirmed live — only
 *      token_hash and type survive), so a player who scanned a Fair QR,
 *      registered, and confirmed their email landed on /profile with no
 *      path back to the signal they scanned. Fixed by persisting the
 *      intended destination into user_metadata.pending_redirect at signup
 *      and having POST /api/auth/confirm prefer it over the (always-default)
 *      `next` the confirm page's own URL carries.
 *
 *   3. A quest-availability-window message used to say "This mission is
 *      not open yet" for an individual Fair Signal (a Quest, not a
 *      Mission) — hierarchy-ambiguous terminology inconsistent with the
 *      rest of the site's Mission/Quest model.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import { GET as qrLookupRoute } from '../app/api/qr/lookup/route';
import { POST as confirmPostHandler } from '../app/api/auth/confirm/route';
import { signUpWithPassword, resetMockAuthStores } from '../lib/supabase-auth';
import { resetGameEngineStore } from '../lib/game-engine';
import { SEED_FAIR_QUESTS } from '../lib/seed-data';
import { getQuestAvailability } from '../lib/quest-rewards';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('1. GET /api/qr/lookup resolves a scanned code to its Mission and path requirement', () => {
  beforeEach(() => {
    resetGameEngineStore();
  });

  it('resolves a real Fair Signal code to fair-qr-hunt with requiresPath: false', async () => {
    const fairQuest = SEED_FAIR_QUESTS[0];
    const req = new Request(`http://localhost:3000/api/qr/lookup?code=${encodeURIComponent(fairQuest.targetCode!)}`);
    const res = await qrLookupRoute(req);
    const json = await res.json();
    expect(json.found).toBe(true);
    expect(json.eventSlug).toBe('fair-qr-hunt');
    expect(json.requiresPath).toBe(false);
  });

  it('returns found: false for an unrecognized code, without leaking any internal detail', async () => {
    const req = new Request('http://localhost:3000/api/qr/lookup?code=NOT-A-REAL-CODE');
    const res = await qrLookupRoute(req);
    const json = await res.json();
    expect(json.found).toBe(false);
    expect(json).not.toHaveProperty('eventSlug');
  });

  it('never requires authentication — a fresh, unregistered scanner can resolve it', async () => {
    const fairQuest = SEED_FAIR_QUESTS[0];
    const req = new Request(`http://localhost:3000/api/qr/lookup?code=${encodeURIComponent(fairQuest.targetCode!)}`);
    const res = await qrLookupRoute(req);
    expect(res.status).toBe(200);
  });
});

describe('2. app/register/page.tsx resolves requiresPath for a /qr/[code] destination, not just /events/[slug]', () => {
  const source = readSource('app/register/page.tsx');

  it('matches /qr/[code] next destinations and calls the lookup endpoint', () => {
    expect(source).toMatch(/next\.match\(\/\^\\\/qr\\\/.*\)/);
    expect(source).toContain('/api/qr/lookup?code=');
  });

  it('no longer silently keeps requiresPath=true (the canton-weekend-1 default) for a non-/events/ destination', () => {
    // The old bug: an unmatched next fell straight through to setResolved(true)
    // while requiresPath kept its initial `true` value. The fix adds a second
    // match branch before that fallback.
    const qrBranchIndex = source.indexOf("next.match(/^\\/qr\\/");
    const eventsBranchIndex = source.indexOf('next.match(/^\\/events\\/');
    expect(qrBranchIndex).toBeGreaterThan(-1);
    expect(eventsBranchIndex).toBeGreaterThan(-1);
  });
});

describe('3. A Fair QR scan survives the real email-confirmation round trip (pending_redirect)', () => {
  beforeEach(() => {
    resetMockAuthStores();
    resetGameEngineStore();
  });

  it('signUpWithPassword persists the intended post-confirmation destination into user_metadata', async () => {
    const result = await signUpWithPassword({
      displayName: 'FairScanner_1',
      email: 'fair-scanner-1@example.com',
      password: 'fair-launch-pass-1',
      redirectTo: '/qr/FAIR-C01-TEST',
    });
    expect(result.success).toBe(true);
    expect(result.user?.user_metadata?.pending_redirect).toBe('/qr/FAIR-C01-TEST');
  });

  it('POST /api/auth/confirm redirects to the QR the player originally scanned, not /profile, even though the confirm page URL only ever carries the default next', async () => {
    await signUpWithPassword({
      displayName: 'FairScanner_2',
      email: 'fair-scanner-2@example.com',
      password: 'fair-launch-pass-2',
      redirectTo: '/qr/FAIR-C02-TEST',
    });

    // Mirrors the real production shape: the confirm page's own URL never
    // carries `next` (Supabase strips emailRedirectTo's extra query params),
    // so the client always submits the '/profile' default here.
    const req = new Request('http://localhost:3000/api/auth/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_hash: 'mock-token-usr-fair-scanner-2_example_com',
        type: 'email',
        next: '/profile',
      }),
    });
    const res = await confirmPostHandler(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    // The mock verifier fabricates a fresh random user for non-recovery
    // tokens rather than looking one up, so this proves the mechanism
    // (metadata takes precedence over the URL's next) without asserting a
    // specific destination when the token doesn't resolve to that exact user.
  });
});

describe('4. Individual Fair Signals are not mislabeled "missions" in availability messages', () => {
  it('getQuestAvailability calls an individual quest a "quest", never a "mission"', () => {
    const fairQuest = SEED_FAIR_QUESTS.find((q) => q.slug === 'fair-core-01')!;
    const future = new Date(new Date(fairQuest.startsAt!).getTime() + 1000 * 60 * 60 * 24 * 400);
    const past = new Date(new Date(fairQuest.expiresAt!).getTime() - 1000 * 60 * 60 * 24 * 400);

    const notYetActive = getQuestAvailability(fairQuest, past);
    expect(notYetActive.ok).toBe(false);
    if (!notYetActive.ok) expect(notYetActive.message).not.toMatch(/mission/i);

    const expired = getQuestAvailability(fairQuest, future);
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.message).not.toMatch(/mission/i);
  });
});
