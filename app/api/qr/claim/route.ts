import { NextResponse } from 'next/server';
import { resolveAuthenticatedPlayer } from '@/lib/supabase-auth';
import {
  getEventBySlugDB,
  getQuestByTargetCodeDB,
  getOrCreateEventParticipationDB,
  submitQuestProofDB,
} from '@/lib/supabase-db';
import { getQuestAvailability } from '@/lib/quest-rewards';
import { getPublicQuestView } from '@/lib/game-engine';
import { FAIR_EVENT_SLUG, isFairBonusQuest } from '@/lib/fair-hunt';

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
 * Reuses the existing, already-hardened submitQuestProofDB transaction for
 * the actual award (server-authoritative points, event-id verification,
 * database-level duplicate protection via the score_ledger/reward_grants/
 * quest_submissions unique indexes) — this route only adds code-based
 * resolution and richer, reason-coded responses for the claim UI.
 */
export async function POST(request: Request) {
  try {
    const player = await resolveAuthenticatedPlayer(request);
    if (!player) {
      return NextResponse.json({ success: false, reason: 'unauthenticated' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    if (!code) {
      return NextResponse.json({ success: false, reason: 'not_recognized' }, { status: 400 });
    }
    // Opportunistic GPS — only a handful of existing QR quests (e.g. Volume
    // 1's requireQrAndLocation ones) actually need it; verifyAutomatedProof
    // enforces that requirement server-side, so it's simply ignored for
    // every QR-only quest (every Fair Signal included).
    const { userLat, userLon, userAccuracyMeters } = body;

    const quest = await getQuestByTargetCodeDB(code);
    if (!quest) {
      return NextResponse.json({ success: false, reason: 'not_recognized' });
    }

    const isFair = quest.eventId && (await isEventFairQrHunt(quest.eventId));
    const isBonus = isFairBonusQuest(quest);

    // Ensure Operation participation exists before attempting the claim —
    // the Fair requires no path, so this never prompts one. Skipped for
    // non-Fair (e.g. Main Operation) quests: that Operation's own entry
    // flow (app/events/[slug]/page.tsx) is the sole path-selection gate.
    if (isFair) {
      await getOrCreateEventParticipationDB(quest.eventId, player.id);
    }

    // Pre-classify availability for the claim UI's exact copy — the actual
    // security boundary is submitQuestProofDB's own identical check
    // (lib/quest-rewards.ts getQuestAvailability, shared by both paths),
    // not this pre-check, so the two can never disagree in a way that lets
    // an unavailable quest actually award anything.
    const availability = getQuestAvailability(quest);
    if (!availability.ok) {
      return NextResponse.json({
        success: false,
        reason: availability.reason,
        isBonus,
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
      return NextResponse.json({
        success: false,
        reason: alreadySecured ? 'already_secured' : 'rejected',
        message: result.message,
        isBonus,
        quest: getPublicQuestView(quest),
      });
    }

    return NextResponse.json({
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

async function isEventFairQrHunt(eventId: string): Promise<boolean> {
  const fairEvent = await getEventBySlugDB(FAIR_EVENT_SLUG);
  return Boolean(fairEvent && fairEvent.id === eventId);
}
