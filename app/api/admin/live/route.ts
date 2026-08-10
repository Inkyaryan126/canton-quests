import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminSecret, authorizeGameMasterRequest, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import {
  setEventPhase,
  toggleEventPause,
  createAnnouncement,
  createSecretCode,
  triggerFlashQuest,
  updateNPCCharacter,
  createBonusWindow,
  adjustPlayerScoreManual,
  reconcilePlayerScores,
  grantFinaleQualification,
} from '@/lib/game-engine';
import {
  createAudienceEventDB,
  resolveAudienceEventDB,
  createHostBroadcastDB,
  toggleSpectatorSystemFreezeDB,
} from '@/lib/spectator-db';

function verifyServerAdminAuth(request: Request): boolean {
  const cookieStore = cookies();
  const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (adminCookie && verifyAdminSecret(adminCookie)) {
    return true;
  }

  const headersObj: Record<string, string> = {};
  request.headers.forEach((val, key) => {
    headersObj[key] = val;
  });

  const session = authorizeGameMasterRequest(headersObj);
  return session.isAdmin;
}

export async function POST(request: Request) {
  try {
    if (!verifyServerAdminAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Game Master administrative authorization required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body.action;

    if (!action) {
      return NextResponse.json({ success: false, error: 'Missing action parameter' }, { status: 400 });
    }

    const eventId = body.eventId || 'default-event';

    switch (action) {
      case 'toggle_pause': {
        const isPaused = Boolean(body.isPaused);
        const reason = body.reason;
        const updated = toggleEventPause(eventId, isPaused, reason);
        return NextResponse.json({ success: true, event: updated });
      }

      case 'set_phase': {
        const phase = body.phase;
        if (!phase) {
          return NextResponse.json({ success: false, error: 'Missing phase' }, { status: 400 });
        }
        const updated = setEventPhase(eventId, phase);
        return NextResponse.json({ success: true, event: updated });
      }

      case 'create_announcement': {
        const { title, message, urgency, expiresAt, linkedQuestId } = body;
        if (!title || !message) {
          return NextResponse.json({ success: false, error: 'Missing title or message' }, { status: 400 });
        }
        const ann = createAnnouncement(eventId, title, message, urgency, expiresAt, linkedQuestId);
        return NextResponse.json({ success: true, announcement: ann });
      }

      case 'trigger_flash': {
        const { questId, durationMinutes } = body;
        if (!questId) {
          return NextResponse.json({ success: false, error: 'Missing questId' }, { status: 400 });
        }
        const updated = triggerFlashQuest(questId, durationMinutes || 30);
        return NextResponse.json({ success: true, quest: updated });
      }

      case 'create_secret_code': {
        const { code, description, bonusPoints } = body;
        if (!code) {
          return NextResponse.json({ success: false, error: 'Missing code' }, { status: 400 });
        }
        const created = createSecretCode(eventId, code, description || 'Secret Drop', bonusPoints || 150);
        return NextResponse.json({ success: true, secretCode: created });
      }

      case 'create_bonus_window': {
        const { title, multiplier, targetCategory, durationMinutes } = body;
        const window = createBonusWindow(
          eventId,
          title || 'Double XP Sprint',
          multiplier || 2.0,
          targetCategory,
          durationMinutes || 45
        );
        return NextResponse.json({ success: true, bonusWindow: window });
      }

      case 'update_npc': {
        const { npcId, currentZone, clueHint, isActive } = body;
        if (!npcId) {
          return NextResponse.json({ success: false, error: 'Missing npcId' }, { status: 400 });
        }
        const updated = updateNPCCharacter(npcId, { currentZone, clueHint, isActive });
        return NextResponse.json({ success: true, npc: updated });
      }

      case 'adjust_score': {
        const { playerId, points, reason, adminName } = body;
        if (!playerId || points === undefined) {
          return NextResponse.json({ success: false, error: 'Missing playerId or points' }, { status: 400 });
        }
        const ledger = adjustPlayerScoreManual(eventId, playerId, points, reason || 'GM Field Adjustment', adminName || 'Game Director');
        return NextResponse.json({ success: true, ledger });
      }

      case 'grant_wildcard': {
        const { playerId, reason } = body;
        if (!playerId) {
          return NextResponse.json({ success: false, error: 'Missing playerId' }, { status: 400 });
        }
        const qual = grantFinaleQualification(eventId, playerId, reason || 'Game Director Wildcard Pass', true);
        return NextResponse.json({ success: true, qualification: qual });
      }

      case 'reconcile_scores': {
        const res = reconcilePlayerScores(eventId);
        return NextResponse.json({ success: true, reconciled: res });
      }

      case 'create_audience_event': {
        const { title, description, eventType, eligibilityMode, maxVotesPerSession, options } = body;
        if (!title || !eventType || !options || options.length === 0) {
          return NextResponse.json({ success: false, error: 'Invalid audience event parameters' }, { status: 400 });
        }
        const res = await createAudienceEventDB({
          eventId,
          title,
          description,
          eventType,
          eligibilityMode,
          maxVotesPerSession: 1,
          options,
        });
        return NextResponse.json({ success: true, ...res });
      }

      case 'resolve_audience_event': {
        const { audienceEventId, overrideOptionId, overrideReason } = body;
        if (!audienceEventId) {
          return NextResponse.json({ success: false, error: 'Missing audienceEventId' }, { status: 400 });
        }
        const res = await resolveAudienceEventDB(audienceEventId, overrideOptionId, overrideReason, 'Game Director');
        return NextResponse.json(res);
      }

      case 'create_host_broadcast': {
        const { headline, body: broadcastBody, tone, targetChannel, priority, isPublished } = body;
        if (!headline || !broadcastBody) {
          return NextResponse.json({ success: false, error: 'Missing headline or body' }, { status: 400 });
        }
        const broadcast = await createHostBroadcastDB({
          eventId,
          headline,
          body: broadcastBody,
          tone,
          targetChannel,
          priority,
          isPublished,
        });
        return NextResponse.json({ success: true, broadcast });
      }

      case 'toggle_spectator_freeze': {
        const { isDisabled, reason } = body;
        const settings = await toggleSpectatorSystemFreezeDB(eventId, Boolean(isDisabled), reason);
        return NextResponse.json({ success: true, settings });
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown admin live action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
