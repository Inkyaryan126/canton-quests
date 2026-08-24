import {
  Achievement,
  DrawingEntryLedgerEntry,
  LeaderboardEntry,
  Player,
  PlayerAchievement,
  PlayerEventProgress,
  Quest,
  QuestPath,
  StartingPath,
} from './types';

export const PLAYER_AVATAR_PRESETS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
export const CUSTOM_AVATAR_KEY = 'custom';
export const PLAYER_CARD_BADGE_SLOT_COUNT = 6;
export const CANONICAL_BADGE_ICON_PATHS: Record<string, string> = {
  'pathfinder-family': '/canton-quests/badges/family.png',
  'pathfinder-challenge': '/canton-quests/badges/challenge.png',
  'pathfinder-secret': '/canton-quests/badges/initiated.png',
  'district-sweep-family': '/canton-quests/badges/day1.png',
  'district-sweep-challenge': '/canton-quests/badges/oneanddone.png',
  'district-sweep-secret': '/canton-quests/badges/day2.png',
  'triple-threat': '/canton-quests/badges/3daysavior.png',
  nomad: '/canton-quests/badges/finisher.png',
  'day-one-king': '/canton-quests/badges/first_step.png',
};
export const DEFAULT_BADGE_ICON_PATH = '/canton-quests/badges/first_step.png';

export const STARTING_DISTRICTS: Record<
  StartingPath,
  { label: string; district: string; color: string; accentClass: string }
> = {
  family: {
    label: 'FAMILY',
    district: 'Arts District',
    color: '#f59e0b',
    accentClass: 'cq-path-family',
  },
  challenge: {
    label: 'CHALLENGE',
    district: '9th St Skate Park area',
    color: '#ef4444',
    accentClass: 'cq-path-challenge',
  },
  secret: {
    label: 'SECRET',
    district: 'West Lawn Cemetery / McKinley area',
    color: '#a855f7',
    accentClass: 'cq-path-secret',
  },
};

export interface DistrictProgress {
  path: QuestPath;
  label: string;
  completed: number;
  total: number;
}

export interface RecentFieldActivity {
  id: string;
  label: string;
  detail: string;
  occurredAt: string;
}

export function getStartingDistrict(path?: StartingPath) {
  return STARTING_DISTRICTS[path || 'family'];
}

export function getAvatarPresetPath(key?: string) {
  return PLAYER_AVATAR_PRESETS.includes(key as (typeof PLAYER_AVATAR_PRESETS)[number])
    ? `/canton-quests/${key}.png`
    : '/canton-quests/1.png';
}

/**
 * Resolves the avatar URL a player's chosen key should actually render.
 * A player with a custom uploaded photo selected only resolves to it while
 * that upload still exists; otherwise falls back to the numbered preset.
 */
export function resolveAvatarUrl(player: Pick<Player, 'id' | 'avatarPresetKey' | 'profileImagePath'>) {
  if (player.avatarPresetKey === CUSTOM_AVATAR_KEY && player.profileImagePath) {
    return `/api/player/${player.id}/avatar`;
  }
  return getAvatarPresetPath(player.avatarPresetKey);
}

export function sanitizeFeaturedBadges(
  requested: unknown,
  earned: PlayerAchievement[],
  maxSlots = PLAYER_CARD_BADGE_SLOT_COUNT
): string[] {
  const earnedSlugs = new Set(earned.map((item) => item.achievementSlug || item.achievement?.slug).filter(Boolean));
  if (!Array.isArray(requested)) return [];

  const selected: string[] = [];
  for (const raw of requested) {
    const slug = String(raw || '').trim();
    if (!slug || selected.includes(slug) || !earnedSlugs.has(slug)) continue;
    selected.push(slug);
    if (selected.length >= maxSlots) break;
  }
  return selected;
}

export function validateFeaturedBadges(
  requested: unknown,
  earned: PlayerAchievement[],
  maxSlots = PLAYER_CARD_BADGE_SLOT_COUNT
): { ok: true; slugs: string[] } | { ok: false; error: string } {
  if (!Array.isArray(requested)) return { ok: true, slugs: [] };
  const normalized = requested.map((item) => String(item || '').trim()).filter(Boolean);
  if (new Set(normalized).size !== normalized.length) {
    return { ok: false, error: 'Duplicate featured BADGES are not allowed.' };
  }
  if (normalized.length > maxSlots) {
    return { ok: false, error: `Only ${maxSlots} featured BADGES can fit on the Player ID Card.` };
  }
  const earnedSlugs = new Set(earned.map((item) => item.achievementSlug || item.achievement?.slug).filter(Boolean));
  const invalid = normalized.find((slug) => !earnedSlugs.has(slug));
  if (invalid) {
    return { ok: false, error: 'Only earned BADGES can be featured.' };
  }
  return { ok: true, slugs: normalized };
}

export function getBadgeIconPath(achievement: Achievement) {
  return CANONICAL_BADGE_ICON_PATHS[achievement.slug] || DEFAULT_BADGE_ICON_PATH;
}

export function computeDistrictProgress(quests: Quest[], completedQuestIds: string[]): DistrictProgress[] {
  const completed = new Set(completedQuestIds);
  const labels: Record<QuestPath, string> = {
    family: 'Arts District',
    challenge: '9th St / Challenge District',
    secret: 'West Lawn / McKinley',
    cross_city: 'Citywide',
  };
  const paths: QuestPath[] = ['family', 'challenge', 'secret', 'cross_city'];
  return paths
    .map((path) => {
      const districtQuests = quests.filter((quest) => (quest.startingPath || 'family') === path && quest.status === 'active');
      return {
        path,
        label: labels[path],
        completed: districtQuests.filter((quest) => completed.has(quest.id)).length,
        total: districtQuests.length,
      };
    })
    .filter((row) => row.total > 0);
}

export function recommendQuests(quests: Quest[], player: Player, progress: PlayerEventProgress): Quest[] {
  const completed = new Set(progress.completedQuestIds);
  const pending = new Set(progress.pendingSubmissionQuestIds);
  const path = player.selectedStartingPath || 'family';
  return quests
    .filter((quest) => quest.status === 'active' && !completed.has(quest.id))
    .sort((a, b) => {
      const aPending = pending.has(a.id) ? 0 : 1;
      const bPending = pending.has(b.id) ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      const aHome = a.startingPath === path ? 0 : 1;
      const bHome = b.startingPath === path ? 0 : 1;
      if (aHome !== bHome) return aHome - bHome;
      const aFlash = a.isFlash ? 0 : 1;
      const bFlash = b.isFlash ? 0 : 1;
      if (aFlash !== bFlash) return aFlash - bFlash;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
}

export function getPlayerCityRank(playerId: string, leaderboard: LeaderboardEntry[]) {
  const entry = leaderboard.find((item) => item.playerId === playerId);
  return entry && entry.totalPoints > 0 ? entry.rank : null;
}

export function countPrizeEntries(entries: DrawingEntryLedgerEntry[]) {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.entriesCount || 0), 0);
}

export function buildRecentActivity(
  completedQuests: Quest[],
  earnedBadges: PlayerAchievement[],
  entries: DrawingEntryLedgerEntry[]
): RecentFieldActivity[] {
  const questItems = completedQuests.map((quest) => ({
    id: `quest-${quest.id}`,
    label: 'Quest completed',
    detail: quest.title,
    occurredAt: quest.createdAt,
  }));
  const badgeItems = earnedBadges.map((badge) => ({
    id: `badge-${badge.id}`,
    label: 'BADGE earned',
    detail: badge.achievement?.name || badge.achievementSlug,
    occurredAt: badge.earnedAt,
  }));
  const entryItems = entries.map((entry) => ({
    id: `entry-${entry.id}`,
    label: 'Prize entry earned',
    detail: entry.reason || 'Verified quest completion',
    occurredAt: entry.createdAt,
  }));

  return [...questItems, ...badgeItems, ...entryItems]
    .sort((a, b) => new Date(b.occurredAt || 0).getTime() - new Date(a.occurredAt || 0).getTime())
    .slice(0, 8);
}

export function shouldExposePlayerImage(player: Player, isOwner = false) {
  if (isOwner) return true;
  if (player.profileVisibility === 'private') return false;
  return player.playerImageVisibility === 'public';
}
