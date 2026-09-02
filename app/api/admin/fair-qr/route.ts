import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { getEventBySlugDB, getQuestsForEventDB, updateQuestDB, getFairMysteryAdminDataDB } from '@/lib/supabase-db';
import { FAIR_CORE_CATEGORY, FAIR_EVENT_SLUG, MYSTERY_TOTAL_POOL_CENTS, getDeploymentStatus } from '@/lib/fair-hunt';
import { QuestPlacementDetails } from '@/lib/types';

/**
 * GET /api/admin/fair-qr — every core + daily bonus QR record (including
 * the internal fields never exposed by the public quest views: target_code,
 * gm_notes/placement note, structured placement details, derived
 * deployment status), plus, for the 20 Mystery Money Signals only, the
 * ADMIN-ONLY hidden cash value, found/finder/claim time, and pool totals —
 * for Commander/operations use (recovery, physical retrieval, prize
 * payout), never exposed via any public route.
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
    const mysteryQuestIds = sorted.filter((q) => q.category === FAIR_CORE_CATEGORY).map((q) => q.id);

    const { prizeCents, claims, finderNames } = await getFairMysteryAdminDataDB(mysteryQuestIds);

    const totalClaimedCents = Object.keys(claims).reduce((sum, questId) => sum + (prizeCents[questId] || 0), 0);

    return NextResponse.json({
      success: true,
      event,
      quests: sorted.map((q) => {
        const isMystery = q.category === FAIR_CORE_CATEGORY;
        const claim = claims[q.id];
        return {
          id: q.id,
          slug: q.slug,
          title: q.title,
          category: q.category,
          targetCode: q.targetCode,
          status: q.status,
          startsAt: q.startsAt,
          expiresAt: q.expiresAt,
          gmNotes: q.gmNotes,
          placementDetails: q.placementDetails || null,
          placedAt: q.placedAt || null,
          deploymentStatus: getDeploymentStatus(q),
          ...(isMystery
            ? {
                cashValueCents: prizeCents[q.id] ?? null,
                found: Boolean(claim),
                finderDisplayName: claim ? finderNames[claim.playerId] || 'Unknown Player' : null,
                claimedAt: claim?.claimedAt || null,
              }
            : {}),
        };
      }),
      mysteryMoney: {
        totalPoolCents: MYSTERY_TOTAL_POOL_CENTS,
        totalClaimedCents,
        totalRemainingCents: MYSTERY_TOTAL_POOL_CENTS - totalClaimedCents,
        signalsFound: Object.keys(claims).length,
        signalsTotal: mysteryQuestIds.length,
      },
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
        const rawLat = body.placementDetails?.latitude;
        const rawLng = body.placementDetails?.longitude;
        // Only ever set from a real, admin-entered number — never defaulted
        // or fabricated. Out-of-range/non-finite input is dropped (treated
        // as "not provided") rather than silently clamped.
        const latitude = typeof rawLat === 'number' && Number.isFinite(rawLat) && rawLat >= -90 && rawLat <= 90 ? rawLat : undefined;
        const longitude = typeof rawLng === 'number' && Number.isFinite(rawLng) && rawLng >= -180 && rawLng <= 180 ? rawLng : undefined;
        const placementDetails =
          body.placementDetails && typeof body.placementDetails === 'object'
            ? {
                description: typeof body.placementDetails.description === 'string' ? body.placementDetails.description.slice(0, 1000) : undefined,
                setupNotes: typeof body.placementDetails.setupNotes === 'string' ? body.placementDetails.setupNotes.slice(0, 1000) : undefined,
                retrievalNotes: typeof body.placementDetails.retrievalNotes === 'string' ? body.placementDetails.retrievalNotes.slice(0, 1000) : undefined,
                latitude,
                longitude,
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
