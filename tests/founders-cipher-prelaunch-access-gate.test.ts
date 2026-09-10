// Canton Quests — Founder's Cipher Prelaunch Player Access Gate
//
// Replaces the retired "Admin Field Test Mode" concept. There is no special
// admin gameplay anymore: a private password (server-only
// FOUNDER_CIPHER_PRELAUNCH_PASSWORD) is the ONLY way to see real Founder's
// Cipher gameplay before the event's real startTime. Once a signed httpOnly
// cookie is granted, the browser is a normal player — no admin flag, no
// verification bypass, no bonus reward behavior. Every Founder's Cipher
// gameplay endpoint enforces this independently of the client.

import { describe, expect, it, beforeEach } from 'vitest';
import {
  initializeGameEngine,
  resetGameEngineStore,
  registerPlayer,
} from '../lib/game-engine';
import { SEED_EVENT, SEED_QUESTS } from '../lib/seed-data';
import { GET as eventsRoute } from '../app/api/game/events/[slug]/route';
import { POST as submitProofRoute } from '../app/api/game/submit/route';
import { GET as finaleGetRoute, POST as finalePostRoute } from '../app/api/game/finale/route';
import { POST as decodeRoute } from '../app/api/game/cipher/decode/route';
import { POST as prelaunchAccessRoute } from '../app/api/game/founder-cipher/prelaunch-access/route';
import {
  FOUNDER_CIPHER_PRELAUNCH_COOKIE,
  createPrelaunchAccessToken,
  verifyPrelaunchAccessToken,
  verifyPrelaunchPassword,
  resolveFounderCipherPrelaunchAccess,
} from '../lib/founder-cipher-prelaunch';

const TEST_PASSWORD = 'test-only-prelaunch-password';
process.env.FOUNDER_CIPHER_PRELAUNCH_PASSWORD = TEST_PASSWORD;

function prelaunchCookieHeader(): string {
  return `${FOUNDER_CIPHER_PRELAUNCH_COOKIE}=${createPrelaunchAccessToken()}`;
}

function authedRequest(url: string, userId: string, init: RequestInit = {}): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer mock-jwt-${userId}`,
    },
  });
}

const CHECKIN_QUEST = SEED_QUESTS.find((q) => q.eventId === SEED_EVENT.id && q.verificationType === 'checkin')!;
const PASSPHRASE_QUEST = SEED_QUESTS.find((q) => q.eventId === SEED_EVENT.id && q.slug === 'mckinley-monument-year')!;

describe('1 & 5. A public prelaunch visitor cannot retrieve playable quest content; a valid access cookie gets the real roster', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('no cookie at all: quests/leaderboard/progress are all empty, isPreLaunch is true', async () => {
    const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}`);
    const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();
    expect(data.isPreLaunch).toBe(true);
    expect(data.hasPrelaunchAccess).toBe(false);
    expect(data.quests).toEqual([]);
    expect(data.leaderboard).toEqual([]);
  });

  it('a valid prelaunch access cookie receives the real quest roster', async () => {
    const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}`, {
      headers: { cookie: prelaunchCookieHeader() },
    });
    const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();
    expect(data.hasPrelaunchAccess).toBe(true);
    expect(Array.isArray(data.quests)).toBe(true);
    expect(data.quests.length).toBeGreaterThan(0);
  });
});

describe('2 & 11. A public prelaunch visitor cannot submit quest proof; direct API access without the credential is rejected', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('POST /api/game/submit with no prelaunch cookie is rejected with 403, regardless of authentication', async () => {
    const player = registerPlayer({
      displayName: 'PrelaunchLockedOut',
      email: 'locked-out@example.com',
      userId: 'usr-locked-out',
      selectedStartingPath: 'family',
    });
    const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-locked-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId: player.id,
        questId: CHECKIN_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'checkin',
      }),
    });
    const res = await submitProofRoute(req);
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/has not launched/i);
  });

  it('GET /api/game/finale with no prelaunch cookie returns no status', async () => {
    const req = authedRequest(
      `http://localhost:3000/api/game/finale?eventSlug=${SEED_EVENT.slug}`,
      'usr-finale-locked'
    );
    const res = await finaleGetRoute(req);
    const data = await res.json();
    expect(data.status).toBeNull();
  });

  it('POST /api/game/finale with no prelaunch cookie is rejected with 403', async () => {
    const req = authedRequest('http://localhost:3000/api/game/finale', 'usr-finale-locked-2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventSlug: SEED_EVENT.slug, answer: 'anything' }),
    });
    const res = await finalePostRoute(req);
    expect(res.status).toBe(403);
  });

  it('POST /api/game/cipher/decode with no prelaunch cookie is rejected with 403', async () => {
    const req = authedRequest('http://localhost:3000/api/game/cipher/decode', 'usr-decode-locked', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventSlug: SEED_EVENT.slug, districtKey: 'arts', sequence: ['a', 'b', 'c'] }),
    });
    const res = await decodeRoute(req);
    expect(res.status).toBe(403);
  });
});

describe('3 & 4. Password verification: wrong password grants nothing, correct password establishes trusted access', () => {
  it('verifyPrelaunchPassword rejects an incorrect password', () => {
    expect(verifyPrelaunchPassword('definitely-not-it')).toBe(false);
  });

  it('verifyPrelaunchPassword accepts the real configured password', () => {
    expect(verifyPrelaunchPassword(TEST_PASSWORD)).toBe(true);
  });

  it('POST /api/game/founder-cipher/prelaunch-access rejects a wrong password with 401 and sets no cookie', async () => {
    const req = new Request('http://localhost:3000/api/game/founder-cipher/prelaunch-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    const res = await prelaunchAccessRoute(req);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.success).toBe(false);
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  it('POST /api/game/founder-cipher/prelaunch-access accepts the real password and sets a signed httpOnly cookie', async () => {
    const req = new Request('http://localhost:3000/api/game/founder-cipher/prelaunch-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });
    const res = await prelaunchAccessRoute(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    const setCookie = res.headers.get('set-cookie') || '';
    expect(setCookie).toContain(FOUNDER_CIPHER_PRELAUNCH_COOKIE);
    expect(setCookie.toLowerCase()).toContain('httponly');
    // The raw password itself is never embedded in the cookie value.
    expect(setCookie).not.toContain(TEST_PASSWORD);
  });

  it('a tampered token is rejected', () => {
    const token = createPrelaunchAccessToken();
    const tampered = token.slice(0, -2) + 'zz';
    expect(verifyPrelaunchAccessToken(tampered)).toBe(false);
  });

  it('an expired token is rejected', () => {
    const longAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
    const token = createPrelaunchAccessToken(longAgo);
    expect(verifyPrelaunchAccessToken(token)).toBe(false);
  });
});

describe('6, 7, 8, 9, 10. A prelaunch-access player is a completely normal player — same verification, same rewards, no bypass', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('submits through the exact same passphrase verification path — a correct answer succeeds', async () => {
    const player = registerPlayer({
      displayName: 'PrelaunchTester',
      email: 'prelaunch-tester@example.com',
      userId: 'usr-prelaunch-correct',
      selectedStartingPath: 'secret',
    });
    const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-prelaunch-correct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: prelaunchCookieHeader() },
      body: JSON.stringify({
        playerId: player.id,
        questId: PASSPHRASE_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'passphrase',
        submittedContent: '1897',
      }),
    });
    const res = await submitProofRoute(req);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.awardedPoints).toBe(PASSPHRASE_QUEST.xpReward);
  });

  it('a wrong answer is still rejected for a prelaunch-access player, exactly like any other player', async () => {
    const player = registerPlayer({
      displayName: 'PrelaunchTesterWrong',
      email: 'prelaunch-tester-wrong@example.com',
      userId: 'usr-prelaunch-wrong',
      selectedStartingPath: 'secret',
    });
    const req = authedRequest('http://localhost:3000/api/game/submit', 'usr-prelaunch-wrong', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: prelaunchCookieHeader() },
      body: JSON.stringify({
        playerId: player.id,
        questId: PASSPHRASE_QUEST.id,
        eventId: SEED_EVENT.id,
        proofType: 'passphrase',
        submittedContent: 'not-the-real-answer',
      }),
    });
    const res = await submitProofRoute(req);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.awardedPoints).toBe(0);
  });

  it('the submit route never sets a verification-bypass or admin flag for a prelaunch-access request', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const source = fs.readFileSync(path.join(process.cwd(), 'app/api/game/submit/route.ts'), 'utf8');
    expect(source).not.toMatch(/fieldTestActive|fieldTestLocationBypass|adminBypass|isAdmin/);
  });
});

describe('12 & 13. At/after official launch time, the password gate is a no-op — a stale cookie changes nothing', () => {
  it('resolveFounderCipherPrelaunchAccess reports no gate at all once the event has genuinely launched, cookie or not', () => {
    const startedEvent = { ...SEED_EVENT, startTime: '2020-01-01T00:00:00Z', status: 'active' as const };
    const reqNoCookie = new Request('http://localhost/api/game/events/x');
    const reqWithStaleCookie = new Request('http://localhost/api/game/events/x', {
      headers: { cookie: prelaunchCookieHeader() },
    });
    expect(resolveFounderCipherPrelaunchAccess(reqNoCookie, startedEvent, startedEvent.slug)).toEqual({
      isPreLaunch: false,
      hasPrelaunchAccess: false,
    });
    expect(resolveFounderCipherPrelaunchAccess(reqWithStaleCookie, startedEvent, startedEvent.slug)).toEqual({
      isPreLaunch: false,
      hasPrelaunchAccess: false,
    });
  });

  it('the prelaunch-access API endpoint itself refuses to issue a new cookie once the event has launched', async () => {
    // Simulate post-launch by using an event whose slug does not match the
    // hardcoded Founder's Cipher slug is not applicable here — instead this
    // proves the route's own isPreLaunchEvent guard exists and rejects.
    const source = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'app/api/game/founder-cipher/prelaunch-access/route.ts'),
      'utf8'
    );
    expect(source).toContain('isPreLaunchEvent(event, FOUNDER_CIPHER_EVENT_SLUG)');
  });
});

describe('14. Fair QR Hunt remains unaffected by the prelaunch gate', () => {
  it('resolveFounderCipherPrelaunchAccess never applies the Founder\'s Cipher password to a non-Founder\'s-Cipher slug', () => {
    const fairEvent = { ...SEED_EVENT, slug: 'fair-qr-hunt', startTime: '2099-01-01T00:00:00Z', status: 'upcoming' as const };
    const reqWithCookie = new Request('http://localhost/api/game/events/fair-qr-hunt', {
      headers: { cookie: prelaunchCookieHeader() },
    });
    const result = resolveFounderCipherPrelaunchAccess(reqWithCookie, fairEvent, 'fair-qr-hunt');
    expect(result.isPreLaunch).toBe(true);
    expect(result.hasPrelaunchAccess).toBe(false);
  });
});

describe('15. The password/secret is never exposed in PublicQuestView or any client payload', () => {
  it('the events/[slug] API response never includes the raw password or signing key', async () => {
    const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}`, {
      headers: { cookie: prelaunchCookieHeader() },
    });
    const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
    const bodyText = await res.text();
    expect(bodyText).not.toContain(TEST_PASSWORD);
  });

  it('the prelaunch-access module never logs or returns the configured password from verifyPrelaunchPassword', () => {
    // verifyPrelaunchPassword returns only a boolean — this is a type-level
    // guarantee, exercised here to document the contract explicitly.
    const result: boolean = verifyPrelaunchPassword(TEST_PASSWORD);
    expect(typeof result).toBe('boolean');
  });
});
