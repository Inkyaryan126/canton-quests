/**
 * Canton Quests — Player-to-Player Links
 * =========================================
 * Pure types and decision logic for event-safe player links — no permanent
 * teams, just a server-authoritative record that two (or more) players met
 * in the game. No database access here; see lib/player-links-db.ts.
 *
 * Privacy: the only identity ever exposed through this system is a
 * player's own `id` (already public via the roster — see
 * lib/supabase-db.ts's PublicRosterEntry) and displayName. No email, no
 * exact GPS coordinates are ever part of a link payload or stored on the
 * player_links row — proximity, where a link type requires it, is checked
 * once at the moment of linking and discarded, never persisted.
 */

import { StartingPath } from './types';

export type PlayerLinkType =
  | 'PLAYER_LINK'
  | 'DIFFERENT_PATH_LINK'
  | 'GROUP_OBJECTIVE'
  | 'STRANGER_BONUS'
  | 'TRANSFERABLE_SIGNAL'
  | 'RARE_PAIRING';

export interface PlayerLinkConfig {
  xpAwarded: number;
  /** Human-readable label for the resulting Commander/HUD announcement. */
  label: string;
  /** Whether this link type requires the two players to be on different starting paths. */
  requiresDifferentPath?: boolean;
  /** Whether this link type requires a minimum of 3 distinct players (a GROUP_OBJECTIVE). */
  requiresGroup?: boolean;
}

export const PLAYER_LINK_CONFIG: Record<PlayerLinkType, PlayerLinkConfig> = {
  PLAYER_LINK: { xpAwarded: 15, label: 'Field Link Established' },
  DIFFERENT_PATH_LINK: { xpAwarded: 25, label: 'Cross-Path Link', requiresDifferentPath: true },
  GROUP_OBJECTIVE: { xpAwarded: 20, label: 'Group Signal Formed', requiresGroup: true },
  STRANGER_BONUS: { xpAwarded: 15, label: 'Stranger Signal' },
  TRANSFERABLE_SIGNAL: { xpAwarded: 10, label: 'Signal Transferred' },
  RARE_PAIRING: { xpAwarded: 40, label: 'Rare Pairing' },
};

/**
 * Canonical, order-independent identity for a pair of players — sorting by
 * id means (A, B) and (B, A) always produce the same key, which is what the
 * reward_grants idempotency check keys off of. Never expose this string
 * itself to a client; it's purely an internal dedup key.
 */
export function computePairKey(playerAId: string, playerBId: string): string {
  return [playerAId, playerBId].sort().join(':');
}

/** The reward_grants rewardKey for a given link type + pair — see the migration's uq_reward_grants_player_event_type_key_no_quest index. */
export function computeLinkRewardKey(linkType: PlayerLinkType, pairKey: string): string {
  return `link:${linkType}:${pairKey}`;
}

export type PlayerLinkEligibility =
  | { ok: true }
  | { ok: false; reason: 'self_link' | 'wrong_path' | 'not_in_event'; message: string };

/**
 * Validates a proposed link before any database write — pure, so it's
 * fully unit-testable. Does not check for prior farming (that's an
 * idempotent database write, not a pre-check — see
 * lib/player-links-db.ts's createPlayerLinkDB).
 */
export function validatePlayerLinkEligibility(params: {
  linkType: PlayerLinkType;
  initiatorId: string;
  targetId: string;
  initiatorInEvent: boolean;
  targetInEvent: boolean;
  initiatorPath?: StartingPath | null;
  targetPath?: StartingPath | null;
}): PlayerLinkEligibility {
  if (params.initiatorId === params.targetId) {
    return { ok: false, reason: 'self_link', message: 'You cannot link with yourself.' };
  }
  if (!params.initiatorInEvent || !params.targetInEvent) {
    return { ok: false, reason: 'not_in_event', message: 'Both players must be registered for this Mission.' };
  }
  const config = PLAYER_LINK_CONFIG[params.linkType];
  if (config.requiresDifferentPath && params.initiatorPath && params.targetPath && params.initiatorPath === params.targetPath) {
    return { ok: false, reason: 'wrong_path', message: 'This link requires two players on different starting paths.' };
  }
  return { ok: true };
}

export interface SafePlayerLinkProfile {
  id: string;
  displayName: string;
  path?: StartingPath | null;
  avatarUrl?: string;
}

/** Strips a player row down to exactly what a link payload/QR scan result is allowed to expose — never email, never exact GPS, never anything else on the players table. */
export function toSafePlayerLinkProfile(player: { id: string; displayName: string; selectedStartingPath?: StartingPath | null; avatarUrl?: string }): SafePlayerLinkProfile {
  return {
    id: player.id,
    displayName: player.displayName,
    path: player.selectedStartingPath ?? null,
    avatarUrl: player.avatarUrl,
  };
}
