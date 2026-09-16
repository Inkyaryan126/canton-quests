import { NextResponse } from 'next/server';
import { cantonFoundingSeasonPackage } from '../cities/canton/founding-season';
import { isGridChatEnabled } from './chat-feature-flags';
import { resolveSupabaseGridChatSeasonId } from './supabase-chat';
import {
  resolveAuthenticatedSession,
  setAuthCookies,
} from '../../supabase-auth';

export type GridChatSession = Awaited<ReturnType<typeof resolveAuthenticatedSession>>;

export function gridChatJson(
  session: GridChatSession,
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  setAuthCookies(response, session.refreshedSession, session.player?.id);
  return response;
}

export async function requireGridChatContext(request: Request): Promise<{
  session: GridChatSession;
  playerId: string;
  seasonId: string;
} | { session: GridChatSession; response: NextResponse }> {
  const session = await resolveAuthenticatedSession(request);
  if (!isGridChatEnabled()) {
    return {
      session,
      response: gridChatJson(session, { success: false, error: 'Grid chat is not enabled.' }, { status: 404 }),
    };
  }
  if (!session.player) {
    return {
      session,
      response: gridChatJson(session, { success: false, error: 'Authentication required.' }, { status: 401 }),
    };
  }

  try {
    const seasonId = await resolveSupabaseGridChatSeasonId(cantonFoundingSeasonPackage);
    if (!seasonId) {
      return {
        session,
        response: gridChatJson(session, { success: false, error: 'Grid season is not available.' }, { status: 404 }),
      };
    }
    return { session, playerId: session.player.id, seasonId };
  } catch (error) {
    console.error('[Grid chat context]', error);
    return {
      session,
      response: gridChatJson(session, { success: false, error: 'Grid chat is unavailable.' }, { status: 503 }),
    };
  }
}

export function gridChatError(error: unknown): { message: string; status: number } {
  const raw = error instanceof Error ? error.message : '';
  if (raw.includes('CHAT_RATE_LIMITED')) return { message: 'You are sending messages too quickly.', status: 429 };
  if (raw.includes('DIRECT_CHAT_MINOR_RESTRICTED')) return { message: 'Direct messages are not available for this account.', status: 403 };
  if (raw.includes('PRIVATE_CHAT_MINOR_RESTRICTED')) return { message: 'Private party chat is not available for this account.', status: 403 };
  if (raw.includes('CHAT_BLOCKED')) return { message: 'This conversation is unavailable.', status: 403 };
  if (raw.includes('CHAT_MEMBERSHIP_REQUIRED')) return { message: 'You do not have access to this channel.', status: 403 };
  if (raw.includes('PARTY_INVITE_FORBIDDEN')) return { message: 'Only a party owner or moderator can invite players.', status: 403 };
  if (raw.includes('PARTY_OWNER_CANNOT_LEAVE')) return { message: 'The party owner must remain until the other members leave.', status: 409 };
  if (raw.includes('PARTY_NAME_INVALID') || raw.includes('Party name must')) return { message: 'Party name must be 2–60 characters.', status: 400 };
  if (raw.includes('DISTRICT_NOT_IN_CITY')) return { message: 'That district is not available in this city.', status: 404 };
  if (raw.includes('PLAYER_NOT_IN_SEASON')) return { message: 'Join the active Grid season before using chat.', status: 403 };
  if (raw.includes('CHAT_CALLSIGN_AMBIGUOUS')) return { message: 'That callsign is not unique enough to start a direct chat.', status: 409 };
  if (raw.includes('Player callsign not found')) return { message: 'Player callsign not found.', status: 404 };
  if (raw.includes('You cannot direct-message yourself')) return { message: raw, status: 400 };
  if (raw.includes('Enter a valid callsign')) return { message: raw, status: 400 };
  if (raw.includes('Chat message')) return { message: raw, status: 400 };
  if (raw.includes('chat report') || raw.includes('Report details') || raw.includes('Unknown chat report')) {
    return { message: raw, status: 400 };
  }
  console.error('[Grid chat request]', error);
  return { message: 'Grid chat request failed.', status: 400 };
}
