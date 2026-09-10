import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getEventByIdDB, getQuestByIdDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession, setAuthCookies } from '@/lib/supabase-auth';
import { isFounderCipherPrelaunchBlocked } from '@/lib/founder-cipher-prelaunch';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import { QUEST_EVIDENCE_BUCKET, buildQuestEvidencePath, extensionForContentType } from '@/lib/quest-evidence';

/**
 * POST /api/game/quest-proofs/authorize-upload
 * Body: { eventId, questId, contentType }
 *
 * Issues a short-lived, server-signed Supabase Storage upload URL for one
 * specific, brand-new evidence object this exact authenticated player is
 * allowed to create for this exact quest/event. The client uploads bytes
 * directly to Supabase using the returned token (never through this Vercel
 * function), then submits the returned `path` — never an arbitrary URL —
 * as proof to POST /api/game/submit, which independently re-verifies the
 * object actually exists at that exact path before awarding anything.
 */
export async function POST(request: Request) {
  try {
    if (!isSupabaseAdminConfigured || !supabaseAdmin) {
      return NextResponse.json(
        { success: false, error: 'Evidence storage is not configured on this environment.' },
        { status: 503 }
      );
    }

    const sessionResult = await resolveAuthenticatedSession(request);
    const player = sessionResult.player;
    const withCookies = (body: unknown, init?: ResponseInit) => {
      const res = NextResponse.json(body, init);
      if (sessionResult.refreshedSession) setAuthCookies(res, sessionResult.refreshedSession, player?.id);
      return res;
    };

    if (!player) {
      return withCookies({ success: false, error: 'Authentication required.' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const eventId: string = body.eventId || '';
    const questId: string = body.questId || '';
    const contentType: string = body.contentType || '';

    if (!eventId || !questId || !contentType) {
      return withCookies(
        { success: false, error: 'Missing required fields: eventId, questId, contentType' },
        { status: 400 }
      );
    }

    const ext = extensionForContentType(contentType);
    if (!ext) {
      return withCookies(
        { success: false, error: 'Unsupported evidence content type.' },
        { status: 400 }
      );
    }

    const event = await getEventByIdDB(eventId);
    if (!event) {
      return withCookies({ success: false, error: 'Operation not found.' }, { status: 404 });
    }

    // Same authoritative prelaunch gate as every other Founder's Cipher
    // gameplay endpoint — a prelaunch visitor with no valid access cookie
    // cannot mint evidence upload targets either.
    if (isFounderCipherPrelaunchBlocked(request, event)) {
      return withCookies({ success: false, error: 'This Mission has not launched yet.' }, { status: 403 });
    }

    const quest = await getQuestByIdDB(questId);
    if (!quest || quest.eventId !== eventId) {
      return withCookies({ success: false, error: 'Quest not found for this event.' }, { status: 404 });
    }
    if (quest.verificationType !== 'photo' && quest.verificationType !== 'video') {
      return withCookies(
        { success: false, error: 'This quest does not accept photo/video evidence.' },
        { status: 400 }
      );
    }

    const evidenceId = randomUUID();
    const path = buildQuestEvidencePath({ eventId, playerId: player.id, questId, evidenceId, ext });

    const { data, error } = await supabaseAdmin.storage
      .from(QUEST_EVIDENCE_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error('[API /game/quest-proofs/authorize-upload] Storage error:', error);
      return withCookies({ success: false, error: 'Could not authorize evidence upload.' }, { status: 500 });
    }

    return withCookies({
      success: true,
      path: data.path,
      token: data.token,
    });
  } catch (error: any) {
    console.error('[API /game/quest-proofs/authorize-upload] Server error:', error);
    return NextResponse.json({ success: false, error: 'Request failed.' }, { status: 500 });
  }
}
