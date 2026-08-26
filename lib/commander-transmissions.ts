/**
 * Canton Quests — Founder's Cipher Commander Transmission Archive.
 *
 * Canonical registry for the owner's real, web-compressed Commander videos
 * (currently 1-15, portrait 9:16). This is intentionally separate from the
 * per-quest QuestCommanderTransmission system in lib/types.ts (see
 * components/commander/CommanderMedia.tsx) — that system is placeholder
 * narrative media attached to individual quest opens/completions; this one
 * is the sequential, standalone Commander briefing archive for the
 * Founder's Cipher Operation specifically.
 *
 * Exact titles/phases for these 15 are not documented anywhere in the
 * project — do not invent them. `title` defaults to "COMMANDER
 * TRANSMISSION NN"; `phase` is left unset rather than guessed. All 15 are
 * unlocked (no release schedule exists yet) — `availableFrom`/
 * `availableUntil`/`locked` are here so a future timed release can be
 * added without a data-shape change.
 */

import { EventPhaseType } from './types';

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
}

function entry(id: number, videoUrl: string): CommanderTransmissionEntry {
  return {
    id,
    order: id,
    title: `COMMANDER TRANSMISSION ${String(id).padStart(2, '0')}`,
    videoUrl,
    posterUrl: `/commander-transmissions/transmission-${id}-poster.jpg`,
    featured: id === 1,
    locked: false,
  };
}

export const COMMANDER_TRANSMISSIONS: CommanderTransmissionEntry[] = [
  entry(1, '/cq_web_videos/1_web.mp4'),
  entry(2, '/cq_web_videos/2_web.mp4'),
  entry(3, '/cq_web_videos/3_web.mp4'),
  entry(4, '/cq_web_videos/4_web.mp4'),
  entry(5, '/cq_web_videos_5_9/5_web.mp4'),
  entry(6, '/cq_web_videos_5_9/6_web.mp4'),
  entry(7, '/cq_web_videos_5_9/7_web.mp4'),
  entry(8, '/cq_web_videos_5_9/8_web.mp4'),
  entry(9, '/cq_web_videos_5_9/9_web.mp4'),
  entry(10, '/cq_web_videos_10_15/10_web.mp4'),
  entry(11, '/cq_web_videos_10_15/11_web.mp4'),
  entry(12, '/cq_web_videos_10_15/12_web.mp4'),
  entry(13, '/cq_web_videos_10_15/13_web.mp4'),
  entry(14, '/cq_web_videos_10_15/14_web.mp4'),
  entry(15, '/cq_web_videos_10_15/15_web.mp4'),
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
