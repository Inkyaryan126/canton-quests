import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCantonCalendarDate } from '../lib/canton-time';
import { claimSocialShare, getAllPlayers, initializeGameEngine, registerPlayer, resetGameEngineStore } from '../lib/game-engine';
import { SOCIAL_SHARE_XP } from '../lib/xp';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('social share XP Canton calendar boundary', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
    vi.useFakeTimers();
  });

  afterEach(() => vi.useRealTimers());

  it('awards once for the same America/New_York calendar day regardless of platform', () => {
    vi.setSystemTime(new Date('2026-09-09T16:00:00.000Z'));
    const player = registerPlayer({ displayName: 'CantonDayAgent', userId: 'usr-canton-day' });
    expect(claimSocialShare(player.id)).toEqual({ newlyGranted: true, xpAwarded: SOCIAL_SHARE_XP });

    vi.setSystemTime(new Date('2026-09-10T01:42:00.000Z'));
    expect(getCantonCalendarDate()).toBe('2026-09-09');
    expect(claimSocialShare(player.id)).toEqual({ newlyGranted: false, xpAwarded: 0 });
    expect(getAllPlayers().find((candidate) => candidate.id === player.id)?.totalXp).toBe(SOCIAL_SHARE_XP);
  });

  it('treats instants immediately before and after Eastern midnight as different days', () => {
    vi.setSystemTime(new Date('2026-09-10T03:59:59.999Z'));
    const player = registerPlayer({ displayName: 'MidnightAgent', userId: 'usr-midnight' });
    expect(getCantonCalendarDate()).toBe('2026-09-09');
    expect(claimSocialShare(player.id).newlyGranted).toBe(true);

    vi.setSystemTime(new Date('2026-09-10T04:00:00.000Z'));
    expect(getCantonCalendarDate()).toBe('2026-09-10');
    expect(claimSocialShare(player.id)).toEqual({ newlyGranted: true, xpAwarded: SOCIAL_SHARE_XP });
  });

  it('keeps late evening Eastern shares on the current date and handles DST independently of machine timezone', () => {
    expect(getCantonCalendarDate(new Date('2026-09-09T01:42:00.000Z'))).toBe('2026-09-08');
    expect(getCantonCalendarDate(new Date('2026-09-10T01:42:00.000Z'))).toBe('2026-09-09');
    expect(getCantonCalendarDate(new Date('2026-03-08T06:59:59.000Z'))).toBe('2026-03-08');
    expect(getCantonCalendarDate(new Date('2026-11-01T05:59:59.000Z'))).toBe('2026-11-01');

    const originalTz = process.env.TZ;
    process.env.TZ = 'Pacific/Honolulu';
    try {
      expect(getCantonCalendarDate(new Date('2026-09-10T01:42:00.000Z'))).toBe('2026-09-09');
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });
});

describe('live leaderboard empty state copy', () => {
  it('uses neutral live copy and preserves the entry rendering branch', () => {
    const page = readSource('app/leaderboard/page.tsx');
    const component = readSource('components/Leaderboard.tsx');
    for (const source of [page, component]) {
      expect(source).toContain('No Scores Yet');
      expect(source).toContain('Rankings will appear here as players earn XP.');
      expect(source).not.toContain('September 11');
      expect(source).not.toContain('PRE-SEASON');
    }
    expect(component).toContain('entries.map((entry) =>');
  });
});
