import { NextResponse } from 'next/server';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import {
  getEventBySlugDB,
  getQuestByTargetCodeDB,
  getOrCreateEventParticipationDB,
  submitQuestProofDB,
  claimFairMysterySignalDB,
} from '@/lib/supabase-db';
import { getQuestAvailability } from '@/lib/quest-rewards';
import { getPublicQuestView } from '@/lib/game-engine';
import { FAIR_CORE_CATEGORY, FAIR_EVENT_SLUG, isFairBonusQuest } from '@/lib/fair-hunt';

/**
 * POST /api/qr/claim
 *
 * The single, code-resolved claim endpoint behind every physical Canton
 * Quests QR — Fair QR Hunt and the Sept 11 Main Operation's existing QR
 * quests alike. The scanned `code` is the ONLY input: the quest (and its
 * event) are always resolved server-side from it, never from a client-
 * supplied questId/eventId, so a request can't claim credit for a
 * different quest than the one actually printed on the card.
 *
 * Two entirely separate award paths, chosen by quest.category:
 *   - fair_core (the 20 Mystery Money Signals) -> claimFairMysterySignalDB,
 *     a dedicated global-first-claim-wins-cash mechanism (see that
 *     function's doc comment in lib/supabase-db.ts). No XP, no points, no
 *     drawing entry — a real dollar prize, revealed only once claimed.
 *   - everything else (Volume 1's QR quests, and the now-retired/inactive
 *     Fair daily-bonus Signals) -> the existing, unchanged
 *     submitQuestProofDB transaction (server-authoritative points,
 *     database-level duplicate protection). This path is completely
 *     untouched by the Mystery Money redesign.
 *
 * Uses resolveAuthenticatedSession (not the resolveAuthenticatedPlayer
 * shorthand) and re-applies setAuthCookies on every response via
 * withCookies below — a Supabase access token expires in ~1hr, and its
 * refresh token is single-use/rotating. Scan one QR after the access
 * token has expired and the session gets silently refreshed to keep this
 * request working, but if the new tokens are never written back to
 * cookies, the browser is left holding a now-burned refresh token — the
 * very next scan (or any authenticated request) then has no way back in,
 * i.e. "logs me out every time I scan another QR code".
 */
export async function POST(request: Request) {
  try {
    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, player?.id);
      return res;
    };

    if (!player) {
      return withCookies({ success: false, reason: 'unauthenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return withCookies({ success: false, reason: 'not_recognized' }, { status: 400 });
    }
    // Opportunistic GPS — only a handful of existing QR quests (e.g. Volume
    // 1's requireQrAndLocation ones) actually need it; verifyAutomatedProof
    // enforces that requirement server-side, so it's simply ignored for
    // every QR-only quest (every Fair Signal included).
    const { userLat, userLon, userAccuracyMeters } = body;

    const quest = await getQuestByTargetCodeDB(code);
    if (!quest) {
      return withCookies({ success: false, reason: 'not_recognized' });
    }

    const fairEvent = quest.eventId ? await getFairEventIfApplicable(quest.eventId) : null;
    const isFair = Boolean(fairEvent);
    const isMysterySignal = quest.category === FAIR_CORE_CATEGORY;
    const isBonus = isFairBonusQuest(quest);

    // Ensure Operation participation exists before attempting the claim —
    // the Fair requires no path, so this never prompts one. Skipped for
    // non-Fair (e.g. Main Operation) quests: that Operation's own entry
    // flow (app/events/[slug]/page.tsx) is the sole path-selection gate.
    if (isFair && quest.eventId) {
      await getOrCreateEventParticipationDB(quest.eventId, player.id);
    }

    // Event-level timing and pause enforcement (SERVER-SIDE)
    if (isFair && fairEvent) {
      const nowMs = Date.now();
      const startMs = fairEvent.startTime ? new Date(fairEvent.startTime).getTime() : 0;
      const endMs = fairEvent.endTime ? new Date(fairEvent.endTime).getTime() : Infinity;

      if (fairEvent.isPaused) {
        return withCookies({
          success: false,
          reason: 'hunt_paused',
          code: 'HUNT_PAUSED',
          message: fairEvent.pauseReason || 'The Fair QR Hunt is temporarily paused.',
          isBonus,
          isFair,
          isMysterySignal,
          quest: getPublicQuestView(quest),
        });
      }

      if (startMs && nowMs < startMs) {
        return withCookies({
          success: false,
          reason: 'hunt_not_open',
          code: 'HUNT_NOT_OPEN',
          message: 'The Fair QR Hunt is not open yet.',
          isBonus,
          isFair,
          isMysterySignal,
          quest: getPublicQuestView(quest),
        });
      }

      if (endMs && nowMs > endMs) {
        return withCookies({
          success: false,
          reason: 'hunt_closed',
          code: 'HUNT_CLOSED',
          message: 'The Fair QR Hunt has closed.',
          isBonus,
          isFair,
          isMysterySignal,
          quest: getPublicQuestView(quest),
        });
      }
    }

    // Pre-classify availability for the claim UI's exact copy — the actual
    // security boundary is each award path's own identical check
    // (lib/quest-rewards.ts getQuestAvailability for submitQuestProofDB;
    // claimFairMysterySignalDB checks quest.status itself), not this
    // pre-check, so the two can never disagree in a way that lets an
    // unavailable quest actually award anything.
    const availability = getQuestAvailability(quest);
    if (!availability.ok) {
      const isNotOpen = availability.reason === 'not_yet_active';
      const isClosed = availability.reason === 'expired';
      return withCookies({
        success: false,
        reason: isFair && isNotOpen ? 'hunt_not_open' : isFair && isClosed ? 'hunt_closed' : availability.reason,
        code: isFair && isNotOpen ? 'HUNT_NOT_OPEN' : isFair && isClosed ? 'HUNT_CLOSED' : undefined,
        message: availability.message,
        isBonus,
        isFair,
        isMysterySignal,
        quest: getPublicQuestView(quest),
      });
    }

    if (isMysterySignal) {
      const claim = await claimFairMysterySignalDB(player.id, player.displayName, quest.id);

      if (claim.outcome === 'won') {
        return withCookies({
          success: true,
          reason: 'signal_secured',
          isFair: true,
          isMysterySignal: true,
          cashCents: claim.cashCents,
          winnerDisplayName: claim.winnerDisplayName,
          paymentInstructions: {
            cashTag: '$inksplattering',
            requestAmountCents: claim.cashCents,
            requestMemo: `${quest.title} — ${player.displayName}`,
            warning: 'Never pay a fee or send money to claim a prize.',
          },
          quest: getPublicQuestView(quest),
          eventId: quest.eventId,
        });
      }

      if (claim.outcome === 'already_claimed') {
        return withCookies({
          success: false,
          reason: 'signal_already_found',
          isFair: true,
          isMysterySignal: true,
          cashCents: claim.cashCents,
          winnerDisplayName: claim.winnerDisplayName,
          quest: getPublicQuestView(quest),
        });
      }

      return withCookies({
        success: false,
        reason: claim.outcome === 'unavailable' ? 'inactive' : 'rejected',
        message: claim.message,
        isFair: true,
        isMysterySignal: true,
        quest: getPublicQuestView(quest),
      });
    }

    const result = await submitQuestProofDB(
      {
        playerId: player.id,
        questId: quest.id,
        eventId: quest.eventId,
        proofType: 'qr',
        submittedContent: code,
        userLat: typeof userLat === 'number' ? userLat : undefined,
        userLon: typeof userLon === 'number' ? userLon : undefined,
        userAccuracyMeters: typeof userAccuracyMeters === 'number' ? userAccuracyMeters : undefined,
      },
      request
    );

    if (!result.success) {
      const alreadySecured = result.submission.status === 'verified';
      return withCookies({
        success: false,
        reason: alreadySecured ? 'already_secured' : 'rejected',
        message: result.message,
        isBonus,
        quest: getPublicQuestView(quest),
      });
    }

    return withCookies({
      success: true,
      reason: 'secured',
      pointsAwarded: result.awardedPoints,
      isBonus,
      isFair,
      quest: getPublicQuestView(quest),
      eventId: quest.eventId,
    });
  } catch (error: any) {
    console.error('[API /qr/claim] Server error:', error);
    return NextResponse.json({ success: false, reason: 'error' }, { status: 500 });
  }
}

async function getFairEventIfApplicable(eventId: string) {
  const fairEvent = await getEventBySlugDB(FAIR_EVENT_SLUG);
  if (fairEvent && fairEvent.id === eventId) return fairEvent;
  return null;
}
