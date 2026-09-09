import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import CemeteryProgressPanel from '../components/CemeteryProgressPanel';
import FrankensteinPayoffCard from '../components/game-effects/FrankensteinPayoffCard';
import { getLaunchDistrictProgress, LAUNCH_DISTRICT_QUESTS } from '../lib/finale';
import type { PlayerFinaleStatus } from '../lib/finale-db';
import { getFounderCipherMessage } from '../lib/gameplay/founders-cipher/message-resolver';
vi.stubGlobal('React', React);

const quests = Object.entries(LAUNCH_DISTRICT_QUESTS).flatMap(([starting_path, slugs]) => slugs.map(slug => ({ id: slug, slug, starting_path, status: 'active' })));
function status(paths: string[], solved = false): PlayerFinaleStatus {
  return {
    launchProgress: getLaunchDistrictProgress(quests, quests.filter(q => paths.includes(q.starting_path)).map(q => ({ quest_id: q.id, status: 'verified' }))),
    convergenceStage: 'no_sigils', unlockedSigilCount: 0, hasAllThreeLocks: false,
    threeLocks: { mark: false, code: false, word: false },
    eligibility: { ok: false, reason: 'locks_required', message: 'Locks required' },
    cluePieces: [], falseFinaleSolvedAt: null, completedAt: solved ? '2026-09-12' : null, destinationReveal: null,
  };
}
describe('Phase 6 progression presentation', () => {
  it('explains the one-district goal without exposing the destination early', () => {
    const html = renderToStaticMarkup(<CemeteryProgressPanel status={status([])} eventSlug="canton-weekend-1" />);
    expect(html).toContain('One district opens the next chapter');
    expect(html).not.toContain('Frankenstein Family Monument');
  });
  it('one district exposes the real cemetery route and optional continued exploration', () => {
    const html = renderToStaticMarkup(<CemeteryProgressPanel status={status(['family'])} eventSlug="canton-weekend-1" />);
    expect(html).toContain('Frankenstein Family Monument');
    expect(html).toContain('posted public visitor hours');
    expect(html).toContain('does not mark the full Cipher as solved');
    expect(html).toContain('/events/canton-weekend-1#quest-board');
    expect(html).not.toContain('FULL CIPHER COMPLETE');
  });
  it('story access never pretends a photo was verified or awards a cemetery entry', () => {
    const html = renderToStaticMarkup(<FrankensteinPayoffCard verifiedQuest={false} />);
    expect(html).toContain('STORY ACCESS');
    expect(html).toContain('WATCHER SIGNAL W-01');
    expect(html).not.toContain('PHOTO PROOF VERIFIED');
    expect(html).not.toContain('200 XP');
    expect(html).not.toContain('You found the grave');
  });
  it('full completion has a distinct persistent status and the real one-time reward', () => {
    const html = renderToStaticMarkup(<CemeteryProgressPanel status={status(['family', 'challenge', 'secret'], true)} eventSlug="canton-weekend-1" />);
    expect(html).toContain('FULL CIPHER COMPLETE');
    expect(html).toContain('100 XP once');
  });
  it.each(['family', 'challenge', 'secret'] as const)('keeps %s Commander gates consistent with all 14 quests', path => {
    for (const id of ['ALL_THREE_LOCKS_RECOVERED', 'ALL_THREE_SIGILS_DECODED', 'ALL_REQUIRED_FRAGMENTS_FOUND', 'MASTER_CIPHER_AVAILABLE'] as const) {
      expect(getFounderCipherMessage(id, path).body).toContain('14');
    }
  });
  it('provides retry and accessible answer/status feedback, without new sound or overlays', () => {
    const page = readFileSync('app/events/[slug]/finale/page.tsx', 'utf8');
    expect(page).toContain('RETRY PROGRESS');
    expect(page).toContain('aria-label="Master Cipher solution"');
    expect(page).toContain('role="alert"');
    const panel = readFileSync('components/CemeteryProgressPanel.tsx', 'utf8');
    expect(panel).not.toMatch(/setTimeout|\.play\(|showGameMoment/);
    expect(panel).toContain('allowInteractivePing={false}');
  });
  it('keeps all quests at a shared coordinate selectable without changing coordinates', () => {
    const map = readFileSync('components/CantonMap.tsx', 'utf8');
    expect(map).toContain('samePointQuests.map');
    expect(map).toContain('aria-pressed={quest.id === selectedQuest.quest.id}');
    expect(map).toContain("maxHeight: '65%', overflowY: 'auto'");
  });
});
