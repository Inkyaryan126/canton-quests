import { NextResponse } from 'next/server';
import { getEventByIdDB, submitQuestProofDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { resolveFounderCipherPrelaunchAccess } from '@/lib/founder-cipher-prelaunch';

export async function POST(request: Request) {
  try {
    // The acting player is always derived from the authenticated session —
    // never trusted from the client body. Canton Quests has no guest/
    // anonymous identity model (every player.id is backed by an
    // authenticated Supabase Auth user, see lib/supabase-auth.ts), so quest
    // submission requires a valid session.
    //
    // Uses resolveAuthenticatedSession + withCookies (not the
    // resolveAuthenticatedPlayer shorthand) so a silent access-token
    // refresh gets persisted back to cookies — otherwise the rotated
    // refresh token is burned here and the player's next authenticated
    // request has no way back in.
    const sessionResult = await resolveAuthenticatedSession(request);
    const authenticatedPlayer = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, authenticatedPlayer?.id);
      return res;
    };

    if (!authenticatedPlayer) {
      return withCookies(
        { success: false, error: 'Authentication required to submit quest proof.', awardedPoints: 0 },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      playerId,
      questId,
      eventId,
      proofType,
      submittedContent,
      proofUrl,
      userLat,
      userLon,
      userAccuracyMeters,
      stepIndex,
    } = body;

    // A client-supplied playerId is accepted only for backward compatibility
    // and must exactly match the authenticated player — any mismatch is a
    // forged-identity attempt and is rejected outright, not silently
    // resubmitted under the real player's identity.
    if (playerId && playerId !== authenticatedPlayer.id) {
      return withCookies(
        { success: false, error: 'Cannot submit proof on behalf of another player.', awardedPoints: 0 },
        { status: 403 }
      );
    }

    if (!questId || !eventId || !proofType) {
      return withCookies(
        { error: 'Missing required fields: questId, eventId, proofType' },
        { status: 400 }
      );
    }

    // Independent, authoritative Operation-start-time enforcement — never
    // relies on the client having honestly reported a pre-launch state. The
    // only way past this before the real start time is a validated Founder's
    // Cipher prelaunch access cookie (see resolveFounderCipherPrelaunchAccess)
    // — there is no admin bypass and no special submission behavior; a
    // request that clears this gate is verified exactly like any other.
    const event = await getEventByIdDB(eventId);
    if (!event) {
      return withCookies({ success: false, error: 'Operation not found.', awardedPoints: 0 }, { status: 404 });
    }
    const { isPreLaunch, hasPrelaunchAccess } = resolveFounderCipherPrelaunchAccess(request, event, event.slug);
    if (isPreLaunch && !hasPrelaunchAccess) {
      return withCookies(
        { success: false, error: 'This Mission has not launched yet.', awardedPoints: 0 },
        { status: 403 }
      );
    }

    const result = await submitQuestProofDB(
      {
        playerId: authenticatedPlayer.id,
        questId,
        eventId,
        proofType,
        submittedContent,
        proofUrl,
        userLat,
        userLon,
        userAccuracyMeters,
        stepIndex,
      },
      request
    );

    return withCookies(result);
  } catch (error: any) {
    console.error('[API /submit] Server error:', error);
    return NextResponse.json({ error: 'Submission processing failed' }, { status: 500 });
  }
}
