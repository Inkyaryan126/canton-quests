/**
 * Canton Quests — reusable "WATCH TRANSMISSION" button
 * (components/commander/WatchTransmissionButton.tsx).
 *
 * Goal: stop Commander videos from auto-popping up everywhere. Only 5
 * "flow moment" videos (Cold Open, Three Doors, and the 3 path-selected
 * videos) still auto-play; the other 9 numbered videos are now opened
 * manually via this one reusable button, placed near the section each
 * video explains, reusing the existing GameMomentManager /
 * CommanderTransmissionEffect / CommanderMedia playback pipeline — no
 * second video player.
 */

import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import WatchTransmissionButton from '../components/commander/WatchTransmissionButton';
import { COMMANDER_TRANSMISSIONS } from '../lib/commander-transmissions';
import { navigateToPlayerFile } from '../lib/player-file-nav';
import { hasViewedTransmission, markTransmissionViewed } from '../lib/transmission-viewed-state';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

// vitest.config.ts runs this suite under environment: 'node' (no DOM), so
// lib/transmission-viewed-state.ts's `isClient()` check is false by default
// and every read/write silently no-ops. This shim gives it a minimal real
// localStorage so navigateToPlayerFile's viewed-state branches are actually
// exercised, not just skipped.
function installLocalStorageShim() {
  const store = new Map<string, string>();
  (globalThis as any).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: (k: string) => {
        store.delete(k);
      },
    },
  };
}

function removeLocalStorageShim() {
  delete (globalThis as any).window;
}

describe('WatchTransmissionButton — renders the real asset, accessibly', () => {
  it('renders the existing watch_transmission.png asset via next/image, never CSS-drawn or plain text', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(WatchTransmissionButton, { trigger: 'cipher_welcome' })
    );
    // next/image rewrites src through its optimizer (URL-encoded), so check
    // for the encoded asset path rather than the raw literal string.
    expect(html).toContain(encodeURIComponent('/canton-quests/watch_transmission.png'));
    expect(html).toContain('<img');
    expect(html).not.toContain('WATCH TRANSMISSION</span>'); // the image-failed text fallback never renders by default
  });

  it('the asset file actually exists at the exact path used', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'public/canton-quests/watch_transmission.png'))).toBe(true);
  });

  it('is a real, keyboard-focusable, clickable <button> with an accessible label naming the specific transmission', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(WatchTransmissionButton, { trigger: 'cipher_leaderboard' })
    );
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-label="Watch Commander transmission: The Leaderboard"');
  });

  it('has a real alt attribute on the image (never empty/decorative)', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(WatchTransmissionButton, { trigger: 'cipher_rules_intro' })
    );
    expect(html).toMatch(/alt="Watch Transmission"/);
  });

  it('renders nothing for a trigger with no mapped video, rather than a dead/broken button', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(WatchTransmissionButton, { trigger: 'sector_intro' as any })
    );
    expect(html).toBe('');
  });

  it('supports small, medium, and hero size variants, each with a fixed-dimension CSS class (no layout shift)', () => {
    const cssSource = readSource('app/globals.css');
    for (const size of ['small', 'medium', 'hero']) {
      const html = ReactDOMServer.renderToString(
        React.createElement(WatchTransmissionButton, { trigger: 'cipher_welcome', size: size as any })
      );
      expect(html).toContain(`cq-watch-transmission-${size}`);
      expect(cssSource).toContain(`.cq-watch-transmission-${size} .cq-watch-transmission-btn`);
    }
  });

  it('has a hover/focus-visible glow and an explicit focus ring in CSS — never a generic unstyled default button', () => {
    const cssSource = readSource('app/globals.css');
    expect(cssSource).toMatch(/\.cq-watch-transmission-btn:hover,\s*\n\.cq-watch-transmission-btn:focus-visible/);
    expect(cssSource).toContain('.cq-watch-transmission-btn:focus-visible {\n  outline: 2px solid #38bdf8;');
    expect(cssSource).toMatch(/\.cq-watch-transmission-btn:active\s*\{\s*transform: scale\(0\.97\);/);
  });

  it('has a real text fallback class defined for the case the image fails to load', () => {
    const cssSource = readSource('app/globals.css');
    expect(cssSource).toContain('.cq-watch-transmission-fallback');
  });

  it('an optional caption label renders as visible text distinguishing which transmission this is', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(WatchTransmissionButton, { trigger: 'cipher_first_xp', label: 'How XP Works' })
    );
    expect(html).toContain('How XP Works');
  });
});

describe('Placement — each manual-button transmission is wired into the correct page/section', () => {
  const placements: Array<{ file: string; trigger: string; note: string }> = [
    { file: 'app/events/[slug]/page.tsx', trigger: 'cipher_welcome', note: 'Mission overview hero (2)' },
    { file: 'app/events/[slug]/page.tsx', trigger: 'cipher_city_intro', note: 'Mission overview hero (5)' },
    { file: 'app/events/[slug]/drawing/page.tsx', trigger: 'cipher_prize_intro', note: 'Drawing/prize hero (3)' },
    { file: 'app/events/[slug]/rules/page.tsx', trigger: 'cipher_rules_intro', note: 'Top of Rules page (4)' },
    { file: 'components/FastPlayerOnboardForm.tsx', trigger: 'cipher_callsign', note: 'Callsign field (10)' },
    // cipher_profile (11) is intentionally absent here — it's no longer a
    // WatchTransmissionButton placement. See the "Player File nav intro"
    // describe block below for its new one-time nav-triggered flow.
    { file: 'app/events/[slug]/page.tsx', trigger: 'cipher_first_xp', note: 'XP stat card (12)' },
    { file: 'app/events/[slug]/drawing/page.tsx', trigger: 'cipher_first_entry', note: 'Drawing/prize page (13)' },
    { file: 'app/leaderboard/page.tsx', trigger: 'cipher_leaderboard', note: 'Leaderboard header (14)' },
    { file: 'app/events/[slug]/page.tsx', trigger: 'cipher_first_quest', note: 'Quests tab header (15)' },
  ];

  it.each(placements)('$file renders <WatchTransmissionButton trigger="$trigger"> — $note', ({ file, trigger }) => {
    const source = readSource(file);
    expect(source).toContain('WatchTransmissionButton');
    expect(source).toMatch(new RegExp(`<WatchTransmissionButton[^>]*trigger="${trigger}"`));
  });

  it('the Rules page specifically contains the Basic Rules transmission button', () => {
    expect(readSource('app/events/[slug]/rules/page.tsx')).toMatch(/trigger="cipher_rules_intro"/);
  });

  it('the Leaderboard page specifically contains the Leaderboard transmission button', () => {
    expect(readSource('app/leaderboard/page.tsx')).toMatch(/trigger="cipher_leaderboard"/);
  });

  it('the Mission dashboard XP section specifically contains the How XP Works button', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    const xpBlockIndex = source.indexOf('Your XP Score');
    const buttonIndex = source.indexOf('trigger="cipher_first_xp"');
    expect(xpBlockIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(-1);
    // The button sits within a reasonable distance of the XP stat block, not
    // buried somewhere unrelated in this 1000+ line file.
    expect(Math.abs(buttonIndex - xpBlockIndex)).toBeLessThan(2000);
  });

  it('the quests list/area specifically contains the How to Read a Quest button, inside the quest-board section', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    const boardIndex = source.indexOf('id="quest-board"');
    const buttonIndex = source.indexOf('trigger="cipher_first_quest"');
    expect(boardIndex).toBeGreaterThan(-1);
    expect(buttonIndex).toBeGreaterThan(boardIndex);
    expect(buttonIndex - boardIndex).toBeLessThan(400);
  });
});

describe('Manual-button transmissions no longer auto-popup', () => {
  // cipher_profile (11) is included here too: it must never *auto*-fire via
  // shouldAutoShowTransmission in any of these scanned pages — its only
  // trigger point is a deliberate PLAYER FILE nav click, handled entirely
  // in components/CinematicNav.tsx (outside this file list).
  const manualTriggers = [
    'cipher_welcome',
    'cipher_prize_intro',
    'cipher_rules_intro',
    'cipher_city_intro',
    'cipher_callsign',
    'cipher_profile',
    'cipher_first_xp',
    'cipher_first_entry',
    'cipher_leaderboard',
    'cipher_first_quest',
  ];

  const scannedFiles = [
    'app/events/[slug]/page.tsx',
    'app/events/[slug]/drawing/page.tsx',
    'app/leaderboard/page.tsx',
    'app/profile/page.tsx',
    'app/events/[slug]/quests/[questId]/page.tsx',
    'components/FastPlayerOnboardForm.tsx',
  ];

  it('no scanned file calls shouldAutoShowTransmission/showGameMoment for any manual-button trigger', () => {
    for (const file of scannedFiles) {
      const source = readSource(file);
      for (const trigger of manualTriggers) {
        expect(source, `${file} still auto-fires ${trigger}`).not.toMatch(
          new RegExp(`shouldAutoShowTransmission\\('${trigger}'`)
        );
      }
    }
  });

  it('CipherRulesVideoTrigger.tsx (the old silent auto-fire for the Rules video) was deleted', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'components/commander/CipherRulesVideoTrigger.tsx'))).toBe(false);
  });

  it('nothing in the repo still imports the deleted CipherRulesVideoTrigger', () => {
    function walk(dir: string): string[] {
      const full = path.join(process.cwd(), dir);
      if (!fs.existsSync(full)) return [];
      let results: string[] = [];
      for (const entry of fs.readdirSync(full)) {
        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(path.join(process.cwd(), entryPath));
        if (stat.isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue;
          results = results.concat(walk(entryPath));
        } else if (/\.(ts|tsx)$/.test(entry)) {
          results.push(entryPath);
        }
      }
      return results;
    }
    const allFiles = [...walk('app'), ...walk('components'), ...walk('lib')];
    for (const file of allFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source, `${file} still references CipherRulesVideoTrigger`).not.toContain('CipherRulesVideoTrigger');
    }
  });
});

describe('Auto-play transmissions still auto-trigger where intended (the 5 strong flow moments)', () => {
  it('Cold Open (1) still auto-fires on Mission entry', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    expect(source).toMatch(/shouldAutoShowTransmission\('cipher_cold_open', 'video-1'/);
    expect(source).toMatch(/showGameMoment\(\{\s*\n\s*type: 'commander-transmission',\s*\n\s*trigger: 'cipher_cold_open'/);
  });

  it('Three Doors (9) still auto-fires around path selection', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    expect(source).toMatch(/shouldAutoShowTransmission\('cipher_three_doors', 'video-9'/);
  });

  it('the three path-selected videos (6/7/8) still auto-fire immediately after a path is confirmed', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    expect(source).toMatch(/shouldAutoShowTransmission\('cipher_path_selected', path, pid\)/);
    expect(source).toContain("trigger: 'cipher_path_selected'");
  });

  it('the onboarding auto-chain no longer bundles videos 2 and 5 behind video 1', () => {
    const source = readSource('app/events/[slug]/page.tsx');
    expect(source).not.toMatch(/cipher_welcome[\s\S]{0,50}cipher_city_intro/);
    // The chain-array pattern (`trigger: 'cipher_cold_open' | 'cipher_welcome' | 'cipher_city_intro'`) is gone.
    expect(source).not.toContain("'cipher_cold_open' | 'cipher_welcome' | 'cipher_city_intro'");
  });

  it('all 15 numbered videos are accounted for across the auto-play and manual-button lists (no video silently dropped)', () => {
    const autoPlayTriggers = ['cipher_cold_open', 'cipher_three_doors', 'cipher_path_selected'];
    // cipher_profile (11) is accounted for here as a manual/contextual
    // trigger even though it's no longer a WatchTransmissionButton
    // placement — see "Player File nav intro" below for where it actually
    // lives now (components/CinematicNav.tsx, one-time on first click).
    const manualButtonTriggers = [
      'cipher_welcome',
      'cipher_prize_intro',
      'cipher_rules_intro',
      'cipher_city_intro',
      'cipher_callsign',
      'cipher_profile',
      'cipher_first_xp',
      'cipher_first_entry',
      'cipher_leaderboard',
      'cipher_first_quest',
    ];
    const coveredIds = new Set<number>();
    for (const t of [...autoPlayTriggers, ...manualButtonTriggers]) {
      for (const entry of COMMANDER_TRANSMISSIONS) {
        if (entry.trigger === t) coveredIds.add(entry.id);
      }
    }
    expect(coveredIds.size).toBe(COMMANDER_TRANSMISSIONS.length);
  });
});

describe('Player File nav intro — Transmission #11 moved off /profile onto a one-time PLAYER FILE click, shared everywhere', () => {
  it('/profile no longer imports or renders WatchTransmissionButton (Mission-neutral)', () => {
    const source = readSource('app/profile/page.tsx');
    expect(source).not.toContain('WatchTransmissionButton');
    expect(source).not.toMatch(/trigger="cipher_profile"/);
  });

  it('CinematicNav.tsx has a permanent PLAYER FILE link in the desktop nav, ungated by auth state', () => {
    const source = readSource('components/CinematicNav.tsx');
    // The PLAYER FILE link must sit directly in cq-nav-links (always
    // rendered), not behind a `{player ? ... : null}` guard.
    const navLinksBlock = source.slice(source.indexOf('<div className="cq-nav-links">'), source.indexOf('</div>', source.indexOf('<div className="cq-nav-links">')));
    expect(navLinksBlock).toContain('PLAYER FILE');
    expect(navLinksBlock).not.toMatch(/\{player\s*\?[\s\S]*PLAYER FILE/);
  });

  it('CinematicNav.tsx has a mobile-only PLAYER FILE control, shown when .cq-nav-links is hidden', () => {
    const navSource = readSource('components/CinematicNav.tsx');
    expect(navSource).toContain('cq-nav-player-file-mobile');
    const cssSource = readSource('app/globals.css');
    expect(cssSource).toMatch(/\.cq-nav-player-file-mobile\s*\{\s*\n\s*display: none;/);
    expect(cssSource).toMatch(/@media \(max-width: 820px\) \{[\s\S]*\.cq-nav-player-file-mobile \{\s*\n\s*display: inline-flex;/);
  });

  // components/Header.tsx is the SEPARATE nav bar actually rendered on every
  // Mission-scoped page (Rules, Drawing, Quests, Transmissions, Mission
  // overview) — components/CinematicNav.tsx only covers the platform-wide
  // pages (homepage, roster, how-it-works, leaderboard, login/register).
  // PLAYER FILE must exist in both, or it would be invisible on the exact
  // pages this task's transmission return-nav work is centered on.
  it('components/Header.tsx (the Mission-scoped nav) also has a permanent PLAYER FILE link, ungated by auth', () => {
    const source = readSource('components/Header.tsx');
    expect(source).toContain('Player File');
    expect(source).toMatch(/<Link href="\/profile" onClick=\{handlePlayerFileClick\}>/);
  });

  it('Header.tsx PLAYER FILE renders inside the always-mounted operation-links row, not gated behind isKnownCantonLaunchSlug', () => {
    const source = readSource('components/Header.tsx');
    const navBlock = source.slice(source.indexOf('cq-header-operation-links" aria-label'), source.indexOf('</nav>'));
    const playerFileIndex = navBlock.indexOf('Player File');
    const launchGateIndex = navBlock.lastIndexOf('isKnownCantonLaunchSlug', playerFileIndex);
    const launchGateCloseIndex = launchGateIndex === -1 ? -1 : navBlock.indexOf(')}', launchGateIndex);
    expect(playerFileIndex).toBeGreaterThan(-1);
    // PLAYER FILE must sit after any isKnownCantonLaunchSlug-gated block closes.
    expect(launchGateCloseIndex).toBeLessThan(playerFileIndex);
  });

  // A prior pass wired the intro directly into CinematicNav.tsx and
  // Header.tsx as inline, duplicated logic — which is exactly how a THIRD
  // "VIEW PLAYER FILE" control (components/FounderCipherShell.tsx) was able
  // to link straight to /profile without anyone noticing it skipped the
  // check. lib/player-file-nav.ts is the single shared implementation now;
  // every caller must import it, never re-implement the branching locally.
  const SHARED_HANDLER_CALLERS = [
    'components/CinematicNav.tsx',
    'components/Header.tsx',
    'components/FounderCipherShell.tsx',
    'app/page.tsx',
    'components/PlayerIdentityBar.tsx',
  ];

  it.each(SHARED_HANDLER_CALLERS)('%s imports createPlayerFileClickHandler from lib/player-file-nav and does not re-implement the branching inline', (file) => {
    const source = readSource(file);
    expect(source).toMatch(/import \{ createPlayerFileClickHandler \} from '@\/lib\/player-file-nav';/);
    expect(source).toMatch(/createPlayerFileClickHandler\(router, \w+\)/);
    // None of these files should hand-roll the hasViewedTransmission/register-redirect logic anymore.
    expect(source).not.toMatch(/hasViewedTransmission\('cipher_profile', 'video-11'/);
    expect(source).not.toMatch(/router\.push\(`\/register\?next=/);
  });

  it('every visible "go to /profile" control in these files is wired to the shared handler, not a bare href', () => {
    for (const file of SHARED_HANDLER_CALLERS) {
      const source = readSource(file);
      // Every href="/profile" (the literal string form used by all 5 callers)
      // must be immediately followed by onClick={handlePlayerFileClick}
      // before the tag closes — a bare, unwired href="/profile" would fail this.
      const hrefMatches = [...source.matchAll(/href="\/profile"/g)];
      expect(hrefMatches.length, `${file} has no href="/profile" at all`).toBeGreaterThan(0);
      for (const match of hrefMatches) {
        const tagSlice = source.slice(match.index!, match.index! + 200);
        const tagEnd = tagSlice.indexOf('>');
        const tagOpen = tagSlice.slice(0, tagEnd === -1 ? undefined : tagEnd);
        expect(tagOpen, `${file}: href="/profile" near index ${match.index} is not wired to handlePlayerFileClick`).toContain('onClick={handlePlayerFileClick}');
      }
    }
  });

  it('lib/player-file-nav.ts is the only place that defines the cipher_profile/video-11 branching', () => {
    const source = readSource('lib/player-file-nav.ts');
    expect(source).toMatch(/if \(!player\) \{\s*\n\s*router\.push\(`\/register\?next=\$\{encodeURIComponent\('\/profile'\)\}`\);/);
    expect(source).toMatch(/hasViewedTransmission\('cipher_profile', 'video-11', pid\)/);
    expect(source).toMatch(/onFinished: \(\) => \{\s*\n\s*markTransmissionViewed\('cipher_profile', 'video-11', pid\);\s*\n\s*router\.push\('\/profile'\);/);
  });

  // Repo-wide audit — not scoped to the 5 files known today. If a future
  // control adds a new `href="/profile"` without wiring the shared
  // handler, this fails instead of silently reintroducing a bypass. Add a
  // file here ONLY for a genuinely-required direct/programmatic redirect
  // (never a discoverable "view your player file" control) and say why.
  const ALLOWED_DIRECT_PROFILE_LINKS: Record<string, string> = {
    'app/auth/reset-password/page.tsx': 'post-password-reset transactional confirmation CTA ("ENTER COMMAND CENTER"), not a discoverable Player File control',
  };

  it('no href="/profile" anywhere in app/ or components/ bypasses the shared Player File handler, except the documented exceptions', () => {
    function walk(dir: string): string[] {
      const full = path.join(process.cwd(), dir);
      if (!fs.existsSync(full)) return [];
      let results: string[] = [];
      for (const entry of fs.readdirSync(full)) {
        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(path.join(process.cwd(), entryPath));
        if (stat.isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue;
          results = results.concat(walk(entryPath));
        } else if (/\.tsx$/.test(entry)) {
          results.push(entryPath);
        }
      }
      return results;
    }

    const allFiles = [...walk('app'), ...walk('components')];
    const unwired: string[] = [];

    for (const file of allFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const hrefMatches = [...source.matchAll(/href="\/profile"/g)];
      if (hrefMatches.length === 0) continue;

      if (file in ALLOWED_DIRECT_PROFILE_LINKS) continue;

      for (const match of hrefMatches) {
        const tagSlice = source.slice(match.index!, match.index! + 200);
        const tagEnd = tagSlice.indexOf('>');
        const tagOpen = tagSlice.slice(0, tagEnd === -1 ? undefined : tagEnd);
        if (!tagOpen.includes('onClick={handlePlayerFileClick}')) {
          unwired.push(`${file} (index ${match.index})`);
        }
      }
    }

    expect(unwired, `Found href="/profile" not wired to the shared handler and not in ALLOWED_DIRECT_PROFILE_LINKS: ${unwired.join(', ')}`).toEqual([]);
  });

  describe('navigateToPlayerFile — behavioral coverage (fake router, real localStorage-backed viewed-state)', () => {
    function makeFakeRouter() {
      const pushed: string[] = [];
      return { router: { push: (href: string) => pushed.push(href) }, pushed };
    }

    beforeEach(() => installLocalStorageShim());
    afterEach(() => removeLocalStorageShim());

    it('logged-out click routes to /register?next=/profile and never opens the video', () => {
      const { router, pushed } = makeFakeRouter();
      navigateToPlayerFile(router, null);
      expect(pushed).toEqual(['/register?next=%2Fprofile']);
    });

    it('first eligible click (top-nav-equivalent call) opens the intro and does NOT navigate until it finishes', () => {
      const { router, pushed } = makeFakeRouter();
      const player = { id: 'plr-shared-handler-1', displayName: 'SharedHandlerTester', role: 'player', totalXp: 0, level: 1, createdAt: new Date().toISOString() } as any;

      expect(hasViewedTransmission('cipher_profile', 'video-11', player.id)).toBe(false);
      navigateToPlayerFile(router, player);
      // Opening the moment must not itself navigate — only its onFinished does.
      expect(pushed).toEqual([]);
    });

    it('a second, independent call site (Mission-page-equivalent) with the SAME player after completion goes straight to /profile — no repeat video', () => {
      const { router, pushed } = makeFakeRouter();
      const player = { id: 'plr-shared-handler-2', displayName: 'SharedHandlerTester2', role: 'player', totalXp: 0, level: 1, createdAt: new Date().toISOString() } as any;

      // Simulates "top-nav already completed the intro for this player".
      markTransmissionViewed('cipher_profile', 'video-11', player.id);

      // A second, independent caller (e.g. FounderCipherShell's VIEW PLAYER
      // FILE, or PlayerIdentityBar's Profile & Badges) must see the same
      // completed state and skip straight to /profile — proving the intro
      // can't be bypassed OR re-triggered by using a different entry point.
      navigateToPlayerFile(router, player);
      expect(pushed).toEqual(['/profile']);
    });
  });
});

describe('Commander-transmission backdrop dismiss — accidental taps never close a commander briefing', () => {
  it('the overlay backdrop click handler skips dismissal for commander-transmission moments', () => {
    const source = readSource('components/game-effects/GameMomentOverlay.tsx');
    expect(source).toMatch(/const handleBackdropDismiss = \(\) => \{\s*\n\s*if \(current\.type === 'commander-transmission'\) return;/);
    expect(source).toContain('onClick={handleBackdropDismiss}');
  });

  it('the X/Close button still dismisses unconditionally regardless of moment type', () => {
    const source = readSource('components/game-effects/GameMomentOverlay.tsx');
    const closeBtnIndex = source.indexOf('cq-moment-close-btn');
    const beforeCloseBtn = source.slice(0, closeBtnIndex);
    expect(beforeCloseBtn).toMatch(/onClick=\{handleDismiss\}[\s\S]*$/);
  });
});

describe('Mobile / responsive — size variants never overflow or collapse', () => {
  const cssSource = readSource('app/globals.css');

  it('the hero variant shrinks at narrow mobile widths instead of overflowing', () => {
    expect(cssSource).toMatch(/@media \(max-width: 480px\) \{\s*\n\s*\.cq-watch-transmission-hero \.cq-watch-transmission-btn/);
  });

  it('the button wrapper caps at 100% width so it never overflows its container', () => {
    expect(cssSource).toMatch(/\.cq-watch-transmission-wrap \{[^}]*max-width: 100%;/);
  });

  it('every size variant stays at or above a comfortably tappable height on mobile (>= 44px, the standard minimum touch target)', () => {
    const heights = [50, 70, 80, 100]; // small, medium, hero, hero@mobile
    for (const h of heights) {
      expect(h).toBeGreaterThanOrEqual(44);
    }
  });
});
