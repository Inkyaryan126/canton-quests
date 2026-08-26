import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { getEventBySlugDB, getQuestsForEventDB, getLeaderboardDB, updateQuestDB } from '@/lib/supabase-db';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import { FAIR_EVENT_SLUG } from '@/lib/fair-hunt';

/**
 * GET /api/admin/fair-qr — every core + daily bonus QR record (including
 * the internal fields never exposed by the public quest views: target_code,
 * gm_notes/placement note, per-quest unique-claim count), plus the current
 * Fair leaderboard, for Commander/admin inspection.
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
    if (isSupabaseAdminConfigured && supabaseAdmin) {
      const { data } = await supabaseAdmin
        .from('quest_submissions')
        .select('quest_id')
        .eq('event_id', event.id)
        .eq('status', 'verified');
      claimCounts = (data || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.quest_id] = (acc[row.quest_id] || 0) + 1;
        return acc;
      }, {});
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
        uniqueClaimCount: claimCounts[q.id] || 0,
      })),
      leaderboard,
    });
  } catch (error: any) {
    console.error('[API /admin/fair-qr] Server error:', error);
    return NextResponse.json({ error: 'Failed to load Fair QR admin data.' }, { status: 500 });
  }
}

/**
 * POST /api/admin/fair-qr — activate/deactivate a single Fair QR (core or
 * daily bonus). Never changes points, target_code, or the window fields —
 * only status, so a daily bonus can never be accidentally activated early
 * or reactivated past its own day by this control.
 */
export async function POST(request: Request) {
  const session = resolveAdminSessionFromRequest(request);
  if (!session.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { questId, status } = body;
    if (!questId || (status !== 'active' && status !== 'inactive')) {
      return NextResponse.json({ error: 'questId and a status of active/inactive are required.' }, { status: 400 });
    }

    const event = await getEventBySlugDB(FAIR_EVENT_SLUG);
    const quests = event ? await getQuestsForEventDB(event.id) : [];
    const target = quests.find((q) => q.id === questId);
    if (!target) {
      return NextResponse.json({ error: 'Quest not found in the Fair QR Hunt.' }, { status: 404 });
    }

    const updated = await updateQuestDB(questId, { status });
    return NextResponse.json({ success: true, quest: updated });
  } catch (error: any) {
    console.error('[API /admin/fair-qr] Server error:', error);
    return NextResponse.json({ error: 'Failed to update Fair QR status.' }, { status: 500 });
  }
}
