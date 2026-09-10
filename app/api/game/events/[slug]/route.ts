import { NextResponse } from 'next/server';
import {
  getEventBySlugDB,
  getQuestsForEventDB,
  getLeaderboardDB,
  getPlayerProgressDB,
} from '@/lib/supabase-db';
import { getPlayerCipherProgressDB } from '@/lib/founders-cipher';
import { getPublicQuestView } from '@/lib/game-engine';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';
import { isLaunchDistrictQuestSlug } from '@/lib/finale';
import { resolveFounderCipherPrelaunchAccess } from '@/lib/founder-cipher-prelaunch';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');

    // resolveAuthenticatedSession + withCookies (not the
    // resolveAuthenticatedPlayer shorthand) so a silent access-token
    // refresh gets persisted back to cookies — this route is hit on every
    // Mission page load, so it's a prime place for the rotated refresh
    // token to get silently burned and leave the player's next
    // authenticated request with no way back in.
    const sessionResult = await resolveAuthenticatedSession(request);
    const authenticatedPlayer = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, authenticatedPlayer?.id);
      return res;
    };

    const event = await getEventBySlugDB(slug);

    if (!event) {
      if (isKnownCantonLaunchSlug(slug)) {
        return withCookies({
          isPreLaunch: true,
          eventSlug: slug,
          message: 'Canton Quests activates September 11, 2026.',
        });
      }
      return withCookies({ error: 'Event not found' }, { status: 404 });
    }

    // Server-authoritative: a pre-launch event never exposes quest
    // instructions, leaderboard, or reward/cipher progress to a public
    // request, regardless of any client-supplied query string. The one way
    // past this before real launch is a validated Founder's Cipher prelaunch
    // access cookie (see resolveFounderCipherPrelaunchAccess) — there is no
    // query-string bypass and no admin/special-player concept involved.
    const { isPreLaunch, hasPrelaunchAccess } = resolveFounderCipherPrelaunchAccess(request, event, slug);
    if (isPreLaunch && !hasPrelaunchAccess) {
      return withCookies({
        event,
        quests: [],
        leaderboard: [],
        progress: null,
        cipherProgress: null,
        isPreLaunch: true,
        hasPrelaunchAccess: false,
      });
    }

    const quests = await getQuestsForEventDB(event.id);
    // The Founder's Cipher launch event carries the canonical 14 district
    // quests plus a long tail of prototype/legacy/superseded rows that
    // still share its event_id (see docs/FOUNDERS-CIPHER-LEGACY-QUEST-CONTAINMENT-PLAN.md).
    // getQuestsForEventDB is a shared read used by admin/audit tooling that
    // legitimately needs the full raw roster, so the roster filter is
    // applied only here, at the public gameplay API boundary — never send
    // stale/prototype content to the live client for this event.
    const rosterFilteredQuests = isKnownCantonLaunchSlug(slug)
      ? quests.filter((q) => isLaunchDistrictQuestSlug(q.slug))
      : quests;
    const safeQuests = rosterFilteredQuests.map(getPublicQuestView);
    const leaderboard = await getLeaderboardDB(event.id);
    const progress = playerId ? await getPlayerProgressDB(playerId, event.id) : null;
    const cipherProgress =
      playerId && authenticatedPlayer?.id === playerId
        ? await getPlayerCipherProgressDB(event.id, authenticatedPlayer.id)
        : null;

    return withCookies({
      event,
      quests: safeQuests,
      leaderboard,
      progress,
      cipherProgress,
      isPreLaunch,
      hasPrelaunchAccess,
    });
  } catch (error: any) {
    // Log server error securely without leaking stack or paths
    console.error('[API /events/[slug]] Server error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event data' },
      { status: 500 }
    );
  }
}
