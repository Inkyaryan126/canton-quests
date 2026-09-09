// Canton Quests — Admin-Only Prelaunch Field Test Mode
//
// Server-only. This module imports lib/admin-auth.ts (next/headers), so it
// must never be imported from a 'use client' component — client pages read
// the resulting isPreLaunch/fieldTestActive flags from API responses
// instead (see app/events/[slug]/page.tsx and
// app/events/[slug]/quests/[questId]/page.tsx). lib/launch-status.ts stays
// free of this import specifically so it remains safe for client bundles.

import { QuestEvent } from './types';
import { isPreLaunchEvent } from './launch-status';
import { resolveAdminSessionFromRequest } from './admin-auth';

/**
 * Whether the request is asking to activate Admin Field Test Mode
 * (?fieldTest=1). This alone grants nothing — see resolveFieldTestAccess.
 */
export function isFieldTestRequested(request: Request): boolean {
  try {
    const { searchParams } = new URL(request.url);
    return searchParams.get('fieldTest') === '1';
  } catch {
    return false;
  }
}

/**
 * Server-authoritative Admin Field Test Mode resolution, shared by every
 * endpoint that exposes or mutates prelaunch gameplay (GET
 * /api/game/events/[slug], POST /api/game/submit). A request is never
 * trusted merely because ?fieldTest=1 is present: field test only activates
 * when the event is genuinely still pre-launch AND the existing
 * server-verified admin session (httpOnly cookie or x-admin-key header —
 * see lib/admin-auth.ts's resolveAdminSessionFromRequest) independently
 * confirms admin access on this exact request. No new secret, token, or
 * bypass is introduced.
 */
export function resolveFieldTestAccess(
  request: Request,
  event?: QuestEvent | null,
  slug?: string | null,
  currentTime?: Date | string | number
): { isPreLaunch: boolean; fieldTestActive: boolean } {
  const isPreLaunch = isPreLaunchEvent(event, slug, currentTime);
  if (!isPreLaunch) return { isPreLaunch: false, fieldTestActive: false };
  if (!isFieldTestRequested(request)) return { isPreLaunch: true, fieldTestActive: false };
  const { isAdmin } = resolveAdminSessionFromRequest(request);
  return { isPreLaunch: true, fieldTestActive: isAdmin };
}
