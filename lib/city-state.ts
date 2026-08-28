/**
 * Canton Quests — Community Progress / City State
 * ===================================================
 * A single, coherent aggregate projection of "how is the whole city doing
 * right now" — assembled entirely from data that already exists (event
 * participation, quest submissions, Founder's Cipher district progress,
 * Player Links, Live City Events). No new schema; this is a pure
 * read-composition layer. See lib/city-state-db.ts for the actual queries.
 *
 * "activePlayers" is honestly scoped: there is no real-time presence
 * tracking anywhere in this codebase (confirmed during the Live City
 * Events mission's own architecture audit), so this counts players with at
 * least one quest_submission for the event — a measurable proxy for
 * participation, never a fabricated "N players online right now" claim.
 */

export interface DistrictProgressSummary {
  /** Fraction (0-1) of required fragments collected across all players who have touched this district at all — a rough city-wide completion pulse, not a per-player stat. */
  fractionComplete: number;
  playersWithProgress: number;
  playersUnlocked: number;
}

export interface SigilDistribution {
  oneDistrict: number;
  twoDistricts: number;
  threeDistricts: number;
}

export interface CityStateProjection {
  eventId: string;
  registeredPlayers: number;
  activePlayers: number;
  totalCompletedQuests: number;
  districtProgress: {
    arts: DistrictProgressSummary;
    challenge: DistrictProgressSummary;
    secret: DistrictProgressSummary;
  };
  totalPlayerLinks: number;
  sigilDistribution: SigilDistribution;
  /** Players who have unlocked all three district sigils — eligible for Founder's Cipher convergence (Mission 8). */
  convergenceReadyPlayers: number;
  computedAt: string;
}

/** The safe, player-facing shape — every field here is already a city-wide aggregate with zero per-player identity, so nothing needs stripping; this type alias exists purely to make the "this is the public contract" intent explicit at call sites. */
export type PublicCityState = CityStateProjection;
