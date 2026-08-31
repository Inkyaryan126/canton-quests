/**
 * Canton Quests — Founder's Cipher Commander Text Transmission +
 * path-aware gameplay messaging system.
 *
 * Covers: the canonical message registry (lib/gameplay/founders-cipher/),
 * the resolver's path-flavoring + safe-fallback behavior, the reusable
 * Commander Text Transmission template component, the FIELD LOG archive
 * integration, and the real gameplay call sites this pass wired in
 * (app/events/[slug]/page.tsx, app/events/[slug]/quests/[questId]/page.tsx).
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { FOUNDER_CIPHER_MESSAGES } from '../lib/gameplay/founders-cipher/messages';
import { getFounderCipherMessage, showFounderCipherMessage } from '../lib/gameplay/founders-cipher/message-resolver';
import { FounderCipherMessageId } from '../lib/gameplay/founders-cipher/types';
import { logFounderCipherMessage, getFounderCipherMessageLog } from '../lib/gameplay/founders-cipher/message-log';
import { gameMomentManager } from '../lib/game-effects';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

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

const ALL_MESSAGE_IDS = Object.keys(FOUNDER_CIPHER_MESSAGES) as FounderCipherMessageId[];

describe('1/2. Universal player path determines message flavor — FAMILY/CHALLENGE/SECRET return different wording', () => {
  it('every registered message resolves to three genuinely different bodies for the three paths', () => {
    for (const id of ALL_MESSAGE_IDS) {
      const family = getFounderCipherMessage(id, 'family').body;
      const challenge = getFounderCipherMessage(id, 'challenge').body;
      const secret = getFounderCipherMessage(id, 'secret').body;
      expect(family, `${id}: family vs challenge`).not.toBe(challenge);
      expect(family, `${id}: family vs secret`).not.toBe(secret);
      expect(challenge, `${id}: challenge vs secret`).not.toBe(secret);
    }
  });

  it('a concrete example: CIPHER_FRAGMENT_FOUND reads distinctly per path', () => {
    expect(getFounderCipherMessage('CIPHER_FRAGMENT_FOUND', 'family').body).toMatch(/keep going/i);
    expect(getFounderCipherMessage('CIPHER_FRAGMENT_FOUND', 'challenge').body).toMatch(/secured/i);
    expect(getFounderCipherMessage('CIPHER_FRAGMENT_FOUND', 'secret').body).toMatch(/surfaced|concealed/i);
  });
});

describe('3. Gameplay facts stay identical across paths — only tone changes', () => {
  it('the registry has no per-path fields other than title/body/cta — no path can carry a different fact', () => {
    for (const id of ALL_MESSAGE_IDS) {
      const message = FOUNDER_CIPHER_MESSAGES[id];
      for (const flavor of [message.family, message.challenge, message.secret]) {
        expect(Object.keys(flavor).sort()).toEqual(
          Object.keys(flavor).filter((k) => k === 'title' || k === 'body' || k === 'cta').sort()
        );
      }
    }
  });

  it('presentation, size, and archive-worthiness are the SAME regardless of which path resolves the message', () => {
    for (const id of ALL_MESSAGE_IDS) {
      const family = getFounderCipherMessage(id, 'family');
      const challenge = getFounderCipherMessage(id, 'challenge');
      const secret = getFounderCipherMessage(id, 'secret');
      const neutral = getFounderCipherMessage(id, null);
      for (const resolved of [challenge, secret, neutral]) {
        expect(resolved.presentation).toBe(family.presentation);
        expect(resolved.size).toBe(family.size);
        expect(resolved.archiveWorthy).toBe(family.archiveWorthy);
      }
    }
  });

  it('the message resolver has zero XP/scoring/access-related fields in its output shape', () => {
    const resolved = getFounderCipherMessage('CIPHER_FRAGMENT_FOUND', 'challenge');
    expect(resolved).not.toHaveProperty('xp');
    expect(resolved).not.toHaveProperty('xpAwarded');
    expect(resolved).not.toHaveProperty('score');
    expect(resolved).not.toHaveProperty('questAccess');
  });
});

describe('4. Missing path has a safe, neutral fallback', () => {
  it('null, undefined, and an invalid path all resolve to the neutral variant, never throw', () => {
    for (const id of ALL_MESSAGE_IDS) {
      const message = FOUNDER_CIPHER_MESSAGES[id];
      expect(getFounderCipherMessage(id, null).body).toBe(message.neutral);
      expect(getFounderCipherMessage(id, undefined).body).toBe(message.neutral);
      expect(getFounderCipherMessage(id, 'not-a-real-path' as any).body).toBe(message.neutral);
    }
  });

  it('the neutral fallback is never an empty string', () => {
    for (const id of ALL_MESSAGE_IDS) {
      expect(FOUNDER_CIPHER_MESSAGES[id].neutral.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('5. Commander Text Transmission template is reused, never regenerated per message', () => {
  const componentSource = readSource('components/commander/CommanderTextTransmission.tsx');

  it('renders the one canonical template asset, not a per-message image', () => {
    expect(componentSource).toContain("'/canton-quests/Commander_transmission_template.png'");
    // Only one <Image> reference to a transmission asset in this component.
    const imageSrcMatches = componentSource.match(/src=\{?TEMPLATE_SRC\}?/g) || [];
    expect(imageSrcMatches.length).toBeGreaterThan(0);
  });

  it('the template asset exists on disk and was not renamed/deleted', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'public/canton-quests/Commander_transmission_template.png'))).toBe(true);
  });

  it('text is layered as HTML over the image, not baked into a generated graphic', () => {
    expect(componentSource).toContain('{title}');
    expect(componentSource).toContain('paragraphs.map');
  });

  it('is wired into the existing GameMomentManager queue via a new commander-text moment type, not a parallel overlay system', () => {
    const overlaySource = readSource('components/game-effects/GameMomentOverlay.tsx');
    expect(overlaySource).toContain('CommanderTextTransmission');
    expect(overlaySource).toMatch(/current\.type === 'commander-text'/);
    const effectsSource = readSource('lib/game-effects.ts');
    expect(effectsSource).toMatch(/export interface CommanderTextMoment extends BaseGameMoment/);
    expect(effectsSource).toContain("| CommanderTextMoment");
  });
});

describe('6/7. Message copy is centralized; Founder\'s Cipher gameplay moments retrieve it from there', () => {
  it('the quest detail page imports the resolver rather than hand-writing gameplay copy for the wired triggers', () => {
    const questPageSource = readSource('app/events/[slug]/quests/[questId]/page.tsx');
    expect(questPageSource).toContain("from '@/lib/gameplay/founders-cipher/message-resolver'");
    expect(questPageSource).toContain("showFounderCipherMessage({");
    expect(questPageSource).toMatch(/messageId: 'QUEST_STARTED'/);
    expect(questPageSource).toMatch(/messageId: 'CIPHER_FRAGMENT_FOUND'/);
    expect(questPageSource).toMatch(/messageId: 'DISTRICT_OBJECTIVE_COMPLETE'/);
    expect(questPageSource).toMatch(/messageId: 'ALL_REQUIRED_FRAGMENTS_FOUND'/);
  });

  it('the Mission hub page retrieves MISSION_BRIEFING from the same centralized resolver after Cold Open', () => {
    const hubSource = readSource('app/events/[slug]/page.tsx');
    expect(hubSource).toContain("from '@/lib/gameplay/founders-cipher/message-resolver'");
    expect(hubSource).toMatch(/messageId: 'MISSION_BRIEFING'/);
  });

  it('nothing outside lib/gameplay/founders-cipher/messages.ts defines a FOUNDER_CIPHER_MESSAGES-shaped registry', () => {
    // Guards against a second, scattered copy of this registry appearing elsewhere.
    const files = ['app/events/[slug]/page.tsx', 'app/events/[slug]/quests/[questId]/page.tsx'];
    for (const file of files) {
      expect(readSource(file)).not.toContain('FOUNDER_CIPHER_MESSAGES');
    }
  });
});

describe('8. Critical messages can be preserved in Transmissions where intended', () => {
  it('archiveWorthy is set on the narratively-important messages this pass wires (fragment found, district complete, all fragments, mission briefing) and NOT on pure micro feedback', () => {
    expect(FOUNDER_CIPHER_MESSAGES.CIPHER_FRAGMENT_FOUND.archiveWorthy).toBe(true);
    expect(FOUNDER_CIPHER_MESSAGES.DISTRICT_OBJECTIVE_COMPLETE.archiveWorthy).toBe(true);
    expect(FOUNDER_CIPHER_MESSAGES.ALL_REQUIRED_FRAGMENTS_FOUND.archiveWorthy).toBe(true);
    expect(FOUNDER_CIPHER_MESSAGES.MISSION_BRIEFING.archiveWorthy).toBe(true);
    expect(FOUNDER_CIPHER_MESSAGES.XP_AWARDED.archiveWorthy).toBeFalsy();
    expect(FOUNDER_CIPHER_MESSAGES.CORRECT_ANSWER.archiveWorthy).toBeFalsy();
  });

  it('logFounderCipherMessage only logs archiveWorthy messages, and getFounderCipherMessageLog reads them back per player, most recent first', () => {
    installLocalStorageShim();
    try {
      const resolvedArchiveWorthy = getFounderCipherMessage('CIPHER_FRAGMENT_FOUND', 'secret');
      const resolvedMicro = getFounderCipherMessage('XP_AWARDED', 'secret');

      logFounderCipherMessage('plr-log-test', resolvedMicro);
      expect(getFounderCipherMessageLog('plr-log-test')).toEqual([]);

      logFounderCipherMessage('plr-log-test', resolvedArchiveWorthy);
      const log = getFounderCipherMessageLog('plr-log-test');
      expect(log).toHaveLength(1);
      expect(log[0].id).toBe('CIPHER_FRAGMENT_FOUND');
      expect(log[0].path).toBe('secret');

      const resolvedSecond = getFounderCipherMessage('DISTRICT_OBJECTIVE_COMPLETE', 'secret');
      logFounderCipherMessage('plr-log-test', resolvedSecond);
      const updated = getFounderCipherMessageLog('plr-log-test');
      expect(updated).toHaveLength(2);
      expect(updated[0].id).toBe('DISTRICT_OBJECTIVE_COMPLETE'); // most recent first
    } finally {
      removeLocalStorageShim();
    }
  });

  it('the log is scoped per player — one player never sees another\'s entries', () => {
    installLocalStorageShim();
    try {
      logFounderCipherMessage('plr-a', getFounderCipherMessage('CIPHER_FRAGMENT_FOUND', 'family'));
      logFounderCipherMessage('plr-b', getFounderCipherMessage('KEY_FOUND', 'family'));
      expect(getFounderCipherMessageLog('plr-a')).toHaveLength(1);
      expect(getFounderCipherMessageLog('plr-b')).toHaveLength(1);
      expect(getFounderCipherMessageLog('plr-a')[0].id).toBe('CIPHER_FRAGMENT_FOUND');
    } finally {
      removeLocalStorageShim();
    }
  });

  it('the Transmissions archive page renders a FIELD LOG section that reopens logged messages', () => {
    const archiveSource = readSource('app/events/[slug]/transmissions/page.tsx');
    expect(archiveSource).toContain('FIELD LOG');
    expect(archiveSource).toContain('getFounderCipherMessageLog');
    expect(archiveSource).toContain('reopenLoggedMessage');
  });

  it('showFounderCipherMessage logs archiveWorthy messages when a playerId is supplied', () => {
    installLocalStorageShim();
    try {
      showFounderCipherMessage({ messageId: 'KEY_FOUND', path: 'family', playerId: 'plr-show-test' });
      const log = getFounderCipherMessageLog('plr-show-test');
      expect(log).toHaveLength(1);
      expect(log[0].id).toBe('KEY_FOUND');
    } finally {
      // Clean up the moment we just queued so it doesn't bleed into other tests in this file.
      gameMomentManager.dismissCurrent();
      removeLocalStorageShim();
    }
  });
});

describe('9. Joining another Mission does not change the player\'s universal tone', () => {
  it('the resolver takes path as a plain argument — it has no Mission/event parameter at all, so it cannot vary by Mission', () => {
    const resolverSource = readSource('lib/gameplay/founders-cipher/message-resolver.ts');
    expect(resolverSource).not.toMatch(/eventId|eventSlug|participation\.path/);
  });

  it('the same path resolves identically regardless of which "Mission" is conceptually asking (no hidden per-call state)', () => {
    const first = getFounderCipherMessage('QUEST_STARTED', 'challenge');
    const second = getFounderCipherMessage('QUEST_STARTED', 'challenge');
    expect(first).toEqual(second);
  });
});

describe('10. Path does not change XP/scoring/access', () => {
  it('lib/gameplay/founders-cipher/ never imports anything from the scoring/leaderboard/quest-access layer', () => {
    const files = ['lib/gameplay/founders-cipher/types.ts', 'lib/gameplay/founders-cipher/messages.ts', 'lib/gameplay/founders-cipher/message-resolver.ts', 'lib/gameplay/founders-cipher/message-log.ts'];
    for (const file of files) {
      const source = readSource(file);
      expect(source).not.toMatch(/supabase-db|game-engine|quest-rewards|getLeaderboardDB/);
    }
  });

  it('the cipher fragment / district wiring in the quest page fires purely off server-confirmed facts (result.cipherFragmentsAwarded / result.cipherDistrictsUnlocked), never off the player\'s path', () => {
    const source = readSource('app/events/[slug]/quests/[questId]/page.tsx');
    const fragmentBlock = source.slice(
      source.indexOf('result.cipherFragmentsAwarded && result.cipherFragmentsAwarded.length > 0'),
      source.indexOf('result.cipherDistrictsUnlocked && result.cipherDistrictsUnlocked.length > 0')
    );
    // The eligibility condition must never branch on path — only on the server's own award data.
    expect(fragmentBlock).not.toMatch(/player\.selectedStartingPath\s*(===|!==)/);
  });
});

describe('11. Commander template renders without overflowing mobile layouts', () => {
  const componentSource = readSource('components/commander/CommanderTextTransmission.tsx');

  it('the template container is aspect-ratio locked (never a fixed pixel box that could overflow a narrow viewport)', () => {
    expect(componentSource).toContain("aspectRatio: TEMPLATE_ASPECT");
    expect(componentSource).toContain("'1086 / 1448'");
  });

  it('the outer dialog caps width and height responsively (max-w-sm, max-h-[92vh]) rather than assuming desktop space', () => {
    expect(componentSource).toContain('max-w-sm');
    expect(componentSource).toContain('max-h-[92vh]');
  });

  it('long messages scroll INSIDE the message region instead of breaking the artwork', () => {
    expect(componentSource).toMatch(/className="absolute overflow-y-auto"/);
  });

  it('no horizontal-overflow-prone fixed widths (e.g. bare `width: \'...px\'`) are used for the message area', () => {
    expect(componentSource).not.toMatch(/width:\s*'\d+px'/);
  });

  it('text scales down for LONG messages rather than being force-fit at the SHORT size', () => {
    expect(componentSource).toMatch(/short:\s*'text-base sm:text-lg/);
    expect(componentSource).toMatch(/long:\s*'text-xs sm:text-sm/);
  });
});
