import {
  Achievement,
  DrawingEntryLedgerEntry,
  LeaderboardEntry,
  Player,
  PlayerAchievement,
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

export const VALID_STARTING_PATHS: readonly StartingPath[] = ['family', 'challenge', 'secret'];

export function hasValidStartingPath(player: Pick<Player, 'selectedStartingPath'>): boolean {
  return VALID_STARTING_PATHS.includes(player.selectedStartingPath as StartingPath);
}

/** True for a valid numbered preset, or a custom avatar that has an actual uploaded image behind it. */
export function hasValidAvatar(player: Pick<Player, 'avatarPresetKey' | 'profileImagePath'>): boolean {
  if (player.avatarPresetKey === CUSTOM_AVATAR_KEY) {
    return Boolean(player.profileImagePath);
  }
  return PLAYER_AVATAR_PRESETS.includes(player.avatarPresetKey as (typeof PLAYER_AVATAR_PRESETS)[number]);
}

/**
 * The minimum PERMANENT player identity setup: a valid avatar (preset or
 * uploaded custom). This — not account creation alone — is what unlocks the
 * one-time, account-level Player Identity onboarding reward.
 *
 * A starting path is deliberately NOT required here — it's independent of
 * whether the identity-completion reward has been earned. Path IS a
 * universal, permanent player attribute (players.selected_starting_path,
 * the canonical source — see hasValidStartingPath above), but requiring it
 * for the avatar-driven XP reward specifically was never re-added after
 * being relaxed during the Command Center/Operations reorganization. See
 * supabase/migrations/20260826072300_operation_scoped_path_and_fair_hunt.sql
 * for the one-time, zero-XP grandfather backfill that relaxation required
 * (mirroring the identical precedent in
 * 20260825000000_profile_completion_reward.sql) so relaxing the rule never
 * retroactively pays out +100 XP to an already-existing account — only
 * genuinely new completions from this point forward earn the live reward.
 */
export function isProfileIdentityComplete(
  player: Pick<Player, 'avatarPresetKey' | 'profileImagePath'>
): boolean {
  return hasValidAvatar(player);
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

export type PlayerSignalStatus = 'STANDBY' | 'ACTIVE' | 'ON MISSION';

/**
 * The Player Card's PLAYER SIGNAL field — the player's current
 * activity/status, derived from real persisted Mission engagement, not XP
 * or quest-participation lifetime totals (those are TOTAL XP / PLAYER
 * LEVEL respectively).
 *
 *   STANDBY    — no currently-active Mission, or the player hasn't joined it
 *   ACTIVE     — joined a currently-active Mission, no submission yet
 *   ON MISSION — has at least one submission (any status) in that Mission
 *
 * Pure and deterministic: callers resolve the three booleans from
 * event.status, event_players (getEventParticipationDB), and
 * quest_submissions (hasEventSubmissionDB) before calling this.
 */
export function getPlayerSignalStatus(params: {
  hasActiveMission: boolean;
  hasJoinedActiveMission: boolean;
  hasSubmissionInActiveMission: boolean;
}): PlayerSignalStatus {
  if (!params.hasActiveMission || !params.hasJoinedActiveMission) return 'STANDBY';
  if (params.hasSubmissionInActiveMission) return 'ON MISSION';
  return 'ACTIVE';
}

export function getPlayerCityRank(playerId: string, leaderboard: LeaderboardEntry[]) {
  const entry = leaderboard.find((item) => item.playerId === playerId);
  return entry && entry.totalPoints > 0 ? entry.rank : null;
}

export function countPrizeEntries(entries: DrawingEntryLedgerEntry[]) {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.entriesCount || 0), 0);
}
