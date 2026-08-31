/**
 * Canton Quests — universal path tone/persona helper.
 *
 * FAMILY / CHALLENGE / SECRET are a platform-wide COMMUNICATION STYLE
 * choice, not a Mission-specific branch. They control language, flavor
 * text, and presentation only — never quest access, prize pools, scoring,
 * leaderboards, or eligibility. See players.selected_starting_path
 * (lib/player-command-center.ts) for the canonical, universal source of a
 * player's chosen path.
 *
 * This is a single, centralized place for that tone — callers should
 * import from here rather than re-deriving their own path → copy mapping,
 * and should reuse a base/neutral message plus a small path-aware
 * flavor variation rather than writing three fully separate messages.
 */

import { StartingPath } from './types';

export interface PathTone {
  path: StartingPath;
  /** Display label, e.g. "FAMILY". */
  label: string;
  /** Short persona/style descriptor — communication tone, not geography. */
  styleTag: string;
  /** One-line description of the communication style itself. */
  description: string;
  /** Brand accent color already used for this path elsewhere in the UI. */
  color: string;
}

export const PATH_TONES: Record<StartingPath, PathTone> = {
  family: {
    path: 'family',
    label: 'FAMILY',
    styleTag: 'Adventure · Discovery · Teamwork',
    description: 'Welcoming, collaborative, and easy to jump into — built for exploring together.',
    color: '#f59e0b',
  },
  challenge: {
    path: 'challenge',
    label: 'CHALLENGE',
    styleTag: 'Competition · Intensity · Skill',
    description: 'Direct, energetic, and daring — built for players who want to prove themselves.',
    color: '#ef4444',
  },
  secret: {
    path: 'secret',
    label: 'SECRET',
    styleTag: 'Mystery · Codes · Hidden Knowledge',
    description: 'Cryptic, atmospheric, and investigative — built for uncovering what others miss.',
    color: '#a855f7',
  },
};

/** Returns the tone record for a path, or null if the player hasn't chosen one. */
export function getPathTone(path?: StartingPath | null): PathTone | null {
  if (!path) return null;
  return PATH_TONES[path] || null;
}

/**
 * A small library of base messages, each with a neutral default plus a
 * path-flavored variant — the gameplay fact stays identical across all
 * four; only the wording changes. Add new keys here as real call sites
 * need them rather than inventing per-caller copy.
 */
const PATH_FLAVOR_MESSAGES = {
  new_quest_available: {
    neutral: 'New Quest available.',
    family: 'A new adventure is ready.',
    challenge: 'Your next challenge is live.',
    secret: 'A new signal has surfaced.',
  },
  welcome_back: {
    neutral: 'Welcome back.',
    family: 'Good to have the crew back together.',
    challenge: "Back for more? Let's move.",
    secret: 'The signal recognizes you. Proceed.',
  },
  quest_complete: {
    neutral: 'Quest complete.',
    family: 'Great find — quest complete!',
    challenge: 'Objective cleared. Keep the pace up.',
    secret: 'Cipher resolved. The trail continues.',
  },
} as const;

export type PathFlavorMessageKey = keyof typeof PATH_FLAVOR_MESSAGES;

/**
 * Returns the base message, flavored for the player's path if they have
 * one — otherwise the neutral default. The underlying fact never changes,
 * only the tone of how it's said.
 */
export function getPathFlavorMessage(key: PathFlavorMessageKey, path?: StartingPath | null): string {
  const entry = PATH_FLAVOR_MESSAGES[key];
  if (!path) return entry.neutral;
  return entry[path] || entry.neutral;
}
