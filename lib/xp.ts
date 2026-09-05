/**
 * Canton Quests — shared XP/level math.
 *
 * The single source of truth for the level formula every XP-award call site
 * (quest completion, profile milestones, Field NPCs, bounties, finale,
 * Player Links, social share, lucky pickups) must agree on. Previously
 * duplicated as the literal `Math.floor(totalXp / 250) + 1` in six places
 * across lib/supabase-db.ts, lib/field-npcs-db.ts, lib/bounties-db.ts,
 * lib/finale-db.ts, and lib/player-links-db.ts.
 */
export const LEVEL_XP_STEP = 250;

export function computeLevelForXp(totalXp: number): number {
  return Math.floor(Math.max(0, totalXp) / LEVEL_XP_STEP) + 1;
}

/**
 * Client-safe XP constants shared between server reward logic and
 * player-facing UI copy — kept here (not lib/supabase-db.ts, which pulls in
 * server-only Supabase admin clients) so a 'use client' page can import the
 * exact number without bundling server code.
 */
export const SOCIAL_SHARE_XP = 20;
