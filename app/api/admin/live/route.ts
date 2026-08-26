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
  activateAudienceEventDB,
  closeAudienceVotingDB,
  resolveAudienceEventDB,
  cancelAudienceEventDB,
  createHostBroadcastDB,
  toggleSpectatorSystemFreezeDB,
  getAudienceEventsDB,
  getAudienceEventOptionsDB,
  getSpectatorSystemSettingsDB,
  getLiveEventTimelineDB,
  runAudienceVoteSimulationDB,
  resolveSpectatorEventId,
} from '@/lib/spectator-db';
import { processAudienceLifecycleCron } from '@/lib/spectator-engine';
import {
  computeEventReadinessReport,
  evaluateEventLaunchGates,
  auditEventQRQuests,
  auditEventQuestsAndLocations,
  getOperatorChecklist,
  updateOperatorChecklistItem,
  runWalkUpPlayerRehearsal,
  runFullEventRehearsal,
  executeEventClosure,
} from '@/lib/event-readiness';

function verifyServerAdminAuth(request: Request): boolean {
  try {
    const cookieStore = cookies();
    const adminCookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (adminCookie && verifyAdminSecret(adminCookie)) {
      return true;
    }
  } catch {
    // Ignore when running outside Next.js request scope
  }

  const headersObj: Record<string, string> = {};
  request.headers.forEach((val, key) => {
    headersObj[key] = val;
  });

  const session = authorizeGameMasterRequest(headersObj);
  return session.isAdmin;
}

export async function GET(request: Request) {
  try {
    if (!verifyServerAdminAuth(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Game Master administrative authorization required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const eventId = await resolveSpectatorEventId(searchParams.get('eventId'));

    // No resolvable event (e.g. nothing seeded yet) is an intentional, safe
    // empty read — never substitute a fake/placeholder id into a downstream
    // query against a UUID event_id column.
    if (!eventId) {
      return NextResponse.json({
        success: true,
        activeEvent: null,
        activeOptions: [],
        upcomingEvents: [],
        resolvedEvents: [],
        settings: null,
        timeline: [],
        readiness: null,
        launchGates: null,
        checklist: null,
        qrAudit: null,
        questAudit: null,
      });
    }

    const events = await getAudienceEventsDB(eventId, true);
    const settings = await getSpectatorSystemSettingsDB(eventId);
    const timeline = await getLiveEventTimelineDB(eventId, 50, true);

    const activeEvent = events.find((e) => e.status === 'voting_active' || e.status === 'tallying_closed') || null;
    let activeOptions: any[] = [];
    if (activeEvent) {
      activeOptions = await getAudienceEventOptionsDB(activeEvent.id, true);
    }

    const upcomingEvents = events.filter((e) => e.status === 'draft' || e.status === 'scheduled');
    const resolvedEvents = events.filter((e) => e.status === 'resolved' || e.status === 'cancelled' || e.status === 'effect_applied');

    // Phase 5.4 Readiness and Audit State
    const readiness = computeEventReadinessReport(eventId);
    const launchGates = evaluateEventLaunchGates(eventId);
    const checklist = getOperatorChecklist(eventId);
    const qrAudit = auditEventQRQuests(eventId);
    const questAudit = auditEventQuestsAndLocations(eventId);

    return NextResponse.json({
      success: true,
      activeEvent,
      activeOptions,
      upcomingEvents,
      resolvedEvents,
      settings,
      timeline,
      readiness,
      launchGates,
      checklist,
      qrAudit,
      questAudit,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
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

    const eventId = await resolveSpectatorEventId(body.eventId);

    // Every admin/live write action mutates state scoped to a real event —
    // never continue with a fabricated/placeholder id if none can be
    // resolved. This is a hard stop, not a soft fallback.
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'No event could be resolved. Cannot process this admin action.' },
        { status: 400 }
      );
    }

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
        const { title, description, eventType, eligibilityMode, maxVotesPerSession, options, startsAt, durationMinutes } = body;
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

        if (body.launchNow && res.event?.id) {
          await activateAudienceEventDB(res.event.id, startsAt, durationMinutes || 5, 'Game Director');
        }

        return NextResponse.json({ success: true, ...res });
      }

      case 'activate_audience_event': {
        const { audienceEventId, startsAt, durationMinutes } = body;
        if (!audienceEventId) {
          return NextResponse.json({ success: false, error: 'Missing audienceEventId' }, { status: 400 });
        }
        const res = await activateAudienceEventDB(audienceEventId, startsAt, durationMinutes || 5, 'Game Director');
        return NextResponse.json(res);
      }

      case 'close_audience_voting': {
        const { audienceEventId } = body;
        if (!audienceEventId) {
          return NextResponse.json({ success: false, error: 'Missing audienceEventId' }, { status: 400 });
        }
        const res = await closeAudienceVotingDB(audienceEventId, 'Game Director');
        return NextResponse.json(res);
      }

      case 'resolve_audience_event': {
        const { audienceEventId, overrideOptionId, overrideReason } = body;
        if (!audienceEventId) {
          return NextResponse.json({ success: false, error: 'Missing audienceEventId' }, { status: 400 });
        }
        const res = await resolveAudienceEventDB(audienceEventId, overrideOptionId, overrideReason, 'Game Director');
        return NextResponse.json(res);
      }

      case 'cancel_audience_event': {
        const { audienceEventId, cancellationReason } = body;
        if (!audienceEventId) {
          return NextResponse.json({ success: false, error: 'Missing audienceEventId' }, { status: 400 });
        }
        const res = await cancelAudienceEventDB(audienceEventId, cancellationReason || 'Game Director Action', 'Game Director');
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

      case 'run_rehearsal_simulation': {
        const simResult = await runAudienceVoteSimulationDB(eventId, body.params);
        return NextResponse.json({ success: true, simulation: simResult });
      }

      case 'process_lifecycle_cron': {
        const cronResult = processAudienceLifecycleCron(eventId);
        return NextResponse.json({ success: true, ...cronResult });
      }

      case 'evaluate_launch_gates': {
        const gatesResult = evaluateEventLaunchGates(eventId);
        return NextResponse.json({ success: true, ...gatesResult });
      }

      case 'get_readiness_report': {
        const report = computeEventReadinessReport(eventId);
        return NextResponse.json({ success: true, report });
      }

      case 'audit_qr_quests': {
        const qrAudit = auditEventQRQuests(eventId);
        return NextResponse.json({ success: true, ...qrAudit });
      }

      case 'audit_quests_locations': {
        const questAudit = auditEventQuestsAndLocations(eventId);
        return NextResponse.json({ success: true, ...questAudit });
      }

      case 'update_checklist_item': {
        const { itemId, isChecked } = body;
        if (!itemId) {
          return NextResponse.json({ success: false, error: 'Missing itemId' }, { status: 400 });
        }
        const checklist = updateOperatorChecklistItem(eventId, itemId, Boolean(isChecked), 'Game Director');
        return NextResponse.json({ success: true, checklist });
      }

      case 'run_walkup_rehearsal': {
        const walkUpResult = runWalkUpPlayerRehearsal(eventId);
        return NextResponse.json({ success: true, rehearsal: walkUpResult });
      }

      case 'run_full_rehearsal': {
        const fullRehearsalResult = runFullEventRehearsal(eventId);
        return NextResponse.json({ success: true, rehearsal: fullRehearsalResult });
      }

      case 'end_event':
      case 'execute_event_closure': {
        const { reason } = body;
        const closureResult = executeEventClosure(eventId, 'Game Director', reason);
        return NextResponse.json(closureResult);
      }

      default:
        return NextResponse.json({ success: false, error: `Unknown admin live action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
