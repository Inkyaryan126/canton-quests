import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildRecentActivity,
  computeDistrictProgress,
  countPrizeEntries,
  getPlayerCityRank,
  getStartingDistrict,
  getBadgeIconPath,
  PLAYER_AVATAR_PRESETS,
  PLAYER_CARD_BADGE_SLOT_COUNT,
  CANONICAL_BADGE_ICON_PATHS,
  recommendQuests,
  sanitizeFeaturedBadges,
  validateFeaturedBadges,
} from '../lib/player-command-center';
import { Achievement, Player, PlayerAchievement, Quest } from '../lib/types';

const eventId = 'evt-test';

const player: Player = {
  id: 'plr-owner',
  displayName: 'SignalFox',
  role: 'player',
  totalXp: 0,
  level: 1,
  selectedStartingPath: 'challenge',
  createdAt: '2026-08-20T00:00:00Z',
};

const quests: Quest[] = [
  {
    id: 'q-family',
    eventId,
    title: 'Arts Signal',
    slug: 'arts-signal',
    description: '',
    instructions: '',
    pointValue: 75,
    difficulty: 'easy',
    category: 'exploration',
    verificationType: 'checkin',
    proofRequirement: '',
    isFlash: false,
    status: 'active',
    sortOrder: 2,
    startingPath: 'family',
    createdAt: '2026-08-20T01:00:00Z',
  },
  {
    id: 'q-challenge',
    eventId,
    title: 'Skate Signal',
    slug: 'skate-signal',
    description: '',
    instructions: '',
    pointValue: 125,
    difficulty: 'medium',
    category: 'observation',
    verificationType: 'photo',
    proofRequirement: '',
    isFlash: false,
    status: 'active',
    sortOrder: 1,
    startingPath: 'challenge',
    createdAt: '2026-08-20T02:00:00Z',
  },
  {
    id: 'q-secret',
    eventId,
    title: 'Monument Signal',
    slug: 'monument-signal',
    description: '',
    instructions: '',
    pointValue: 150,
    difficulty: 'hard',
    category: 'puzzle',
    verificationType: 'passphrase',
    proofRequirement: '',
    isFlash: true,
    status: 'active',
    sortOrder: 3,
    startingPath: 'secret',
    createdAt: '2026-08-20T03:00:00Z',
  },
];

const achievement: Achievement = {
  id: 'ach-one',
  slug: 'pathfinder-challenge',
  name: 'Pathfinder Challenge',
  description: 'Earned test badge.',
  badgeSymbol: 'X',
  category: 'path',
  rarity: 'common',
  district: 'challenge',
};

const earned: PlayerAchievement[] = [
  {
    id: 'pa-one',
    playerId: player.id,
    achievementId: achievement.id,
    achievementSlug: achievement.slug,
    earnedAt: '2026-08-20T04:00:00Z',
    achievement,
  },
];

describe('Player Command Center profile rules', () => {
  it('maps all three starting paths to the required recommended districts using the canonical public names', () => {
    // Canonical starting-path district names (launch-readiness Phase 11):
    // previously this file, app/profile/page.tsx, ThreePathSelector.tsx,
    // and app/quests/page.tsx each used a different label for the same
    // Challenge/Secret path ("9th St Skate Park area" / "Challenge District"
    // vs "Mother Goose Land"; "West Lawn Cemetery / McKinley area" /
    // "West Lawn Archive" vs "Monument Park"). Mother Goose Land and
    // Monument Park were the majority-consensus labels already used by
    // ThreePathSelector, PathLockEffect, the landing pages, and
    // lib/game-engine.ts, so lib/player-command-center.ts was aligned to
    // match rather than the other way around.
    expect(getStartingDistrict('family').district).toBe('Arts District');
    expect(getStartingDistrict('challenge').district).toBe('Mother Goose Land');
    expect(getStartingDistrict('secret').district).toBe('Monument Park');
  });

  it('keeps all other districts accessible while surfacing the player starting district first', () => {
    const recommended = recommendQuests(quests, player, {
      totalPoints: 0,
      completedQuestIds: [],
      pendingSubmissionQuestIds: [],
      completedCount: 0,
      availableCount: quests.length,
      rank: 1,
    });

    expect(recommended[0].id).toBe('q-challenge');
    expect(recommended.map((quest) => quest.id)).toEqual(expect.arrayContaining(['q-family', 'q-secret']));
  });

  it('does not claim proximity when there is no location signal', () => {
    const recommended = recommendQuests(quests, player, {
      totalPoints: 0,
      completedQuestIds: [],
      pendingSubmissionQuestIds: [],
      completedCount: 0,
      availableCount: quests.length,
      rank: 1,
    });

    expect(recommended.map((quest) => quest.title).join(' ')).not.toMatch(/nearby|near you|closest/i);
  });

  it('calculates district progress from real completed quest IDs', () => {
    const progress = computeDistrictProgress(quests, ['q-family', 'q-secret']);
    expect(progress.find((row) => row.path === 'family')).toMatchObject({ completed: 1, total: 1 });
    expect(progress.find((row) => row.path === 'challenge')).toMatchObject({ completed: 0, total: 1 });
    expect(progress.find((row) => row.path === 'secret')).toMatchObject({ completed: 1, total: 1 });
  });

  it('uses leaderboard rank semantics and returns unranked for zero-score players', () => {
    expect(getPlayerCityRank(player.id, [{ rank: 3, playerId: player.id, displayName: 'SignalFox', totalPoints: 0, questsCompletedCount: 0 }])).toBeNull();
    expect(getPlayerCityRank(player.id, [{ rank: 2, playerId: player.id, displayName: 'SignalFox', totalPoints: 250, questsCompletedCount: 1 }])).toBe(2);
  });

  it('counts prize entries from the drawing-entry ledger rather than XP', () => {
    expect(countPrizeEntries([
      { id: 'd1', eventId, playerId: player.id, entriesCount: 2, sourceType: 'quest_completion', reason: '', createdAt: '2026-08-20T00:00:00Z' },
      { id: 'd2', eventId, playerId: player.id, entriesCount: 5, sourceType: 'day_one_bonus', reason: '', createdAt: '2026-08-20T01:00:00Z' },
    ])).toBe(7);
  });

  it('allows only earned unique BADGES to be featured and preserves order', () => {
    expect(sanitizeFeaturedBadges(['pathfinder-challenge', 'pathfinder-challenge', 'locked'], earned)).toEqual(['pathfinder-challenge']);
    expect(validateFeaturedBadges(['pathfinder-challenge'], earned)).toEqual({ ok: true, slugs: ['pathfinder-challenge'] });
    expect(validateFeaturedBadges(['locked'], earned)).toMatchObject({ ok: false });
    expect(validateFeaturedBadges(['pathfinder-challenge', 'pathfinder-challenge'], earned)).toMatchObject({ ok: false });
  });

  it('caps featured BADGES to the visible round card slots', () => {
    const sixEarned = Array.from({ length: 6 }, (_, index) => ({
      ...earned[0],
      id: `pa-${index}`,
      achievementSlug: `badge-${index}`,
      achievement: { ...achievement, id: `ach-${index}`, slug: `badge-${index}` },
    }));

    expect(PLAYER_CARD_BADGE_SLOT_COUNT).toBe(6);
    expect(validateFeaturedBadges(sixEarned.map((item) => item.achievementSlug), sixEarned)).toMatchObject({ ok: true });
    expect(validateFeaturedBadges([...sixEarned.map((item) => item.achievementSlug), 'badge-6'], [
      ...sixEarned,
      {
        ...earned[0],
        id: 'pa-6',
        achievementSlug: 'badge-6',
        achievement: { ...achievement, id: 'ach-6', slug: 'badge-6' },
      },
    ])).toMatchObject({ ok: false });
  });

  it('uses an explicit canonical badge asset map instead of index-derived numbered fallbacks', () => {
    expect(Object.keys(CANONICAL_BADGE_ICON_PATHS).sort()).toEqual([
      'day-one-king',
      'district-sweep-challenge',
      'district-sweep-family',
      'district-sweep-secret',
      'nomad',
      'pathfinder-challenge',
      'pathfinder-family',
      'pathfinder-secret',
      'triple-threat',
    ]);
    expect(getBadgeIconPath(achievement)).toBe('/canton-quests/badges/challenge.png');
    expect(getBadgeIconPath({ ...achievement, slug: 'future-badge' })).toBe('/canton-quests/badges/first_step.png');
  });

  it('retires profile/player-image privacy gating — player avatars are always public', () => {
    // shouldExposePlayerImage() used to decide whether a non-owner could see
    // a player's photo based on profileVisibility/playerImageVisibility.
    // That control has been removed app-wide; guard against it (or an
    // equivalent gate) quietly reappearing.
    const centerSource = fs.readFileSync(path.join(process.cwd(), 'lib/player-command-center.ts'), 'utf8');
    const avatarRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/player/[id]/avatar/route.ts'), 'utf8');
    const profileRouteSource = fs.readFileSync(path.join(process.cwd(), 'app/api/player/profile/route.ts'), 'utf8');
    const profilePageSource = fs.readFileSync(path.join(process.cwd(), 'app/profile/page.tsx'), 'utf8');

    expect(centerSource).not.toContain('shouldExposePlayerImage');
    expect(avatarRouteSource).not.toContain('shouldExposePlayerImage');
    expect(avatarRouteSource).not.toContain('403');
    expect(profileRouteSource).not.toContain('playerImageVisibility');
    expect(profileRouteSource).not.toContain('profileVisibility');
    expect(profilePageSource).not.toContain('Player Image Visibility');
    expect(profilePageSource).not.toContain('Profile Visibility');
  });

  it('defines exactly the eight existing CQ avatar preset keys', () => {
    expect(PLAYER_AVATAR_PRESETS).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
  });

  it('builds recent field activity from completed quests, BADGES, and drawing entries', () => {
    const activity = buildRecentActivity([quests[0]], earned, [
      { id: 'd1', eventId, playerId: player.id, entriesCount: 1, sourceType: 'quest_completion', reason: 'Completed Arts Signal', createdAt: '2026-08-20T05:00:00Z' },
    ]);

    expect(activity.map((item) => item.label)).toContain('Quest completed');
    expect(activity.map((item) => item.label)).toContain('BADGE earned');
    expect(activity.map((item) => item.label)).toContain('Prize entry earned');
  });

  it('uses player_card.png as the card foundation with guide-calibrated overlay fields and single-line callsign scaling', () => {
    const profileSource = fs.readFileSync(path.join(process.cwd(), 'app/profile/page.tsx'), 'utf8');
    const cardComponentSource = fs.readFileSync(path.join(process.cwd(), 'components/PlayerCard.tsx'), 'utf8');
    const layoutSource = fs.readFileSync(path.join(process.cwd(), 'lib/player-card-layout.ts'), 'utf8');
    const cssSource = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(profileSource).toContain('<PlayerCard');
    expect(cardComponentSource).toContain('/canton-quests/player_card.png');
    expect(cardComponentSource).toContain('cq-card-callsign');
    expect(cardComponentSource).toContain('cq-card-badge-slot');

    // Layout coordinate map verification
    expect(layoutSource).toContain('PLAYER_CARD_LAYOUT');
    expect(layoutSource).toContain("left: '42.97%'"); // Callsign box
    expect(layoutSource).toContain("left: '51.17%'"); // Starting Path box
    expect(layoutSource).toContain("left: '51.27%'"); // Starting District box
    expect(layoutSource).toContain("left: '12.21%'"); // Total XP box
    expect(layoutSource).toContain("left: '34.67%'"); // Quests Complete box
    expect(layoutSource).toContain("left: '58.20%'"); // Prize Entries box
    expect(layoutSource).toContain("left: '82.03%'"); // City Rank box

    // CSS guarantees
    expect(cssSource).toContain('aspect-ratio: 2 / 3');
    expect(cssSource).toContain('container-type: inline-size');
    expect(cssSource).toContain('.cq-callsign-lg');
    expect(cssSource).toContain('.cq-callsign-md');
    expect(cssSource).toContain('.cq-callsign-sm');
    expect(cssSource).toContain('.cq-callsign-xs');
    expect(cssSource).not.toContain('overflow-wrap: anywhere');
  });

  it('safely renders nav avatar through the shared PlayerAvatar resolver without leaking raw file paths into text, with explicit 28px constraints', () => {
    const navSource = fs.readFileSync(path.join(process.cwd(), 'components/CinematicNav.tsx'), 'utf8');
    const avatarSource = fs.readFileSync(path.join(process.cwd(), 'components/PlayerAvatar.tsx'), 'utf8');
    const cssSource = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

    // Nav delegates avatar rendering to the shared PlayerAvatar resolver
    // instead of hand-rolling its own <img>/raw-text branch.
    expect(navSource).toContain('<PlayerAvatar');
    expect(navSource).not.toContain('<img');
    expect(navSource).not.toContain('<span>{player.avatarUrl ||');
    expect(navSource).toContain('cq-nav-avatar-img');

    // PlayerAvatar itself is the one place that decides image vs. raw-text
    // fallback, and it never renders an unresolved avatarUrl string as
    // visible text — only through isImageAvatarUrl-gated CSS background-image.
    expect(avatarSource).toContain('isImageAvatarUrl');
    expect(avatarSource).not.toMatch(/<span[^>]*>\s*\{avatarUrl/);

    expect(cssSource).toContain('.cq-nav-avatar-img');
    expect(cssSource).toContain('width: 28px');
    expect(cssSource).toContain('height: 28px');
    expect(cssSource).toContain('border-radius: 50%');
  });

  it('guarantees profile heading sits below fixed nav with dedicated header clearance and tactical typography', () => {
    const cssSource = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

    expect(cssSource).toContain('.cq-command-shell');
    expect(cssSource).toContain('padding: calc(4.75rem + 1.25rem)');
    expect(cssSource).toContain('.cq-command-hero h1');
    expect(cssSource).toContain('var(--font-rajdhani');
  });
});
