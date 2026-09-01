/**
 * Canton Quests — Founder's Cipher canonical gameplay message registry types.
 *
 * Architecture:
 *
 *   GAME STATE / EVENT
 *           ↓
 *   CANONICAL MESSAGE ID (FounderCipherMessageId)
 *           ↓
 *   COMMON GAMEPLAY FACT (facts — informational only, never re-derives truth)
 *           ↓
 *   PATH-SPECIFIC WORDING (family / challenge / secret / neutral)
 *           ↓
 *   COMMANDER / OVERLAY / TRANSMISSION UI
 *
 * The gameplay FACT behind a message (what actually happened) never changes
 * between paths — only the tone of how it's communicated. See
 * lib/path-tone.ts for the platform-wide path-tone helper this registry
 * builds on; this file is Founder's-Cipher-specific gameplay copy, not the
 * universal path system itself.
 */

import { StartingPath } from '@/lib/types';

/**
 * Stable canonical ids for every Founder's Cipher gameplay moment this
 * registry knows about. Names mirror the game's own real terminology
 * (cipher fragment, district, sigil, Founder Lock, Master Cipher) rather
 * than generic placeholders.
 */
export type FounderCipherMessageId =
  | 'MISSION_ENTERED'
  | 'MISSION_BRIEFING'
  | 'PLAYER_IDENTITY_CONFIRMED'
  | 'QUEST_AVAILABLE'
  | 'QUEST_STARTED'
  | 'DISTRICT_ENTERED'
  | 'CIPHER_FRAGMENT_FOUND'
  | 'FIRST_CIPHER_FRAGMENT_RECOVERED'
  | 'CIPHER_FRAGMENT_STORED'
  | 'CIPHER_NOT_READY_TO_DECODE'
  | 'DISTRICT_READY_TO_DECODE'
  | 'DISTRICT_SIGIL_UNLOCKED'
  | 'FOUNDER_LOCK_RECOVERED'
  | 'ALL_THREE_LOCKS_RECOVERED'
  | 'ALL_THREE_SIGILS_DECODED'
  | 'MASTER_CIPHER_AVAILABLE'
  | 'CLUE_DISCOVERED'
  | 'INVALID_ANSWER'
  | 'CORRECT_ANSWER'
  | 'QUEST_COMPLETED'
  | 'DISTRICT_OBJECTIVE_COMPLETE'
  | 'KEY_FOUND'
  | 'NEXT_LOCATION_REVEALED'
  | 'NEXT_DISTRICT_REVEALED'
  | 'ARTIFACT_FOUND'
  | 'XP_AWARDED'
  | 'ENTRY_AWARDED'
  | 'BADGE_AWARDED'
  | 'TRANSMISSION_RECEIVED'
  | 'DISTRICT_REMAINING'
  | 'BELL_EVENT_REACHED'
  | 'ALL_REQUIRED_FRAGMENTS_FOUND'
  | 'FINAL_DECODE_AVAILABLE'
  | 'CIPHER_SOLVED'
  | 'FINALE_UNLOCKED'
  | 'FINAL_SOLUTION_CORRECT'
  | 'MISSION_COMPLETE'
  | 'PALACE_SIGNAL_ANOMALY';

/** How much room a message needs — drives which presentation level renders it. See section 10/4 of the design brief. */
export type MessagePresentation = 'micro' | 'commander-text' | 'archive' | 'video';

/** Message body length — controls the Commander Text Transmission template's layout (lib/gameplay/founders-cipher's consumer: components/commander/CommanderTextTransmission.tsx). */
export type MessageSize = 'short' | 'medium' | 'long';

export interface PathFlavorContent {
  /** Optional per-path title override. Falls back to the message's base title if omitted. */
  title?: string;
  /** The path-flavored body copy. Required — this is the actual wording players see. */
  body: string;
  /** Optional CTA label override for this path (rare — CTAs are usually neutral). */
  cta?: string;
}

export interface FounderCipherMessage {
  id: FounderCipherMessageId;
  /** Base/neutral title, used whenever a path doesn't supply its own and when no path is set at all. */
  title: string;
  /** Neutral fallback body — shown when the player has no universal path yet. Never omitted: this is the safe default every message must have. */
  neutral: string;
  family: PathFlavorContent;
  challenge: PathFlavorContent;
  secret: PathFlavorContent;
  presentation: MessagePresentation;
  size: MessageSize;
  /** Default CTA label for the Commander Text Transmission's continue button, if any. */
  cta?: string;
  /** Higher fires above lower if multiple moments are queued at once — mirrors lib/game-effects.ts's own priority convention. Omit for normal priority. */
  priority?: number;
  /**
   * Whether this exact message instance should only ever be shown once per
   * player (guarded by the caller, typically via
   * lib/transmission-viewed-state.ts's existing viewed-state store with this
   * message id as the subject key). Informational for callers — the
   * registry itself does not enforce it.
   */
  onceOnly?: boolean;
  /**
   * Whether a delivered instance of this message should be recoverable
   * later from the player's Transmission archive (see
   * lib/gameplay/founders-cipher/message-log.ts). Reserved for
   * medium/long, narratively-important messages — not every micro moment.
   */
  archiveWorthy?: boolean;
}

/** The fully-resolved, ready-to-render content for one player's path. */
export interface ResolvedFounderCipherMessage {
  id: FounderCipherMessageId;
  title: string;
  body: string;
  cta?: string;
  presentation: MessagePresentation;
  size: MessageSize;
  path: StartingPath | null;
  archiveWorthy: boolean;
}
