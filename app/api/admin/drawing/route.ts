import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { authorizeGameMasterRequest, verifyAdminSecret, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import {
  getDrawingLedgerReviewDB,
  lockDrawingLedgerDB,
  executePrizeDrawDB,
  publishDrawingResultsDB,
  voidPrizeDrawRecordDB,
  getPublicDrawingPageDataDB,
} from '@/lib/supabase-db';
import { VOL1_PRIZES } from '@/lib/prize-config';

function getAdminSessionFromRequest(request: Request) {
  const headersObj = Object.fromEntries(request.headers.entries());
  const headerSession = authorizeGameMasterRequest(headersObj);
  if (headerSession.isAdmin) {
    return { isAdmin: true, adminName: headerSession.adminName };
  }

  const cookieStore = cookies();
  const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (adminCookie && verifyAdminSecret(adminCookie)) {
    return { isAdmin: true, adminName: 'Game Master' };
  }

  return { isAdmin: false, adminName: 'Guest' };
}

export async function GET(request: Request) {
  try {
    const session = getAdminSessionFromRequest(request);

    if (!session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Game Master admin session is required.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'eventId parameter is required' }, { status: 400 });
    }

    const review = await getDrawingLedgerReviewDB(eventId);
    const publicData = await getPublicDrawingPageDataDB(eventId);

    return NextResponse.json({
      review,
      publicData,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin drawing data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = getAdminSessionFromRequest(request);

    if (!session.isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized. Game Master admin session is required.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      action,
      eventId,
      lockReason,
      confirmPendingBypass,
      prizeId,
      prizeTitle,
      testSeed,
      drawRecordId,
      cancellationReason,
      drawMethod,
      providerReference,
      manualWinnerPublicLabel,
      manualWinnerPublicParticipantId,
      manualWinnerPlayerId,
      auditMetadata,
    } = body;

    if (!eventId) {
      return NextResponse.json({ error: 'eventId is required' }, { status: 400 });
    }

    if (action === 'lock') {
      const lock = await lockDrawingLedgerDB(eventId, {
        lockReason,
        lockedBy: session.adminName,
        confirmPendingBypass: !!confirmPendingBypass,
      });
      return NextResponse.json({ success: true, lock });
    }

    if (action === 'draw') {
      const selectedDrawMethod = drawMethod || 'internal_test';
      if (selectedDrawMethod === 'internal_test' && process.env.NODE_ENV === 'production' && process.env.ALLOW_INTERNAL_TEST_DRAW !== 'true') {
        return NextResponse.json(
          { error: 'Internal test draws are restricted to non-production/dev-safe mode.' },
          { status: 403 }
        );
      }
      const drawRecord = await executePrizeDrawDB({
        eventId,
        prizeId,
        prizeTitle,
        testSeed,
        drawMethod: selectedDrawMethod,
        providerReference,
        manualWinnerPublicLabel,
        manualWinnerPublicParticipantId,
        manualWinnerPlayerId,
        auditMetadata,
        adminIdentity: session.adminName,
      });
      return NextResponse.json({ success: true, drawRecord });
    }

    // Run all three random cash drawings in sequence with unique-winner enforcement.
    // executePrizeDrawDB already excludes previous winning_player_ids on each call,
    // so the sequential unique-winner rule is enforced automatically.
    if (action === 'sequentialCashDrawings') {
      const results: any[] = [];
      for (const prize of VOL1_PRIZES.drawings) {
        const record = await executePrizeDrawDB({
          eventId,
          prizeId: prize.id,
          prizeTitle: prize.title,
          drawMethod: 'final_quest',
          auditMetadata: { drawOrder: prize.drawOrder, sequentialRun: true },
          adminIdentity: session.adminName,
        });
        results.push(record);
      }
      return NextResponse.json({ success: true, drawRecords: results });
    }

    if (action === 'publish') {
      const publishedRecords = await publishDrawingResultsDB(eventId, session.adminName);
      return NextResponse.json({ success: true, publishedRecords });
    }

    if (action === 'void') {
      if (!drawRecordId || !cancellationReason) {
        return NextResponse.json(
          { error: 'drawRecordId and cancellationReason are required to void a draw.' },
          { status: 400 }
        );
      }
      const voidedRecord = await voidPrizeDrawRecordDB(
        eventId,
        drawRecordId,
        cancellationReason,
        session.adminName
      );
      return NextResponse.json({ success: true, voidedRecord });
    }

    return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Admin drawing action failed' },
      { status: 400 }
    );
  }
}
