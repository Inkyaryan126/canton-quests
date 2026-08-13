// Canton Quests — Spectator Participation Core Engine & Security Boundary (Phase 5.1)

import crypto from 'crypto';
import * as supabaseModule from './supabase';
import { SEED_DEMO_PLAYERS } from './seed-data';
import {
  AudienceEvent,
  PublicAudienceEvent,
  AudienceEventOption,
  PublicAudienceEventOption,
  AudienceVote,
  AudienceEffect,
  PublicGameFeedItem,
  HostBroadcast,
  SpectatorSession,
  SpectatorSystemSettings,
  EventActivityItem,
  AudienceEventType,
  AudienceEligibilityMode,
  AudienceTargetType,
} from './types';

export const SPECTATOR_COOKIE_NAME = 'cg_spec_token';
export const PLAYER_COOKIE_NAME = 'cg_player_token';

export function extractCookieValue(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export async function getServerDerivedAuthenticatedPlayerId(request: Request, bodyPlayerId?: string): Promise<string | undefined> {
  let cookiePlayerToken: string | undefined;
  try {
    const { cookies } = await import('next/headers');
    try {
      cookiePlayerToken = cookies().get(PLAYER_COOKIE_NAME)?.value;
    } catch {
      // Ignore if cookies() is called outside request scope
    }
  } catch {
    // Fallback if next/headers import is unavailable
  }

  const rawCookieHeader = request.headers.get('cookie');
  if (!cookiePlayerToken) {
    cookiePlayerToken = extractCookieValue(rawCookieHeader, PLAYER_COOKIE_NAME);
  }

  const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const xPlayerToken = request.headers.get('x-player-token');

  if (supabaseModule.isSupabaseConfigured) {
    // 1. Check for verified Supabase Auth JWT ONLY from the Authorization bearer header
    if (authHeader && authHeader.includes('.') && supabaseModule.supabase) {
      try {
        const { data: authUser, error: authError } = await supabaseModule.supabase.auth.getUser(authHeader);
        if (authUser?.user && !authError) {
          const { data: playerByUserId } = await supabaseModule.supabase
            .from('players')
            .select('id')
            .eq('user_id', authUser.user.id)
            .maybeSingle();
          if (playerByUserId?.id) {
            return playerByUserId.id;
          }
        }
      } catch {
        // Ignore invalid JWT and continue
      }
    }

    // 2. Check for converted spectator session via HTTP-only spectator cookie token (cg_spec_token)
    const specCookieToken = extractCookieValue(rawCookieHeader, SPECTATOR_COOKIE_NAME);
    if (specCookieToken && supabaseModule.supabaseAdmin) {
      try {
        const sessionTokenHash = createSessionTokenHash(specCookieToken);
        const { data: sessionRow } = await supabaseModule.supabaseAdmin
          .from('spectator_sessions')
          .select('converted_to_player_id')
          .eq('session_token_hash', sessionTokenHash)
          .maybeSingle();
        if (sessionRow?.converted_to_player_id) {
          return sessionRow.converted_to_player_id;
        }
      } catch {
        // Ignore query error and fall through
      }
    }

    // In Supabase mode, raw client-controlled identifiers (x-player-token, body.playerId, cg_player_token,
    // local plr-* IDs, or arbitrary unverified browser UUIDs) MUST NOT establish authenticated player identity.
    return undefined;
  }

  // Local engine fallback (non-Supabase local dev only)
  const headerToken = authHeader || xPlayerToken;
  const effectiveToken = headerToken || cookiePlayerToken || bodyPlayerId;

  if (!effectiveToken) {
    const specCookieToken = extractCookieValue(rawCookieHeader, SPECTATOR_COOKIE_NAME);
    if (specCookieToken) {
      const sessionTokenHash = createSessionTokenHash(specCookieToken);
      const session = spectatorSessionsStore.find((s) => s.sessionTokenHash === sessionTokenHash);
      if (session?.convertedToPlayerId) {
        return session.convertedToPlayerId;
      }
    }
    return undefined;
  }

  if (
    effectiveToken.startsWith('player-') ||
    effectiveToken.startsWith('plr-') ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(effectiveToken)
  ) {
    return effectiveToken;
  }

  const demoPlayer = SEED_DEMO_PLAYERS.find((p) => p.id === effectiveToken || p.userId === effectiveToken);
  if (demoPlayer) {
    return demoPlayer.id;
  }

  return undefined;
}

/**
 * Resolves the server secret salt for spectator token/IP hashing.
 * Throws in production if SPECTATOR_SESSION_SECRET environment variable is missing.
 */
export function getSpectatorSessionSecret(): string {
  const secret = process.env.SPECTATOR_SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL SECURITY ERROR: SPECTATOR_SESSION_SECRET must be configured in production.');
    }
    return 'canton-spectator-secret-salt-2026';
  }
  return secret;
}

// -----------------------------------------------------------------------------
// In-Memory Storage Backing (for Dev / Standalone Engine execution & Vitest)
// -----------------------------------------------------------------------------

const audienceEventsStore: AudienceEvent[] = [];
const audienceOptionsStore: AudienceEventOption[] = [];
const audienceVotesStore: AudienceVote[] = [];
const audienceEffectsStore: AudienceEffect[] = [];
const publicFeedStore: PublicGameFeedItem[] = [];
const hostBroadcastsStore: HostBroadcast[] = [];
const spectatorSessionsStore: SpectatorSession[] = [];
const spectatorSettingsStore: Map<string, SpectatorSystemSettings> = new Map();

// -----------------------------------------------------------------------------
// 1. Session & Cryptographic Identity Helpers
// -----------------------------------------------------------------------------

/**
 * Computes a secure SHA-256 hash for a spectator session token using server salt.
 */
export function createSessionTokenHash(rawToken: string, customSalt?: string): string {
  const salt = customSalt || getSpectatorSessionSecret();
  return crypto.createHash('sha256').update(`${rawToken}:${salt}`).digest('hex');
}

/**
 * Computes a secure SHA-256 hash for an IP address using server salt.
 */
export function createIpHash(ipAddress: string, customSalt?: string): string {
  const salt = customSalt || getSpectatorSessionSecret();
  const cleanIp = (ipAddress || '127.0.0.1').split(',')[0].trim();
  return crypto.createHash('sha256').update(`${cleanIp}:${salt}`).digest('hex');
}

/**
 * Registers or updates a spectator session safely.
 */
export function registerOrUpdateSpectatorSession(params: {
  sessionTokenHash: string;
  ipHash: string;
  isMinor?: boolean;
  ageAcknowledged?: boolean;
  safetyAcknowledged?: boolean;
}): SpectatorSession {
  const now = new Date().toISOString();
  const existingIndex = spectatorSessionsStore.findIndex(
    (s) => s.sessionTokenHash === params.sessionTokenHash
  );

  if (existingIndex >= 0) {
    const existing = spectatorSessionsStore[existingIndex];
    const updated: SpectatorSession = {
      ...existing,
      ipHash: params.ipHash,
      isMinor: existing.isMinor || (params.isMinor === true),
      ageAcknowledgedAt: params.ageAcknowledged ? now : existing.ageAcknowledgedAt,
      safetyAcknowledgedAt: params.safetyAcknowledged ? now : existing.safetyAcknowledgedAt,
      lastSeenAt: now,
    };
    spectatorSessionsStore[existingIndex] = updated;
    return updated;
  }

  const created: SpectatorSession = {
    id: crypto.randomUUID(),
    sessionTokenHash: params.sessionTokenHash,
    ipHash: params.ipHash,
    isMinor: !!params.isMinor,
    ageAcknowledgedAt: params.ageAcknowledged ? now : undefined,
    safetyAcknowledgedAt: params.safetyAcknowledged ? now : undefined,
    createdAt: now,
    lastSeenAt: now,
  };
  spectatorSessionsStore.push(created);
  return created;
}

/**
 * Backend foundation for converting a spectator session to a Guest Player profile.
 */
export function convertSpectatorToPlayer(
  sessionTokenHash: string,
  playerId: string
): SpectatorSession | null {
  const session = spectatorSessionsStore.find((s) => s.sessionTokenHash === sessionTokenHash);
  if (!session) {
    return null;
  }

  session.convertedToPlayerId = playerId;
  session.lastSeenAt = new Date().toISOString();
  return session;
}

// -----------------------------------------------------------------------------
// 2. Audience Events Core Logic
// -----------------------------------------------------------------------------

/**
 * GM helper to create a new audience event with options.
 * Enforces single active event index rule.
 */
export function createAudienceEvent(params: {
  eventId: string;
  title: string;
  description?: string;
  eventType: AudienceEventType;
  eligibilityMode?: AudienceEligibilityMode;
  maxVotesPerSession?: number;
  targetType?: AudienceTargetType;
  targetId?: string;
  targetName?: string;
  durationMinutes?: number;
  options: Array<{
    label: string;
    description?: string;
    effectPayload?: Record<string, any>;
  }>;
  createdBy?: string;
  startsAt?: string;
}): { event: AudienceEvent; options: AudienceEventOption[] } {
  // Check active event uniqueness rule
  const hasActive = audienceEventsStore.some(
    (e) => e.eventId === params.eventId && e.status === 'voting_active'
  );

  const now = new Date();
  const startsAtDate = params.startsAt ? new Date(params.startsAt) : now;
  const durationMs = (params.durationMinutes || 15) * 60 * 1000;
  const endsAtDate = new Date(startsAtDate.getTime() + durationMs);

  const initialStatus = hasActive ? 'draft' : 'voting_active';

  const newEvent: AudienceEvent = {
    id: crypto.randomUUID(),
    eventId: params.eventId,
    title: params.title,
    description: params.description,
    eventType: params.eventType,
    status: initialStatus,
    isPaused: false,
    eligibilityMode: params.eligibilityMode || 'all_spectators',
    maxVotesPerSession: 1,
    targetType: params.targetType,
    targetId: params.targetId,
    targetName: params.targetName,
    startsAt: startsAtDate.toISOString(),
    endsAt: endsAtDate.toISOString(),
    isManuallyOverridden: false,
    createdBy: params.createdBy,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  audienceEventsStore.push(newEvent);

  const createdOptions: AudienceEventOption[] = params.options.map((opt, idx) => {
    const newOpt: AudienceEventOption = {
      id: crypto.randomUUID(),
      audienceEventId: newEvent.id,
      optionLabel: opt.label,
      optionDescription: opt.description,
      effectPayload: opt.effectPayload || {},
      voteCount: 0,
      sortOrder: idx + 1,
      createdAt: now.toISOString(),
    };
    audienceOptionsStore.push(newOpt);
    return newOpt;
  });

  return { event: newEvent, options: createdOptions };
}

/**
 * Retrieves public-sanitized audience events for spectators or raw events for admins.
 */
export function getAudienceEvents(eventId: string, isAdmin: boolean = false): PublicAudienceEvent[] | AudienceEvent[] {
  if (audienceEventsStore.length === 0) {
    seedDefaultSpectatorData(eventId);
  }
  const events = audienceEventsStore.filter((e) => e.eventId === eventId);
  if (isAdmin) return events;

  // Filter to public-eligible states & sanitize internal metadata
  return events
    .filter((e) => ['voting_active', 'tallying_closed', 'effect_applied', 'resolved'].includes(e.status))
    .map((e) => ({
      id: e.id,
      eventId: e.eventId,
      title: e.title,
      description: e.description,
      eventType: e.eventType,
      status: e.status,
      isPaused: e.isPaused,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      pausedAt: e.pausedAt,
      eligibilityMode: e.eligibilityMode,
      maxVotesPerSession: e.maxVotesPerSession,
      publicTargetDescription: e.targetType === 'category' ? e.targetName : 'Game Target',
      publicWinningOptionId: e.status === 'resolved' ? e.winningOptionId : undefined,
      createdAt: e.createdAt,
    }));
}

/**
 * Retrieves public-sanitized options for spectators or raw options for admins.
 */
export function getAudienceEventOptions(
  audienceEventId: string,
  isAdmin: boolean = false
): PublicAudienceEventOption[] | AudienceEventOption[] {
  const options = audienceOptionsStore.filter((o) => o.audienceEventId === audienceEventId);
  if (isAdmin) return options;

  // Public view masks effectPayload
  return options.map((o) => ({
    id: o.id,
    audienceEventId: o.audienceEventId,
    optionLabel: o.optionLabel,
    optionDescription: o.optionDescription,
    voteCount: o.voteCount,
    sortOrder: o.sortOrder,
    createdAt: o.createdAt,
  }));
}

/**
 * Safely casts a spectator vote with all security, timing, and same-event checks.
 */
export function castSpectatorVote(params: {
  audienceEventId: string;
  optionId: string;
  sessionTokenHash: string;
  ipHash: string;
  playerId?: string;
  activeSubmissionTimes?: string[];
}): { success: boolean; error?: string; code?: string; newVoteCount?: number } {
  const evt = audienceEventsStore.find((e) => e.id === params.audienceEventId);
  if (!evt) {
    return { success: false, error: 'Audience event not found' };
  }

  const settings = spectatorSettingsStore.get(evt.eventId);
  if (settings && settings.isSpectatorSystemDisabled) {
    return {
      success: false,
      error: 'Spectator system is currently frozen by Game Master',
      code: 'SPECTATOR_SYSTEM_DISABLED',
    };
  }

  if (evt.status !== 'voting_active' || evt.isPaused) {
    return { success: false, error: 'Voting is not active for this event' };
  }

  if (evt.endsAt && new Date() > new Date(evt.endsAt)) {
    return { success: false, error: 'Voting window has expired' };
  }

  // Verify option belongs to event (Same-event relational invariant)
  const option = audienceOptionsStore.find(
    (o) => o.id === params.optionId && o.audienceEventId === params.audienceEventId
  );
  if (!option) {
    return { success: false, error: 'Invalid option for this audience event' };
  }

  // Eligibility check
  if (evt.eligibilityMode === 'authenticated_only' && !params.playerId) {
    return { success: false, error: 'Authentication required for this vote' };
  }

  if (evt.eligibilityMode === 'exclude_active_players' && params.playerId && params.activeSubmissionTimes) {
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const hasRecentActivity = params.activeSubmissionTimes.some(
      (t) => new Date(t) >= thirtyMinsAgo
    );
    if (hasRecentActivity) {
      return {
        success: false,
        error: 'Active quest players cannot participate in this spectator vote',
      };
    }
  }

  // Check vote count per session
  const existingVotes = audienceVotesStore.filter(
    (v) => v.audienceEventId === params.audienceEventId && v.sessionTokenHash === params.sessionTokenHash
  );

  if (existingVotes.length >= 1) {
    return {
      success: false,
      error: 'Session vote limit reached (1 vote per spectator allowed)',
      code: 'VOTE_LIMIT_REACHED',
    };
  }

  // Create vote record
  const newVote: AudienceVote = {
    id: crypto.randomUUID(),
    audienceEventId: params.audienceEventId,
    optionId: params.optionId,
    sessionTokenHash: params.sessionTokenHash,
    voteNumber: existingVotes.length + 1,
    ipHash: params.ipHash,
    playerId: params.playerId,
    createdAt: new Date().toISOString(),
  };

  audienceVotesStore.push(newVote);
  option.voteCount += 1;

  return {
    success: true,
    newVoteCount: option.voteCount,
  };
}

/**
 * Resolves an audience event, determining winning option and applying effect payload.
 */
export function resolveAudienceEvent(
  audienceEventId: string,
  overrideOptionId?: string,
  overrideReason?: string,
  resolvedBy?: string
): { success: boolean; winningOption?: AudienceEventOption; effect?: AudienceEffect; error?: string } {
  const evt = audienceEventsStore.find((e) => e.id === audienceEventId);
  if (!evt) return { success: false, error: 'Event not found' };

  const options = audienceOptionsStore.filter((o) => o.audienceEventId === audienceEventId);
  if (options.length === 0) return { success: false, error: 'No options found for event' };

  let winner: AudienceEventOption | undefined;

  if (overrideOptionId) {
    winner = options.find((o) => o.id === overrideOptionId);
    if (!winner) return { success: false, error: 'Invalid override option ID' };
    evt.isManuallyOverridden = true;
    evt.overrideReason = overrideReason || 'Game Director Manual Override';
  } else {
    // Select option with highest vote count (break ties by sort order)
    winner = [...options].sort((a, b) => b.voteCount - a.voteCount || a.sortOrder - b.sortOrder)[0];
  }

  evt.winningOptionId = winner.id;
  evt.status = 'resolved';
  evt.resolvedBy = resolvedBy;
  evt.updatedAt = new Date().toISOString();

  // Create audience effect ledger entry with full lifecycle audit context
  const nowStr = new Date().toISOString();
  const effect: AudienceEffect = {
    id: crypto.randomUUID(),
    audienceEventId: evt.id,
    effectType: evt.eventType,
    payload: winner.effectPayload,
    status: evt.isManuallyOverridden ? 'overridden' : 'applied',
    appliedAt: nowStr,
    resolvedAt: nowStr,
    overrideContext: evt.isManuallyOverridden ? evt.overrideReason : undefined,
    resolvedBy: resolvedBy || evt.resolvedBy,
    createdAt: nowStr,
  };

  audienceEffectsStore.push(effect);

  return { success: true, winningOption: winner, effect };
}

// -----------------------------------------------------------------------------
// 3. Public Game Feed & Privacy Sanitization Boundary
// -----------------------------------------------------------------------------

/**
 * Coarse spatial location mapping helper. Maps coordinates to district names.
 */
export function mapCoordinatesToDistrict(lat?: number, lon?: number): string {
  if (!lat || !lon) return 'Canton Citywide Zone';

  // Coarse bounding box mapping for Canton, OH
  if (lat >= 40.795 && lat <= 40.805 && lon >= -81.38 && lon <= -81.37) {
    return 'Downtown Arts Corridor';
  }
  if (lat >= 40.805 && lat <= 40.82 && lon >= -81.37 && lon <= -81.35) {
    return 'Centennial Park District';
  }
  if (lat >= 40.78 && lat <= 40.795 && lon >= -81.39 && lon <= -81.37) {
    return 'South Market Quarter';
  }

  return 'Greater Canton Metro Zone';
}

/**
 * Strict text content sanitizer.
 * Redacts emails, phone numbers, exact geographic coordinates, secret passphrases,
 * admin notes, IP/token hashes, and private proof URLs.
 */
export function sanitizeTextContent(text?: string): string {
  if (!text) return '';

  let sanitized = text;

  // 1. Redact email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[redacted-email]');

  // 2. Redact phone numbers
  sanitized = sanitized.replace(/\b(?:\+?1[-. ]?)?\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})\b/g, '[redacted-phone]');

  // 3. Redact exact lat/lon coordinates (e.g. 40.7989, -81.3748 or lat=40.7989 lon=-81.3748)
  sanitized = sanitized.replace(/-?\d{1,3}\.\d{4,}\s*,\s*-?\d{1,3}\.\d{4,}/gi, '[coarse-location]');
  sanitized = sanitized.replace(/(?:lat|latitude|lon|longitude)\s*[:=]\s*-?\d+\.\d+/gi, '[coarse-location]');

  // 4. Redact sensitive keywords and key-value metadata
  sanitized = sanitized.replace(/(?:secret_code|passphrase|admin_note|token_hash|ip_hash|proof_url|ssn|auth_token)\s*[:=]\s*\S+/gi, '[redacted-sensitive-data]');

  return sanitized.trim();
}

/**
 * PUBLIC SANITIZATION BOUNDARY
 * Transforms raw activity items into delayed, privacy-sanitized public feed entries.
 * Strips precise lat/lon, anonymizes minors, enforces 2-min delay buffer.
 */
export function sanitizeActivityItem(
  raw: EventActivityItem & {
    eventId?: string;
    lat?: number;
    lon?: number;
    isMinor?: boolean;
    isPublicOptIn?: boolean;
  }
): PublicGameFeedItem | null {
  const districtName = mapCoordinatesToDistrict(raw.lat, raw.lon);

  // Anonymize actor name if minor or if user did not opt in to public broadcast
  const displayName = raw.isMinor || !raw.isPublicOptIn
    ? `Agent #${raw.actorName ? raw.actorName.slice(-4) : '7420'}`
    : raw.actorName;

  // Sanitize headline and details
  const cleanTitle = sanitizeTextContent(raw.title);

  let cleanDetails = '';
  if (!raw.isMinor && raw.details) {
    cleanDetails = sanitizeTextContent(raw.details);
  }

  // 2-minute delay buffer for gameplay quest completions to prevent stream sniping
  const isDelayed = raw.type === 'quest_completed';
  const publishedAtDate = isDelayed ? new Date(Date.now() + 120000) : new Date();

  return {
    id: crypto.randomUUID(),
    eventId: raw.eventId || 'default-event',
    feedType: raw.type,
    headline: `${displayName} — ${cleanTitle}`,
    body: cleanDetails ? `${cleanDetails} (${districtName})` : `Activity recorded in ${districtName}`,
    districtName,
    urgency: raw.type === 'flash_activated' ? 'flash' : raw.type === 'announcement' ? 'warning' : 'info',
    isHost: raw.type === 'announcement',
    isRetracted: false,
    isMinorParticipant: !!raw.isMinor,
    isPublicFeedEligible: true,
    publishedAt: publishedAtDate.toISOString(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Publishes a sanitized feed item into the public feed store.
 */
export function publishToPublicGameFeed(item: PublicGameFeedItem): PublicGameFeedItem {
  publicFeedStore.push(item);
  return item;
}

/**
 * Retrieves non-retracted public feed items for spectators.
 * Applies database read boundary rules (publishedAt <= NOW(), non-retracted, eligible, non-minor).
 */
export function getPublicGameFeed(eventId: string, limit: number = 50): PublicGameFeedItem[] {
  const now = new Date();
  return publicFeedStore
    .filter(
      (item) =>
        item.eventId === eventId &&
        !item.isRetracted &&
        item.isPublicFeedEligible &&
        !item.isMinorParticipant &&
        new Date(item.publishedAt) <= now
    )
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit)
    .map((item) => ({
      ...item,
      headline: sanitizeTextContent(item.headline),
      body: sanitizeTextContent(item.body),
    }));
}

// -----------------------------------------------------------------------------
// 4. Host Broadcasts & System Controls
// -----------------------------------------------------------------------------

export function createHostBroadcast(params: {
  eventId: string;
  headline: string;
  body: string;
  tone?: 'theatrical' | 'urgent' | 'announcement' | 'flash';
  targetChannel?: 'all' | 'spectators' | 'players' | 'internal';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  isPublished?: boolean;
  publishedAt?: string;
}): HostBroadcast {
  const now = new Date().toISOString();
  const cleanHeadline = sanitizeTextContent(params.headline);
  const cleanBody = sanitizeTextContent(params.body);

  const broadcast: HostBroadcast = {
    id: crypto.randomUUID(),
    eventId: params.eventId,
    headline: cleanHeadline,
    body: cleanBody,
    tone: params.tone || 'theatrical',
    targetChannel: params.targetChannel || 'all',
    priority: params.priority || 'normal',
    isPublished: params.isPublished !== undefined ? params.isPublished : true,
    publishedAt: params.publishedAt || now,
    createdAt: now,
    updatedAt: now,
  };

  hostBroadcastsStore.push(broadcast);

  // If published to public spectators, also write to public feed immediately
  if (broadcast.isPublished && ['all', 'spectators'].includes(broadcast.targetChannel || 'all')) {
    publishToPublicGameFeed({
      id: crypto.randomUUID(),
      eventId: params.eventId,
      feedType: 'host_broadcast',
      headline: `📢 HOST BROADCAST: ${cleanHeadline}`,
      body: cleanBody,
      urgency: params.tone === 'urgent' ? 'urgent' : 'warning',
      isHost: true,
      isRetracted: false,
      isMinorParticipant: false,
      isPublicFeedEligible: true,
      publishedAt: broadcast.publishedAt || now,
      createdAt: now,
    });
  }

  return broadcast;
}

export function getHostBroadcasts(eventId: string, isAdmin: boolean = false): HostBroadcast[] {
  const now = new Date();
  const rawList = hostBroadcastsStore.filter((b) => {
    if (b.eventId !== eventId) return false;
    if (isAdmin) return true;
    return b.isPublished && new Date(b.publishedAt || b.createdAt) <= now && ['all', 'spectators'].includes(b.targetChannel || 'all');
  });

  if (isAdmin) return rawList;

  return rawList.map((b) => ({
    ...b,
    headline: sanitizeTextContent(b.headline),
    body: sanitizeTextContent(b.body),
  }));
}

export function toggleSpectatorSystemFreeze(
  eventId: string,
  isDisabled: boolean,
  reason?: string
): SpectatorSystemSettings {
  const now = new Date().toISOString();
  const settings: SpectatorSystemSettings = {
    eventId,
    isSpectatorSystemDisabled: isDisabled,
    disabledReason: isDisabled ? reason || 'Emergency Game Master Freeze' : undefined,
    disabledAt: isDisabled ? now : undefined,
    updatedAt: now,
  };

  spectatorSettingsStore.set(eventId, settings);
  return settings;
}

export function getSpectatorSystemSettings(eventId: string): SpectatorSystemSettings {
  return (
    spectatorSettingsStore.get(eventId) || {
      eventId,
      isSpectatorSystemDisabled: false,
      updatedAt: new Date().toISOString(),
    }
  );
}

/**
 * Resets stores for vitest testing isolation.
 */
export function resetSpectatorStores(): void {
  audienceEventsStore.length = 0;
  audienceOptionsStore.length = 0;
  audienceVotesStore.length = 0;
  audienceEffectsStore.length = 0;
  publicFeedStore.length = 0;
  hostBroadcastsStore.length = 0;
  spectatorSessionsStore.length = 0;
  spectatorSettingsStore.clear();
}

/**
 * Seeds default demonstration spectator data for in-memory execution when stores are empty.
 */
export function seedDefaultSpectatorData(eventId: string = 'default-event'): void {
  // Gate demo spectator seed data in production environment unless explicitly enabled
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    return;
  }
  if (audienceEventsStore.some((e) => e.eventId === eventId)) return;

  const now = new Date();
  const startsAt = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const endsAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

  const demoEvent: AudienceEvent = {
    id: 'evt-audience-demo-1',
    eventId,
    title: '🎯 COMMUNITY DECISION: FINALE QUEST MULTIPLIER',
    description: 'Should the finale quest in Downtown Canton award double points to all agents or unlock a bonus flash objective?',
    eventType: 'audience_vote',
    status: 'voting_active',
    isPaused: false,
    eligibilityMode: 'all_spectators',
    maxVotesPerSession: 1,
    targetType: 'category',
    targetId: 'cat-downtown-arts',
    targetName: 'Downtown Arts Corridor',
    startsAt,
    endsAt,
    isManuallyOverridden: false,
    createdAt: startsAt,
    updatedAt: startsAt,
  };
  audienceEventsStore.push(demoEvent);

  const opt1: AudienceEventOption = {
    id: 'opt-demo-1',
    audienceEventId: demoEvent.id,
    optionLabel: '2x XP Multiplier on Finale Quest',
    optionDescription: 'All agents completing the finale quest receive double XP bonus points.',
    effectPayload: { multiplier: 2 },
    voteCount: 47,
    sortOrder: 1,
    createdAt: startsAt,
  };
  const opt2: AudienceEventOption = {
    id: 'opt-demo-2',
    audienceEventId: demoEvent.id,
    optionLabel: 'Unlock Secret Bonus Flash Objective',
    optionDescription: 'Reveals a secret bonus QR code location near Palace Theatre for 500 bonus points.',
    effectPayload: { unlockBonus: true },
    voteCount: 38,
    sortOrder: 2,
    createdAt: startsAt,
  };
  const opt3: AudienceEventOption = {
    id: 'opt-demo-3',
    audienceEventId: demoEvent.id,
    optionLabel: 'Grant +50 XP Boost to Trailing Squads',
    optionDescription: 'Boosts teams outside the top 3 leaderboard spots to close the competitive gap.',
    effectPayload: { catchupBonus: 50 },
    voteCount: 15,
    sortOrder: 3,
    createdAt: startsAt,
  };
  audienceOptionsStore.push(opt1, opt2, opt3);

  const broadcast: HostBroadcast = {
    id: 'bc-demo-1',
    eventId,
    headline: 'LIVE SPECTATOR VOTE IS ACTIVE IN DOWNTOWN CANTON!',
    body: 'Spectators watching online and at Centennial Plaza: cast your votes now! The winning choice will take effect live during the Finale Sprint.',
    tone: 'theatrical',
    targetChannel: 'all',
    priority: 'high',
    isPublished: true,
    publishedAt: startsAt,
    createdAt: startsAt,
    updatedAt: startsAt,
  };
  hostBroadcastsStore.push(broadcast);

  const feedItems: PublicGameFeedItem[] = [
    {
      id: 'feed-demo-1',
      eventId,
      feedType: 'host_broadcast',
      headline: '📢 HOST BROADCAST: Live Spectator Vote Is Active',
      body: 'Cast your vote in the active community decision before the 15-minute timer expires.',
      urgency: 'warning',
      isHost: true,
      isRetracted: false,
      isMinorParticipant: false,
      isPublicFeedEligible: true,
      publishedAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
    },
    {
      id: 'feed-demo-2',
      eventId,
      feedType: 'quest_completion',
      headline: 'Squad Alpha cracked the Centennial Plaza cipher emblem!',
      body: 'Verified location proximity and solved riddle #4.',
      districtName: 'Downtown Arts Corridor',
      urgency: 'info',
      isHost: false,
      isRetracted: false,
      isMinorParticipant: false,
      isPublicFeedEligible: true,
      publishedAt: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 6 * 60 * 1000).toISOString(),
    },
    {
      id: 'feed-demo-3',
      eventId,
      feedType: 'flash_quest',
      headline: 'Flash Quest activated in Central Market District!',
      body: '15-minute timed bonus objective opened for all active field agents.',
      districtName: 'Central Market District',
      urgency: 'flash',
      isHost: false,
      isRetracted: false,
      isMinorParticipant: false,
      isPublicFeedEligible: true,
      publishedAt: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 12 * 60 * 1000).toISOString(),
    },
    {
      id: 'feed-demo-4',
      eventId,
      feedType: 'quest_completion',
      headline: 'Agent Cipher-9 checked in near McKinley Monument',
      body: 'Verified arrival at historic monument steps.',
      districtName: 'McKinley Monument Zone',
      urgency: 'info',
      isHost: false,
      isRetracted: false,
      isMinorParticipant: false,
      isPublicFeedEligible: true,
      publishedAt: new Date(now.getTime() - 18 * 60 * 1000).toISOString(),
      createdAt: new Date(now.getTime() - 18 * 60 * 1000).toISOString(),
    },
  ];
  publicFeedStore.push(...feedItems);
}

export interface DistrictActivity {
  id: string;
  name: string;
  landmark: string;
  activityLevel: 'HIGH' | 'MODERATE' | 'QUIET' | 'NO ACTIVITY';
  agentCount: number;
  activeQuestsCount: number;
}

export function getSpectatorSessionCount(_eventId?: string): number {
  return spectatorSessionsStore.length;
}

export function getDistrictActivity(eventId: string = 'default-event'): DistrictActivity[] {
  const feed = getPublicGameFeed(eventId);

  const districts: Array<{ id: string; name: string; landmark: string; keywords: string[] }> = [
    {
      id: 'dist-arts',
      name: 'Downtown Arts Corridor',
      landmark: 'Centennial Plaza & Palace Theatre',
      keywords: ['arts', 'centennial', 'palace'],
    },
    {
      id: 'dist-market',
      name: 'Central Market District',
      landmark: '4th Street Shops & Food Hub',
      keywords: ['market', '4th street', 'food'],
    },
    {
      id: 'dist-mckinley',
      name: 'McKinley Monument Zone',
      landmark: 'McKinley National Memorial & Park',
      keywords: ['mckinley', 'monument', 'memorial'],
    },
    {
      id: 'dist-hof',
      name: 'Hall of Fame Village Zone',
      landmark: 'Stadium Plaza & Campus',
      keywords: ['hall of fame', 'stadium', 'village'],
    },
  ];

  return districts.map((d) => {
    const matchingItems = feed.filter((item) => {
      if (item.districtName && item.districtName.toLowerCase().includes(d.keywords[0])) return true;
      const combinedText = `${item.headline} ${item.body}`.toLowerCase();
      return d.keywords.some((kw) => combinedText.includes(kw));
    });

    const uniqueActors = new Set(matchingItems.map((i) => i.headline.split(' ')[0])).size;
    const activeQuestsCount = matchingItems.length;

    let activityLevel: DistrictActivity['activityLevel'] = 'NO ACTIVITY';
    if (uniqueActors >= 5) activityLevel = 'HIGH';
    else if (uniqueActors >= 2) activityLevel = 'MODERATE';
    else if (uniqueActors >= 1) activityLevel = 'QUIET';

    return {
      id: d.id,
      name: d.name,
      landmark: d.landmark,
      activityLevel,
      agentCount: uniqueActors,
      activeQuestsCount,
    };
  });
}
