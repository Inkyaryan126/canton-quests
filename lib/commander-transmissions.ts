/**
 * Canton Quests — Founder's Cipher Commander Transmission Archive.
 *
 * Canonical registry for the owner's real, web-compressed Commander videos
 * (currently 1-15, portrait 9:16). This is intentionally separate from the
 * per-quest QuestCommanderTransmission system in lib/types.ts (see
 * components/commander/CommanderMedia.tsx) — that system is placeholder
 * narrative media attached to individual quest opens/completions; this one
 * is the sequential, standalone Commander briefing archive for the
 * Founder's Cipher Operation specifically, and is also the canonical
 * gameplay-trigger source of truth: each video's optional `trigger` (and,
 * for the three path videos, `path`) is what
 * `getCommanderTransmissionForTrigger` below matches against.
 *
 * Titles reflect the owner-provided intended content for each numbered
 * video. `phase` is left unset rather than guessed — no documented mapping
 * exists yet. All 15 are unlocked in this registry (no release schedule
 * exists) — `availableFrom`/`availableUntil`/`locked` remain here so a
 * future timed release can be added without a data-shape change. Per-player
 * *gameplay* unlock (has this player actually reached the moment this video
 * is tied to yet) is a separate, server-verified concept — see
 * lib/commander-video-unlock.ts — this file never decides that on its own.
 */

import { EventPhaseType, QuestCommanderTransmission, StartingPath } from './types';
import { CommanderTransmissionTrigger } from './game-effects';

export interface CommanderTransmissionEntry {
  /** 1-15 today; add 16+ by appending entries, no renumbering required. */
  id: number;
  order: number;
  title: string;
  videoUrl: string;
  posterUrl: string;
  /** Unset until a real phase mapping is documented — never guessed. */
  phase?: EventPhaseType;
  /** Shown as the "current" transmission on the Operation home teaser. */
  featured?: boolean;
  availableFrom?: string;
  availableUntil?: string;
  locked?: boolean;
  /** The gameplay moment this video is tied to, if any. Archive-only videos (none today) omit this. */
  trigger?: CommanderTransmissionTrigger;
  /** Set only for the three path-selection videos (6/7/8) — the resolver requires an exact match against the player's chosen path. */
  path?: StartingPath;
}

function entry(
  id: number,
  videoUrl: string,
  title: string,
  meta?: { trigger?: CommanderTransmissionTrigger; path?: StartingPath }
): CommanderTransmissionEntry {
  return {
    id,
    order: id,
    title,
    videoUrl,
    posterUrl: `/commander-transmissions/transmission-${id}-poster.jpg`,
    featured: id === 1,
    locked: false,
    trigger: meta?.trigger,
    path: meta?.path,
  };
}

export const COMMANDER_TRANSMISSIONS: CommanderTransmissionEntry[] = [
  entry(1, '/cq_web_videos/1_web.mp4', 'Cold Open', { trigger: 'cipher_cold_open' }),
  entry(2, '/cq_web_videos/2_web.mp4', 'Welcome to Canton Quests', { trigger: 'cipher_welcome' }),
  entry(3, '/cq_web_videos/3_web.mp4', 'Cash Prize Challenge', { trigger: 'cipher_prize_intro' }),
  entry(4, '/cq_web_videos/4_web.mp4', 'Basic Rules', { trigger: 'cipher_rules_intro' }),
  entry(5, '/cq_web_videos_5_9/5_web.mp4', 'Your City Is the Board', { trigger: 'cipher_city_intro' }),
  entry(6, '/cq_web_videos_5_9/6_web.mp4', 'Family Path', { trigger: 'cipher_path_selected', path: 'family' }),
  entry(7, '/cq_web_videos_5_9/7_web.mp4', 'Challenge Path', { trigger: 'cipher_path_selected', path: 'challenge' }),
  entry(8, '/cq_web_videos_5_9/8_web.mp4', 'Secret Path', { trigger: 'cipher_path_selected', path: 'secret' }),
  entry(9, '/cq_web_videos_5_9/9_web.mp4', 'Three Doors — One Competition', { trigger: 'cipher_three_doors' }),
  entry(10, '/cq_web_videos_10_15/10_web.mp4', 'Create Your Callsign', { trigger: 'cipher_callsign' }),
  entry(11, '/cq_web_videos_10_15/11_web.mp4', 'Your Player Profile', { trigger: 'cipher_profile' }),
  entry(12, '/cq_web_videos_10_15/12_web.mp4', 'How XP Works', { trigger: 'cipher_first_xp' }),
  entry(13, '/cq_web_videos_10_15/13_web.mp4', 'How Prize Entries Work', { trigger: 'cipher_first_entry' }),
  entry(14, '/cq_web_videos_10_15/14_web.mp4', 'The Leaderboard', { trigger: 'cipher_leaderboard' }),
  entry(15, '/cq_web_videos_10_15/15_web.mp4', 'How to Read a Quest', { trigger: 'cipher_first_quest' }),
];

export function getFeaturedTransmission(): CommanderTransmissionEntry {
  return COMMANDER_TRANSMISSIONS.find((t) => t.featured) || COMMANDER_TRANSMISSIONS[0];
}

export function getTransmissionById(id: number): CommanderTransmissionEntry | undefined {
  return COMMANDER_TRANSMISSIONS.find((t) => t.id === id);
}

export function getAdjacentTransmissionIds(id: number): { prevId: number | null; nextId: number | null } {
  const index = COMMANDER_TRANSMISSIONS.findIndex((t) => t.id === id);
  if (index === -1) return { prevId: null, nextId: null };
  return {
    prevId: index > 0 ? COMMANDER_TRANSMISSIONS[index - 1].id : null,
    nextId: index < COMMANDER_TRANSMISSIONS.length - 1 ? COMMANDER_TRANSMISSIONS[index + 1].id : null,
  };
}

/**
 * The central resolver mentioned in the mission brief: given a gameplay
 * trigger (and, for path videos, the player's path), returns the one
 * numbered video that applies — or undefined if none does. Deliberately
 * stateless and free of player/auth concerns (no secrets, no viewed-state,
 * no event-scope check) — callers already gate on event scope the same way
 * every other Cipher-only surface in this codebase does
 * (isKnownCantonLaunchSlug(eventSlug)), and the EXISTING
 * shouldAutoShowTransmission/markTransmissionViewed pair
 * (lib/transmission-viewed-state.ts) remains the de-dupe mechanism, exactly
 * as it already works for the per-quest transmission system.
 */
export function getCommanderTransmissionForTrigger(params: {
  trigger: CommanderTransmissionTrigger;
  path?: StartingPath;
}): CommanderTransmissionEntry | undefined {
  return COMMANDER_TRANSMISSIONS.find((t) => {
    if (t.trigger !== params.trigger) return false;
    if (t.path && t.path !== params.path) return false;
    return true;
  });
}

/**
 * Converts a numbered archive entry into the existing
 * QuestCommanderTransmission shape so it can flow through the unmodified
 * GameMomentManager / CommanderTransmissionEffect / CommanderMedia
 * pipeline exactly like any per-quest transmission. No spoken dialogue is
 * invented for `message` — the videos carry their own real audio and no
 * transcript/script exists in this project to quote from.
 */
export function toGameplayTransmission(entry: CommanderTransmissionEntry): QuestCommanderTransmission {
  return {
    type: 'VIDEO',
    message: 'Play the transmission to hear the full briefing from the Commander.',
    headline: entry.title,
    mediaKey: entry.videoUrl,
    posterKey: entry.posterUrl,
    mediaAspect: 'portrait',
    cta: 'CONTINUE',
    replayable: true,
    skippable: true,
  };
}
