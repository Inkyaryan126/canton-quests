import { NextResponse } from 'next/server';
import { getEventBySlugDB, getPlayerByIdDB } from '@/lib/supabase-db';
import { resolveAuthenticatedSession } from '@/lib/supabase-auth';
import { createPlayerLinkDB, createGroupPlayerLinkDB, getPlayerLinkStatsDB, getPlayerOwnLinksDB } from '@/lib/player-links-db';
import { PLAYER_LINK_CONFIG, PlayerLinkType, toSafePlayerLinkProfile } from '@/lib/player-links';
import { resolveContextualTransmission } from '@/lib/contextual-transmissions';

const VALID_LINK_TYPES = new Set(Object.keys(PLAYER_LINK_CONFIG));

/**
 * GET /api/game/player-links?eventSlug=X
 *   -> { stats: { totalLinks }, myLinks: [...] } for the authenticated
 *      caller (myLinks empty/omitted when unauthenticated — stats are
 *      always safe to return, they carry no per-player identity).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const eventSlug = url.searchParams.get('eventSlug') || '';
    if (!eventSlug) return NextResponse.json({ stats: { totalLinks: 0 }, myLinks: [] });

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ stats: { totalLinks: 0 }, myLinks: [] });

    const stats = await getPlayerLinkStatsDB(event.id);

    const session = await resolveAuthenticatedSession(request);
    const myLinks = session.player ? await getPlayerOwnLinksDB(event.id, session.player.id) : [];

    // Safe-profile lookup for the QR/link landing page — only ever returns
    // id/displayName/path/avatarUrl (toSafePlayerLinkProfile), never email
    // or any other player-table field, regardless of who's asking.
    const lookupPlayerId = url.searchParams.get('lookupPlayerId');
    let lookupProfile = null;
    if (lookupPlayerId) {
      const target = await getPlayerByIdDB(lookupPlayerId);
      lookupProfile = target ? toSafePlayerLinkProfile(target) : null;
    }

    return NextResponse.json({ stats, myLinks, lookupProfile });
  } catch (error) {
    console.error('[API /game/player-links] GET error:', error);
    return NextResponse.json({ error: 'Player links unavailable' }, { status: 500 });
  }
}

/**
 * POST /api/game/player-links
 * Body: { eventSlug, linkType, targetPlayerId } or { eventSlug, groupPlayerIds: [...] } for GROUP_OBJECTIVE.
 *
 * The initiator is always the authenticated caller — never a
 * client-supplied id. A forged targetPlayerId still only ever links the
 * real caller with whatever player that id resolves to; it cannot be used
 * to link two OTHER players together or to impersonate a different
 * initiator, since createPlayerLinkDB always uses session.player.id.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const eventSlug: string = body.eventSlug || '';
    const linkType: string = body.linkType || 'PLAYER_LINK';

    if (!eventSlug) return NextResponse.json({ success: false, error: 'Missing eventSlug' }, { status: 400 });
    if (!VALID_LINK_TYPES.has(linkType)) {
      return NextResponse.json({ success: false, error: 'Unknown linkType' }, { status: 400 });
    }

    const event = await getEventBySlugDB(eventSlug);
    if (!event) return NextResponse.json({ success: false, error: 'Event not found' }, { status: 404 });

    const session = await resolveAuthenticatedSession(request);
    if (!session.player) {
      return NextResponse.json({ success: false, error: 'Authentication required to establish a player link.' }, { status: 401 });
    }

    if (linkType === 'GROUP_OBJECTIVE') {
      const groupPlayerIds: string[] = Array.isArray(body.groupPlayerIds) ? body.groupPlayerIds : [];
      const { groupId, results } = await createGroupPlayerLinkDB({
        eventId: event.id,
        initiatorId: session.player.id,
        playerIds: [session.player.id, ...groupPlayerIds],
      });
      return NextResponse.json({ success: true, groupId, results });
    }

    const targetPlayerId: string = body.targetPlayerId || '';
    if (!targetPlayerId) return NextResponse.json({ success: false, error: 'Missing targetPlayerId' }, { status: 400 });

    const result = await createPlayerLinkDB({
      eventId: event.id,
      linkType: linkType as PlayerLinkType,
      initiatorId: session.player.id,
      targetId: targetPlayerId,
    });

    if (!result.eligibility.ok) {
      return NextResponse.json({ success: false, error: result.eligibility.message }, { status: 400 });
    }

    // Server state (the link + any reward) has already happened above —
    // this transmission is only ever an announcement of it, never the
    // cause. Resolved here (via the Contextual Transmission Engine, Mission
    // 1) and shipped ready-to-render; the client decides display timing.
    const transmission = result.newlyRewarded
      ? resolveContextualTransmission({
          trigger: 'player_link',
          eventSlug,
          inlineContent: {
            headline: PLAYER_LINK_CONFIG[linkType as PlayerLinkType].label,
            message: `+${result.xpAwarded} XP — a new signal connects in the field.`,
          },
        })
      : undefined;

    // Only ever tell the CALLER whether THEY personally just caught the
    // Signal Carrier role — never whether the other player already carries
    // it (that's their own private role state, not this caller's business).
    const caughtSignal = result.signalPropagatedTo === session.player.id;

    return NextResponse.json({
      success: true,
      linkId: result.linkId,
      newlyRewarded: result.newlyRewarded,
      xpAwarded: result.xpAwarded,
      transmission,
      caughtSignal,
    });
  } catch (error: any) {
    console.error('[API /game/player-links] POST error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Failed to establish link' }, { status: 500 });
  }
}
