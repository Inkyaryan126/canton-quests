/**
 * CANTON QUESTS — PRE-LAUNCH & LAUNCH STATUS UTILITIES
 *
 * Centralizes launch timing, known Canton launch slugs, and pre-launch detection logic.
 * Canonical public launch kickoff: September 11, 2026 at 18:00 UTC.
 */

import { QuestEvent } from './types';

export const CANONICAL_LAUNCH_DATE_ISO = '2026-09-11T18:00:00Z';
export const CANONICAL_LAUNCH_DATE_DISPLAY = 'September 11, 2026';

/**
 * Set of known route slugs associated with the Canton launch event.
 */
export const KNOWN_CANTON_LAUNCH_SLUGS = new Set([
  'canton-weekend-1',
  'canton-launch-2026',
  'canton-vol-1',
  'canton-volume-1',
  'canton-quests-vol-1',
  'canton-founder-cipher',
  'the-founders-cipher',
  'canton-weekend-launch',
  'canton-2026',
  'canton-launch',
  'launch-2026',
  'default-event',
]);

/**
 * Determines if a given slug is a known Canton Quests launch event slug.
 */
export function isKnownCantonLaunchSlug(slug?: string | null): boolean {
  if (!slug) return false;
  const normalized = slug.trim().toLowerCase();
  if (KNOWN_CANTON_LAUNCH_SLUGS.has(normalized)) return true;
  if (
    normalized.startsWith('canton-') &&
    (normalized.includes('launch') ||
      normalized.includes('vol') ||
      normalized.includes('cipher') ||
      normalized.includes('weekend') ||
      normalized.includes('founder'))
  ) {
    return true;
  }
  return false;
}

/**
 * Checks whether the current time is before the official launch date.
 */
export function isBeforeLaunchDate(currentTime?: Date | string | number): boolean {
  const now = currentTime ? new Date(currentTime).getTime() : Date.now();
  const launchTime = new Date(CANONICAL_LAUNCH_DATE_ISO).getTime();
  return now < launchTime;
}

/**
 * Checks whether an event context represents a pre-launch state.
 *
 * Returns true if:
 * 1. The slug is a known Canton launch context and the event is not yet live/active or before launch date.
 * 2. An event exists and has status 'upcoming' or 'inactive', or start time is in the future.
 */
export function isPreLaunchEvent(
  event?: QuestEvent | null,
  slug?: string | null,
  currentTime?: Date | string | number
): boolean {
  // If no event object exists but the slug is a recognized Canton launch context
  if (!event) {
    return isKnownCantonLaunchSlug(slug);
  }

  // If event explicitly marked draft, ready, upcoming, or inactive
  const statusStr = (event.status as string) || '';
  if (statusStr === 'draft' || statusStr === 'ready' || statusStr === 'upcoming' || statusStr === 'inactive') {
    return true;
  }

  // If event has a future start time
  if (event.startTime) {
    const eventStartTime = new Date(event.startTime).getTime();
    const now = currentTime ? new Date(currentTime).getTime() : Date.now();
    if (now < eventStartTime) {
      return true;
    }
  }

  return false;
}

export type OperationLifecycleStage = 'upcoming' | 'active' | 'finale' | 'ended';

/**
 * Classifies an Operation into a coarse presentation stage — upcoming,
 * active, finale, or ended — so the public event page can keep showing an
 * intentional, polished state throughout the Operation's whole lifecycle
 * instead of only before launch.
 *
 * Prefers the game-master-controlled `currentPhase` (already wired through
 * the admin live-control panel) when present, since it's the most accurate
 * signal; falls back to `status`/timing when phase data isn't available.
 */
export function getOperationLifecycleStage(
  event?: QuestEvent | null,
  slug?: string | null,
  currentTime?: Date | string | number
): OperationLifecycleStage {
  if (isPreLaunchEvent(event, slug, currentTime)) return 'upcoming';
  if (!event) return 'upcoming';

  if (event.currentPhase === 'finale') return 'finale';
  if (event.currentPhase === 'ended') return 'ended';

  if (event.status === 'ended') return 'ended';

  if (event.endTime) {
    const now = currentTime ? new Date(currentTime).getTime() : Date.now();
    if (now >= new Date(event.endTime).getTime()) return 'ended';
  }

  if (event.currentPhase === 'final_hours') return 'finale';

  return 'active';
}
