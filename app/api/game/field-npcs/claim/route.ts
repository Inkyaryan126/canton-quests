import { NextResponse } from 'next/server';
import { getEventBySlugDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { claimFieldNpcDB } from '@/lib/field-npcs-db';
import { resolveContextualTransmission } from '@/lib/contextual-transmissions';

/**
 * POST /api/game/field-npcs/claim
 * Body: { eventSlug, npcId, code }
 *
 * The constrained player-side claim mechanism the mission asks for: a real
 * human NPC speaks their current code to a player in the field; the player
 * (authenticated — never a client-supplied playerId) submits it here.
 * Event-scoped (npcId is looked up scoped to the resolved event, so a code
 * from one Operation can never claim an NPC in another), one-time
 * (reward_grants idempotency), inventory-safe (claim_field_npc_slot RPC).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventSlug: string = body.eventSlug || '';
    const npcId: string = body.npcId || '';
    const code: string = body.code || '';

    if (!eventSlug || !npcId || !code) {
      return NextResponse.json({ success: false, error: 'Missing eventSlug, npcId, or code' }, { status: 400 });
    }

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json({ success: false, error: 'Authentication required to claim.' }, { status: 401 });
    }

    const result = await claimFieldNpcDB({ eventId: event.id, npcId, playerId: session.player.id, suppliedCode: code });

    if (!result.eligibility.ok) {
      return NextResponse.json({ success: false, error: result.eligibility.message, reason: result.eligibility.reason }, { status: 400 });
    }

    const transmission = result.newlyClaimed
      ? resolveContextualTransmission({
          trigger: 'npc_event',
          eventSlug,
          inlineContent: {
            headline: 'Contact Confirmed',
            message: `+${result.xpAwarded} XP${result.drawingEntriesAwarded > 0 ? ` · +${result.drawingEntriesAwarded} Entry Token` : ''} — the signal has been exchanged.`,
          },
        })
      : undefined;

    return NextResponse.json({
      success: true,
      newlyClaimed: result.newlyClaimed,
      xpAwarded: result.xpAwarded,
      drawingEntriesAwarded: result.drawingEntriesAwarded,
      transmission,
    });
  } catch (error: any) {
    console.error('[API /game/field-npcs/claim] POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to claim' }, { status: 500 });
  }
}
