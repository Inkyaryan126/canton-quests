/**
 * Canton Quests — New-Player Onboarding Bug Fixes
 *
 * Focused regression coverage for four specific onboarding bugs:
 *   1. Selecting a starting path on /register must scroll the signup form
 *      into view and move focus to it (ThreePathSelector.tsx) — never
 *      before selection, and non-animated when prefers-reduced-motion.
 *   2. A callsign chosen at initial signup must be preserved through email
 *      verification, not re-asked (lib/supabase-auth.ts
 *      resolveOrCreatePlayerForAuthUser + app/auth/confirm/page.tsx).
 *   3. The Player Card must reflect server-confirmed XP immediately after
 *      the Profile Completion reward — through the real
 *      POST /api/player/profile -> GET /api/player/command-center refetch
 *      cycle, not a client-side guess.
 *   4. No copy in the signup/onboarding flow may imply account creation
 *      alone earns a free drawing entry / Entry Token.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import {
  signUpWithPassword,
  resolveOrCreatePlayerForAuthUser,
  computeNeedsCallsignPrompt,
  resetMockAuthStores,
  type AuthSessionUser,
} from '../lib/supabase-auth';
import { POST as loginHandler } from '../app/api/auth/login/route';
import { POST as confirmPostHandler } from '../app/api/auth/confirm/route';
import { GET as commandCenterHandler } from '../app/api/player/command-center/route';
import { POST as profilePostHandler } from '../app/api/player/profile/route';
import * as localEngine from '../lib/game-engine';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

/** Strips // and /* *\/ comments so guardrail comments about what NOT to say don't self-trigger a false-claim scan. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

describe('Bug 1 — Starting path selection scrolls the signup form into view', () => {
  const source = readSource('components/ThreePathSelector.tsx');

  it('scrolls the confirmation/signup panel into view only after a path is selected', () => {
    // Guarded on selectedPath — never runs before the user picks a door.
    expect(source).toMatch(/useEffect\(\(\) => \{\s*if \(!selectedPath \|\| !confirmationRef\.current\) return;/);
    expect(source).toContain('scrollIntoView({');
  });

  it('uses non-animated scrolling when prefers-reduced-motion is set', () => {
    expect(source).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(source).toMatch(/behavior:\s*prefersReducedMotion\s*\?\s*'auto'\s*:\s*'smooth'/);
  });

  it('moves keyboard focus to the first signup field without stealing focus from an already-typing user', () => {
    expect(source).toContain("querySelector<HTMLInputElement>('#onboard-callsign')");
    expect(source).toMatch(/document\.activeElement !== firstField && !firstField\.value/);
  });

  it('never hides the signup form behind a viewport/breakpoint check — same DOM structure at every size', () => {
    expect(source).not.toMatch(/hidden\s+(sm|md|lg):/);
    expect(source).not.toMatch(/display:\s*['"]none['"]/);
    // The confirmation panel (and the form inside it) renders unconditionally
    // once a path is selected — not gated on window width.
    expect(source).not.toMatch(/window\.innerWidth/);
  });
});

describe('Bug 2 — Callsign is collected once, not twice', () => {
  beforeEach(() => {
    resetMockAuthStores();
    localEngine.resetGameEngineStore();
  });

  it('preserves the callsign chosen at initial signup through verification, even if the confirm-page field is left blank', async () => {
    const authUser: AuthSessionUser = {
      id: 'usr-bug2-preserve-callsign',
      email: 'preserve-callsign@example.com',
      user_metadata: { display_name: 'ApexHunter_330' },
    };

    const player = await resolveOrCreatePlayerForAuthUser(authUser, { displayName: undefined });
    expect(player.displayName).toBe('ApexHunter_330');
  });

  it('never lets a stray confirm-page value override the callsign already chosen at signup', async () => {
    const authUser: AuthSessionUser = {
      id: 'usr-bug2-precedence',
      email: 'precedence@example.com',
      user_metadata: { display_name: 'OriginalCallsign' },
    };

    const player = await resolveOrCreatePlayerForAuthUser(authUser, { displayName: 'ShouldNeverWin' });
    expect(player.displayName).toBe('OriginalCallsign');
  });

  it('falls back to the confirm-page callsign only when no callsign exists yet (passwordless magic-link/OTP signup)', async () => {
    const authUser: AuthSessionUser = {
      id: 'usr-bug2-otp-recovery',
      email: 'otp-recovery@example.com',
      user_metadata: {},
    };

    const player = await resolveOrCreatePlayerForAuthUser(authUser, { displayName: 'NeonVoyager' });
    expect(player.displayName).toBe('NeonVoyager');
  });

  it('a full password signup carries its callsign into the created player without a second prompt', async () => {
    const result = await signUpWithPassword({
      displayName: 'CipherRunner_77',
      email: 'cipher-runner-77@example.com',
      password: 'secure-password-456',
      selectedStartingPath: 'secret',
    });

    expect(result.success).toBe(true);
    expect(result.player?.displayName).toBe('CipherRunner_77');
  });

  describe('computeNeedsCallsignPrompt — the real decision signal, not the email link\'s `type`', () => {
    it('regression: a real production password-signup confirmation link (type=email, NOT type=signup) never triggers the prompt', async () => {
      // This is the exact shape production actually sends — confirmed via
      // live Vercel logs: Supabase's "Confirm signup" email uses
      // type=email, not type=signup. computeNeedsCallsignPrompt doesn't
      // even accept a `type` parameter, so it cannot regress on this again.
      const authUser: AuthSessionUser = {
        id: 'usr-real-prod-shape',
        email: 'real-prod-shape@example.com',
        user_metadata: { display_name: 'RealCallsign_42' },
      };
      const player = await resolveOrCreatePlayerForAuthUser(authUser, {});
      expect(computeNeedsCallsignPrompt(authUser, player)).toBe(false);
    });

    it('prompts for a callsign when the account genuinely never collected one (passwordless magic-link/OTP)', async () => {
      const authUser: AuthSessionUser = {
        id: 'usr-otp-needs-callsign',
        email: 'otp-needs-callsign@example.com',
        user_metadata: {},
      };
      const player = await resolveOrCreatePlayerForAuthUser(authUser, {});
      expect(player.displayName).toBe('otp-needs-callsign');
      expect(computeNeedsCallsignPrompt(authUser, player)).toBe(true);
    });

    it('does not re-prompt an existing player who already has a real, non-fallback name', async () => {
      const authUser: AuthSessionUser = {
        id: 'usr-existing-real-name',
        email: 'existing-real-name@example.com',
        user_metadata: {},
      };
      const player = { displayName: 'AlreadyCuratedName', id: 'plr-x' } as any;
      expect(computeNeedsCallsignPrompt(authUser, player)).toBe(false);
    });
  });

  describe('confirm page derives the prompt from the server response, never from the email link\'s `type`', () => {
    const source = readSource('app/auth/confirm/page.tsx');

    it('gates the callsign step on data.needsCallsign, not on the `type` query param', () => {
      expect(source).not.toMatch(/type !== 'signup'/);
      expect(source).toContain('data.needsCallsign && data.player');
      expect(source).toContain('setAwaitingCallsign(');
    });

    it('still offers a callsign field, with a skip option, only in the post-verification step', () => {
      expect(source).toContain('confirm-callsign-input');
      expect(source).toContain('handleSkipCallsign');
      expect(source).toContain('Skip for now');
    });

    it('a normal password-signup verification (no needsCallsign) proceeds straight through with no extra step', () => {
      expect(source).toContain('proceedToGame(data.player, targetDestination);');
    });
  });

  describe('confirm route computes needsCallsign from server-side state via computeNeedsCallsignPrompt', () => {
    const routeSource = readSource('app/api/auth/confirm/route.ts');

    it('imports and calls the shared helper rather than re-deriving from `type`', () => {
      expect(routeSource).toContain('computeNeedsCallsignPrompt');
      expect(routeSource).toContain('computeNeedsCallsignPrompt(verifyRes.user, player)');
    });

    it('the confirm route returns needsCallsign: true for a verified account with no real callsign (integration, via the mock auth verifier)', async () => {
      const req = new Request('http://localhost:3000/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: 'mock-token-no-callsign', type: 'email', next: '/profile' }),
      });
      const res = await confirmPostHandler(req);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.needsCallsign).toBe(true);
    });
  });

  describe('the server resolves one authoritative name, preferring the value already saved at signup', () => {
    const source = readSource('lib/supabase-auth.ts');

    it('checks user_metadata.display_name before the confirm-page-submitted value', () => {
      const match = source.match(/const cleanName = \(\s*([\s\S]{0,200}?)\)\.trim\(\);/);
      expect(match).not.toBeNull();
      const body = match![1];
      const metaIndex = body.indexOf('authUser.user_metadata?.display_name');
      const paramsIndex = body.indexOf('params?.displayName');
      expect(metaIndex).toBeGreaterThanOrEqual(0);
      expect(paramsIndex).toBeGreaterThan(metaIndex);
    });
  });
});

describe('Bug 3 — Player Card reflects server-confirmed XP immediately after the reward', () => {
  beforeEach(() => {
    resetMockAuthStores();
    localEngine.resetGameEngineStore();
  });

  async function registerAndLogin(email: string, displayName: string) {
    await signUpWithPassword({
      displayName,
      email,
      password: 'onboarding-bug-pass-1',
    });

    const loginRes = await loginHandler(new Request('https://www.cantonquests.com/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'password_login', email, password: 'onboarding-bug-pass-1' }),
    }));
    const loginJson = await loginRes.json();
    const cookie = [
      `sb-access-token=${loginJson.session.access_token}`,
      `sb-refresh-token=${loginJson.session.refresh_token}`,
    ].join('; ');
    return { cookie, playerId: loginJson.player.id as string };
  }

  it('5/6/7. profile save that completes identity returns the newly-granted +100 XP, and a fresh Player Card refetch shows the same authoritative total', async () => {
    const { cookie, playerId } = await registerAndLogin('cardxp@example.com', 'CardXpTester');

    const before = await commandCenterHandler(new Request('https://www.cantonquests.com/api/player/command-center', { headers: { cookie } }));
    const beforeJson = await before.json();
    expect(beforeJson.stats.totalXp).toBe(0);

    const saveRes = await profilePostHandler(new Request('https://www.cantonquests.com/api/player/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ playerId, avatarPresetKey: '2' }),
    }));
    const saveJson = await saveRes.json();
    expect(saveJson.success).toBe(true);
    expect(saveJson.profileCompletionReward).toBe(true);
    expect(saveJson.profileCompletionXp).toBe(100);
    expect(saveJson.player.totalXp).toBe(100);

    // The page's own refetch (loadCommandCenter) after the save — this is
    // the actual value the Player Card renders, read fresh from the server.
    const after = await commandCenterHandler(new Request('https://www.cantonquests.com/api/player/command-center', { headers: { cookie } }));
    const afterJson = await after.json();
    expect(afterJson.stats.totalXp).toBe(100);
    expect(afterJson.player.totalXp).toBe(100);

    // Refresh again — still the same authoritative number, no drift.
    const refreshed = await commandCenterHandler(new Request('https://www.cantonquests.com/api/player/command-center', { headers: { cookie } }));
    const refreshedJson = await refreshed.json();
    expect(refreshedJson.stats.totalXp).toBe(100);
  });

  it('8. the reward is granted at most once — a second qualifying-looking save reports no new grant, so the client never re-fires the cinematic', async () => {
    const { cookie, playerId } = await registerAndLogin('nodouble@example.com', 'NoDoubleFire');

    const first = await profilePostHandler(new Request('https://www.cantonquests.com/api/player/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ playerId, avatarPresetKey: '4' }),
    }));
    const firstJson = await first.json();
    expect(firstJson.profileCompletionReward).toBe(true);

    const second = await profilePostHandler(new Request('https://www.cantonquests.com/api/player/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ playerId, displayName: 'NoDoubleFireRenamed' }),
    }));
    const secondJson = await second.json();
    expect(secondJson.profileCompletionReward).toBe(false);
    expect(secondJson.player.totalXp).toBe(100);
  });

  it('9. no Entry Token / drawing entry is created by the profile-completion save', async () => {
    const { cookie, playerId } = await registerAndLogin('noentry@example.com', 'NoEntryTester');

    await profilePostHandler(new Request('https://www.cantonquests.com/api/player/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ playerId, avatarPresetKey: '5' }),
    }));

    const commandRes = await commandCenterHandler(new Request('https://www.cantonquests.com/api/player/command-center', { headers: { cookie } }));
    const commandJson = await commandRes.json();
    expect(commandJson.stats.prizeEntries).toBe(0);
  });

  describe('the client only fires the reward cinematic on a genuinely new server-confirmed grant', () => {
    const source = readSource('app/profile/page.tsx');

    it('early-returns unless payload.profileCompletionReward is true — never inferred from form state', () => {
      const guardMatch = source.match(/function announceProfileCompletion\([^)]*\)\s*\{\s*if\s*\(!payload\.profileCompletionReward\)\s*return;/);
      expect(guardMatch).not.toBeNull();
    });

    it('refetches the authoritative player (loadCommandCenter) after every profile-completing action, so the Player Card never renders a client-side guess', () => {
      const saveBlock = source.slice(source.indexOf('const saveProfile'), source.indexOf('const handleFileChosen'));
      expect(saveBlock).toContain('announceProfileCompletion(payload)');
      expect(saveBlock).toContain('await loadCommandCenter()');

      const uploadBlock = source.slice(source.indexOf('const handleFileChosen'), source.indexOf('const removePhoto'));
      expect(uploadBlock).toContain('announceProfileCompletion(payload)');
      expect(uploadBlock).toContain('await loadCommandCenter()');
    });
  });
});

describe('Bug 4 — No copy in signup/onboarding implies a free drawing entry for account creation', () => {
  const scannedFiles = [
    'components/FastPlayerOnboardForm.tsx',
    'components/spectator/EnterGameModal.tsx',
    'components/ThreePathSelector.tsx',
    'app/register/page.tsx',
    'app/auth/confirm/page.tsx',
  ];

  it('never claims or implies signup/registration earns a drawing entry, prize entry, or Entry Token', () => {
    const falseClaimPattern = /(free\s+(drawing\s+)?entry)|(sign.?up.{0,40}(drawing\s+)?entry)|(regist(er|ration).{0,40}(drawing\s+)?entry)|(every\s+(verified\s+)?(player|account).{0,40}entry)/i;
    for (const file of scannedFiles) {
      const source = stripComments(readSource(file));
      expect(source).not.toMatch(falseClaimPattern);
    }
  });

  it('no longer labels the signup email field as being "for prizes" — email is collected for verification only', () => {
    const formSource = readSource('components/FastPlayerOnboardForm.tsx');
    const modalSource = readSource('components/spectator/EnterGameModal.tsx');
    expect(formSource).not.toMatch(/Prizes/);
    expect(modalSource).not.toMatch(/Prizes/);
  });

  it('the confirm-page rules footer accurately ties drawing entries to quest completion, not account creation', () => {
    const source = readSource('app/auth/confirm/page.tsx');
    expect(source).toMatch(/account creation alone doesn(&apos;|')t/i);
  });

  it('how-it-works accurately states 0 drawing entries for signup and for profile completion', () => {
    const source = readSource('app/how-it-works/page.tsx');
    expect(source).toMatch(/Creating an account is free and gives 0 drawing entries/);
    // Allow the natural JSX line-wrap whitespace (including a newline)
    // between "still" and "0 entries" — the rendered page collapses this to
    // a single space, so a literal single-space match is too brittle
    // against cosmetic source reformatting.
    expect(source).toMatch(/still\s+0 entries/);
  });
});
