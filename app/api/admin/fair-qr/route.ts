import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { getEventBySlugDB, getQuestsForEventDB, getLeaderboardDB, updateQuestDB } from '@/lib/supabase-db';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import { FAIR_EVENT_SLUG, getDeploymentStatus } from '@/lib/fair-hunt';
import { QuestPlacementDetails } from '@/lib/types';

/**
 * GET /api/admin/fair-qr — every core + daily bonus QR record (including
 * the internal fields never exposed by the public quest views: target_code,
 * gm_notes/placement note, structured placement details, per-quest unique-
 * claim count, last claim time, and derived deployment status), plus the
 * current Fair leaderboard, for Commander/admin inspection.
 */
export async function GET(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const event = await getEventBySlugDB(FAIR_EVENT_SLUG);
    if (!event) {
      return NextResponse.json({ error: 'Fair QR Hunt event not found.' }, { status: 404 });
    }

    const quests = await getQuestsForEventDB(event.id);
    const sorted = [...quests].sort((a, b) => a.sortOrder - b.sortOrder);

    let claimCounts: Record<string, number> = {};
    let lastClaimedAt: Record<string, string> = {};
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('quest_submissions')
        .select('quest_id, submitted_at')
        .eq('event_id', event.id)
        .eq('status', 'verified')
        .order('submitted_at', { ascending: true });
      for (const row of data || []) {
        claimCounts[row.quest_id] = (claimCounts[row.quest_id] || 0) + 1;
        // Rows are ascending, so the last write for a quest_id is always its most recent claim.
        lastClaimedAt[row.quest_id] = row.submitted_at;
      }
    }

    const leaderboard = await getLeaderboardDB(event.id);

    return NextResponse.json({
      success: true,
      event,
      quests: sorted.map((q) => ({
        id: q.id,
        slug: q.slug,
        title: q.title,
        category: q.category,
        pointValue: q.pointValue,
        targetCode: q.targetCode,
        status: q.status,
        startsAt: q.startsAt,
        expiresAt: q.expiresAt,
        gmNotes: q.gmNotes,
        placementDetails: q.placementDetails || null,
        placedAt: q.placedAt || null,
        deploymentStatus: getDeploymentStatus(q),
        uniqueClaimCount: claimCounts[q.id] || 0,
        lastClaimedAt: lastClaimedAt[q.id] || null,
      })),
      leaderboard,
    });
  } catch (error: any) {
    console.error('[API /admin/fair-qr] Server error:', error);
    return NextResponse.json({ error: 'Failed to load Fair QR admin data.' }, { status: 500 });
  }
}

type FairQrAction =
  | { action: 'set_status'; questId: string; status: 'active' | 'inactive' }
  | { action: 'update_placement'; questId: string; gmNotes?: string; placementDetails?: QuestPlacementDetails }
  | { action: 'mark_placed'; questId: string }
  | { action: 'mark_unplaced'; questId: string };

/**
 * POST /api/admin/fair-qr — the only admin write surface for a Fair QR
 * record. Deliberately action-scoped rather than a generic "update quest"
 * endpoint: each action can only touch the exact fields it names, so there
 * is no request shape that can accidentally change points, target_code, or
 * the startsAt/expiresAt window (a daily bonus's scheduled day) — those
 * stay frozen no matter what this route receives.
 */
export async function POST(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as Partial<FairQrAction>;
    if (!body.questId || typeof body.questId !== 'string') {
      return NextResponse.json({ error: 'questId is required.' }, { status: 400 });
    }

    const event = await getEventBySlugDB(FAIR_EVENT_SLUG);
    const quests = event ? await getQuestsForEventDB(event.id) : [];
    const target = quests.find((q) => q.id === body.questId);
    if (!target) {
      return NextResponse.json({ error: 'Quest not found in the Fair QR Hunt.' }, { status: 404 });
    }

    let updated;
    switch (body.action) {
      case 'set_status': {
        if (body.status !== 'active' && body.status !== 'inactive') {
          return NextResponse.json({ error: 'status must be active or inactive.' }, { status: 400 });
        }
        updated = await updateQuestDB(body.questId, { status: body.status });
        break;
      }
      case 'update_placement': {
        const gmNotes = typeof body.gmNotes === 'string' ? body.gmNotes.slice(0, 500) : undefined;
        const placementDetails =
          body.placementDetails && typeof body.placementDetails === 'object'
            ? {
                description: typeof body.placementDetails.description === 'string' ? body.placementDetails.description.slice(0, 1000) : undefined,
                setupNotes: typeof body.placementDetails.setupNotes === 'string' ? body.placementDetails.setupNotes.slice(0, 1000) : undefined,
                retrievalNotes: typeof body.placementDetails.retrievalNotes === 'string' ? body.placementDetails.retrievalNotes.slice(0, 1000) : undefined,
              }
            : undefined;
        updated = await updateQuestDB(body.questId, { gmNotes, placementDetails });
        break;
      }
      case 'mark_placed': {
        updated = await updateQuestDB(body.questId, { placedAt: new Date().toISOString() });
        break;
      }
      case 'mark_unplaced': {
        updated = await updateQuestDB(body.questId, { placedAt: null });
        break;
      }
      default:
        return NextResponse.json({ error: 'Unknown or missing action.' }, { status: 400 });
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Update failed — if placement fields were never added to production yet, apply supabase/migrations/20260826150000_fair_qr_placement_deployment_fields.sql first.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      quest: { ...updated, deploymentStatus: getDeploymentStatus(updated) },
    });
  } catch (error: any) {
    console.error('[API /admin/fair-qr] Server error:', error);
    return NextResponse.json({ error: 'Failed to update Fair QR record.' }, { status: 500 });
  }
}
