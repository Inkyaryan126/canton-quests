// Canton Quests — Spectator Supabase Service Layer (Phase 5.1 Spectator Engine)

import * as supabaseModule from './supabase';
import {
  AudienceEvent,
  PublicAudienceEvent,
  AudienceEventOption,
  PublicAudienceEventOption,
  AudienceEffect,
  PublicGameFeedItem,
  HostBroadcast,
  SpectatorSession,
  SpectatorSystemSettings,
  AudienceEventType,
  AudienceEligibilityMode,
  AudienceTargetType,
} from './types';
import * as localEngine from './spectator-engine';
import {
  FOUNDER_CIPHER_CANONICAL_DISTRICTS,
  isFairOperation,
  isFounderCipherOperation,
} from './spectator-districts';

export async function registerOrUpdateSpectatorSessionDB(params: {
  sessionTokenHash: string;
  ipHash: string;
  isMinor?: boolean;
  ageAcknowledged?: boolean;
  safetyAcknowledged?: boolean;
}): Promise<SpectatorSession> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.registerOrUpdateSpectatorSession(params);
  }

  if (!supabaseModule.supabaseAdmin) {
    throw new Error('Supabase Service Role client is required for spectator session registration.');
  }

  const { data, error } = await supabaseModule.supabaseAdmin.rpc('register_or_update_spectator_session', {
    p_session_token_hash: params.sessionTokenHash,
    p_ip_hash: params.ipHash,
    p_is_minor: params.isMinor ?? null,
    p_age_acknowledged: params.ageAcknowledged || false,
    p_safety_acknowledged: params.safetyAcknowledged || false,
  });

  if (error || !data) {
    throw new Error(`Database error in register_or_update_spectator_session: ${error?.message || 'No data returned'}`);
  }

  return {
    id: data.id,
    sessionTokenHash: data.session_token_hash,
    ipHash: data.ip_hash,
    convertedToPlayerId: data.converted_to_player_id,
    isMinor: data.is_minor,
    ageAcknowledgedAt: data.age_acknowledged_at,
    safetyAcknowledgedAt: data.safety_acknowledged_at,
    createdAt: data.created_at,
    lastSeenAt: data.last_seen_at,
  };
}

export async function convertSpectatorToPlayerDB(
  sessionTokenHash: string,
  playerId: string
): Promise<SpectatorSession | null> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.convertSpectatorToPlayer(sessionTokenHash, playerId);
  }

  if (!supabaseModule.supabaseAdmin) {
    throw new Error('Supabase Service Role client is required for spectator session conversion.');
  }

  // Ensure player row exists in database if p_player_id is a UUID
  try {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(playerId);
    if (isUuid) {
      const { data: existingPlayer } = await supabaseModule.supabaseAdmin
        .from('players')
        .select('id')
        .eq('id', playerId)
        .maybeSingle();

      if (!existingPlayer) {
        await supabaseModule.supabaseAdmin.from('players').upsert(
          {
            id: playerId,
            display_name: 'Walk-up Agent',
            role: 'player',
          },
          { onConflict: 'id' }
        );
      }
    }
  } catch {
    // Continue with conversion even if player row upsert is handled by triggers
  }

  const { data, error } = await supabaseModule.supabaseAdmin.rpc('convert_spectator_session_to_player', {
    p_session_token_hash: sessionTokenHash,
    p_player_id: playerId,
  });

  if (error || !data) {
    throw new Error(`Database error in convert_spectator_session_to_player: ${error?.message || 'No data returned'}`);
  }

  return {
    id: data.id,
    sessionTokenHash: data.session_token_hash,
    ipHash: data.ip_hash,
    convertedToPlayerId: data.converted_to_player_id,
    isMinor: data.is_minor,
    ageAcknowledgedAt: data.age_acknowledged_at,
    safetyAcknowledgedAt: data.safety_acknowledged_at,
    createdAt: data.created_at,
    lastSeenAt: data.last_seen_at,
  };
}

export async function getAudienceEventsDB(
  eventId: string,
  isAdmin: boolean = false
): Promise<PublicAudienceEvent[] | AudienceEvent[]> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.getAudienceEvents(eventId, isAdmin);
  }

  if (!supabaseModule.supabase) {
    throw new Error('Supabase client is not configured.');
  }

  if (isAdmin) {
    const { data, error } = await supabaseModule.supabase
      .from('audience_events')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching audience_events: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      title: row.title,
      description: row.description,
      eventType: row.event_type,
      status: row.status,
      isPaused: row.is_paused,
      pausedAt: row.paused_at,
      eligibilityMode: row.eligibility_mode,
      maxVotesPerSession: row.max_votes_per_session,
      targetType: row.target_type,
      targetId: row.target_id,
      targetName: row.target_name,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      winningOptionId: row.winning_option_id,
      isManuallyOverridden: row.is_manually_overridden,
      overrideReason: row.override_reason,
      resolvedBy: row.resolved_by,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // Public Spectator View
  const { data, error } = await supabaseModule.supabase
    .from('public_audience_events')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Database error fetching public_audience_events: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description,
    eventType: row.event_type,
    status: row.status,
    isPaused: row.is_paused,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    pausedAt: row.paused_at,
    eligibilityMode: row.eligibility_mode,
    maxVotesPerSession: row.max_votes_per_session,
    publicTargetDescription: row.public_target_description,
    publicWinningOptionId: row.public_winning_option_id,
    createdAt: row.created_at,
  }));
}

export async function getAudienceEventOptionsDB(
  audienceEventId: string,
  isAdmin: boolean = false
): Promise<PublicAudienceEventOption[] | AudienceEventOption[]> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.getAudienceEventOptions(audienceEventId, isAdmin);
  }

  if (!supabaseModule.supabase) {
    throw new Error('Supabase client is not configured.');
  }

  if (isAdmin) {
    const { data, error } = await supabaseModule.supabase
      .from('audience_event_options')
      .select('*')
      .eq('audience_event_id', audienceEventId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw new Error(`Database error fetching audience_event_options: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      audienceEventId: row.audience_event_id,
      optionLabel: row.option_label,
      optionDescription: row.option_description,
      effectPayload: row.effect_payload,
      voteCount: row.vote_count,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
    }));
  }

  // Public View (Masks effectPayload)
  const { data, error } = await supabaseModule.supabase
    .from('public_audience_event_options')
    .select('*')
    .eq('audience_event_id', audienceEventId)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new Error(`Database error fetching public_audience_event_options: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    audienceEventId: row.audience_event_id,
    optionLabel: row.option_label,
    optionDescription: row.option_description,
    voteCount: row.vote_count,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

export async function castSpectatorVoteDB(params: {
  audienceEventId: string;
  optionId: string;
  sessionTokenHash: string;
  ipHash: string;
  playerId?: string;
}): Promise<{ success: boolean; error?: string; code?: string; newVoteCount?: number }> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.castSpectatorVote(params);
  }

  if (!supabaseModule.supabaseAdmin) {
    return {
      success: false,
      error: 'Supabase Service Role configuration missing for spectator vote execution',
      code: 'SERVER_CONFIG_ERROR',
    };
  }

  const { data, error } = await supabaseModule.supabaseAdmin.rpc('cast_spectator_vote', {
    p_audience_event_id: params.audienceEventId,
    p_option_id: params.optionId,
    p_session_token_hash: params.sessionTokenHash,
    p_ip_hash: params.ipHash,
    p_player_id: params.playerId || null,
  });

  if (error) {
    return {
      success: false,
      error: `Database execution error: ${error.message}`,
      code: 'DATABASE_ERROR',
    };
  }

  if (data && data.success === false) {
    return {
      success: false,
      error: data.error,
      code: data.code,
    };
  }

  return {
    success: true,
    newVoteCount: data?.new_vote_count,
  };
}

export async function getPublicGameFeedDB(
  eventId: string,
  limit: number = 50
): Promise<PublicGameFeedItem[]> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.getPublicGameFeed(eventId, limit);
  }

  if (!supabaseModule.supabase) {
    throw new Error('Supabase client is not configured.');
  }

  const { data, error } = await supabaseModule.supabase
    .from('public_game_feed')
    .select('*')
    .eq('event_id', eventId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Database error fetching public_game_feed: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    feedType: row.feed_type,
    headline: localEngine.sanitizeTextContent(row.headline),
    body: localEngine.sanitizeTextContent(row.body),
    districtName: row.district_name,
    urgency: row.urgency,
    isHost: row.is_host,
    isRetracted: row.is_retracted,
    isMinorParticipant: row.is_minor_participant,
    isPublicFeedEligible: row.is_public_feed_eligible,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  }));
}

export async function getHostBroadcastsDB(
  eventId: string,
  isAdmin: boolean = false
): Promise<HostBroadcast[]> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.getHostBroadcasts(eventId, isAdmin);
  }

  if (!supabaseModule.supabase) {
    throw new Error('Supabase client is not configured.');
  }

  if (isAdmin) {
    const { data, error } = await supabaseModule.supabase
      .from('host_broadcasts')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Database error fetching host_broadcasts: ${error.message}`);
    }

    return (data || []).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      headline: row.headline,
      body: row.body,
      tone: row.tone,
      targetChannel: row.target_channel,
      priority: row.priority,
      isPublished: row.is_published,
      publishedAt: row.published_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  // Public Published View — double-sanitized text boundary
  const { data, error } = await supabaseModule.supabase
    .from('public_host_broadcasts')
    .select('*')
    .eq('event_id', eventId)
    .order('published_at', { ascending: false });

  if (error) {
    throw new Error(`Database error fetching public_host_broadcasts: ${error.message}`);
  }

  return (data || []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    headline: localEngine.sanitizeTextContent(row.headline),
    body: localEngine.sanitizeTextContent(row.body),
    tone: row.tone,
    targetChannel: row.target_channel,
    priority: row.priority,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  }));
}

export async function getSpectatorSystemSettingsDB(
  eventId: string
): Promise<SpectatorSystemSettings> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.getSpectatorSystemSettings(eventId);
  }

  if (!supabaseModule.supabase) {
    return {
      eventId,
      isSpectatorSystemDisabled: false,
      updatedAt: new Date().toISOString(),
    };
  }

  const { data, error } = await supabaseModule.supabase
    .from('spectator_system_settings')
    .select('*')
    .eq('event_id', eventId)
    .single();

  if (error || !data) {
    return {
      eventId,
      isSpectatorSystemDisabled: false,
      updatedAt: new Date().toISOString(),
    };
  }

  return {
    eventId: data.event_id,
    isSpectatorSystemDisabled: data.is_spectator_system_disabled,
    disabledReason: data.disabled_reason,
    disabledAt: data.disabled_at,
    updatedAt: data.updated_at,
  };
}

export async function createAudienceEventDB(params: {
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
}): Promise<{ event: AudienceEvent; options: AudienceEventOption[] }> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.createAudienceEvent(params);
  }

  if (!supabaseModule.supabaseAdmin) {
    throw new Error('Supabase Service Role client is required for creating audience events.');
  }

  // Check if an active audience event already exists for this game event
  const { data: activeEvents } = await supabaseModule.supabaseAdmin
    .from('audience_events')
    .select('id')
    .eq('event_id', params.eventId)
    .eq('status', 'voting_active');

  const hasActive = (activeEvents && activeEvents.length > 0);
  const initialStatus = hasActive ? 'draft' : 'voting_active';

  const now = new Date();
  const durationMs = (params.durationMinutes || 15) * 60 * 1000;
  const endsAtDate = new Date(now.getTime() + durationMs);

  const { data: eventRow, error: eventError } = await supabaseModule.supabaseAdmin
    .from('audience_events')
    .insert({
      event_id: params.eventId,
      title: params.title,
      description: params.description,
      event_type: params.eventType,
      status: initialStatus,
      is_paused: false,
      eligibility_mode: params.eligibilityMode || 'all_spectators',
      max_votes_per_session: 1,
      target_type: params.targetType,
      target_id: params.targetId,
      target_name: params.targetName,
      starts_at: now.toISOString(),
      ends_at: endsAtDate.toISOString(),
      created_by: params.createdBy || null,
    })
    .select('*')
    .single();

  if (eventError || !eventRow) {
    throw new Error(`Failed to create audience_event in database: ${eventError?.message}`);
  }

  const optionRowsToInsert = params.options.map((opt, idx) => ({
    audience_event_id: eventRow.id,
    option_label: opt.label,
    option_description: opt.description || null,
    effect_payload: opt.effectPayload || {},
    vote_count: 0,
    sort_order: idx + 1,
  }));

  const { data: optionRows, error: optionsError } = await supabaseModule.supabaseAdmin
    .from('audience_event_options')
    .insert(optionRowsToInsert)
    .select('*');

  if (optionsError || !optionRows) {
    throw new Error(`Failed to create audience_event_options in database: ${optionsError?.message}`);
  }

  const createdEvent: AudienceEvent = {
    id: eventRow.id,
    eventId: eventRow.event_id,
    title: eventRow.title,
    description: eventRow.description,
    eventType: eventRow.event_type,
    status: eventRow.status,
    isPaused: eventRow.is_paused,
    pausedAt: eventRow.paused_at,
    eligibilityMode: eventRow.eligibility_mode,
    maxVotesPerSession: eventRow.max_votes_per_session,
    targetType: eventRow.target_type,
    targetId: eventRow.target_id,
    targetName: eventRow.target_name,
    startsAt: eventRow.starts_at,
    endsAt: eventRow.ends_at,
    winningOptionId: eventRow.winning_option_id,
    isManuallyOverridden: eventRow.is_manually_overridden,
    overrideReason: eventRow.override_reason,
    resolvedBy: eventRow.resolved_by,
    createdBy: eventRow.created_by,
    createdAt: eventRow.created_at,
    updatedAt: eventRow.updated_at,
  };

  const createdOptions: AudienceEventOption[] = optionRows.map((r) => ({
    id: r.id,
    audienceEventId: r.audience_event_id,
    optionLabel: r.option_label,
    optionDescription: r.option_description,
    effectPayload: r.effect_payload,
    voteCount: r.vote_count,
    sortOrder: r.sort_order,
    createdAt: r.created_at,
  }));

  return { event: createdEvent, options: createdOptions };
}

export async function activateAudienceEventDB(
  audienceEventId: string,
  startsAt?: string,
  durationMinutes: number = 5,
  activatedBy: string = 'Game Director'
): Promise<{ success: boolean; event?: AudienceEvent; error?: string }> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.activateAudienceEvent(audienceEventId, startsAt, durationMinutes, activatedBy);
  }

  if (!supabaseModule.supabaseAdmin) {
    return { success: false, error: 'Supabase Service Role configuration missing for activating audience event.' };
  }

  const now = startsAt ? new Date(startsAt) : new Date();
  const ends = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const { data, error } = await supabaseModule.supabaseAdmin
    .from('audience_events')
    .update({
      status: 'voting_active',
      starts_at: now.toISOString(),
      ends_at: ends.toISOString(),
      is_paused: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', audienceEventId)
    .select('*')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to activate audience event' };
  }

  // Create broadcast
  await createHostBroadcastDB({
    eventId: data.event_id,
    headline: `🗳️ LIVE AUDIENCE VOTE OPENED: ${data.title}`,
    body: data.description || 'Watchers: cast your votes now on the public airwaves to decide the next city modifier!',
    tone: 'flash',
    targetChannel: 'all',
    priority: 'high',
    isPublished: true,
  });

  return {
    success: true,
    event: {
      id: data.id,
      eventId: data.event_id,
      title: data.title,
      description: data.description,
      eventType: data.event_type,
      eligibilityMode: data.eligibility_mode,
      targetType: data.target_type,
      targetId: data.target_id,
      maxVotesPerSession: data.max_votes_per_session,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      status: data.status,
      isPaused: data.is_paused,
      winningOptionId: data.winning_option_id,
      isManuallyOverridden: data.is_manually_overridden,
      overrideReason: data.override_reason,
      resolvedBy: data.resolved_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function closeAudienceVotingDB(
  audienceEventId: string,
  closedBy: string = 'Game Director'
): Promise<{ success: boolean; event?: AudienceEvent; error?: string }> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.closeAudienceVoting(audienceEventId, closedBy);
  }

  if (!supabaseModule.supabaseAdmin) {
    return { success: false, error: 'Supabase Service Role configuration missing for closing audience voting.' };
  }

  const { data, error } = await supabaseModule.supabaseAdmin
    .from('audience_events')
    .update({
      status: 'tallying_closed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', audienceEventId)
    .select('*')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to close audience voting' };
  }

  return {
    success: true,
    event: {
      id: data.id,
      eventId: data.event_id,
      title: data.title,
      description: data.description,
      eventType: data.event_type,
      eligibilityMode: data.eligibility_mode,
      targetType: data.target_type,
      targetId: data.target_id,
      maxVotesPerSession: data.max_votes_per_session,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      status: data.status,
      isPaused: data.is_paused,
      winningOptionId: data.winning_option_id,
      isManuallyOverridden: data.is_manually_overridden,
      overrideReason: data.override_reason,
      resolvedBy: data.resolved_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function cancelAudienceEventDB(
  audienceEventId: string,
  cancellationReason: string,
  cancelledBy: string = 'Game Director'
): Promise<{ success: boolean; event?: AudienceEvent; error?: string }> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.cancelAudienceEvent(audienceEventId, cancellationReason, cancelledBy);
  }

  if (!supabaseModule.supabaseAdmin) {
    return { success: false, error: 'Supabase Service Role configuration missing for cancelling audience event.' };
  }

  const { data, error } = await supabaseModule.supabaseAdmin
    .from('audience_events')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', audienceEventId)
    .select('*')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to cancel audience event' };
  }

  await createHostBroadcastDB({
    eventId: data.event_id,
    headline: `⛔ AUDIENCE DECISION CANCELLED`,
    body: `The active decision "${data.title}" has been cancelled by the Game Master. Reason: ${cancellationReason}`,
    tone: 'urgent',
    targetChannel: 'all',
    priority: 'high',
    isPublished: true,
  });

  return {
    success: true,
    event: {
      id: data.id,
      eventId: data.event_id,
      title: data.title,
      description: data.description,
      eventType: data.event_type,
      eligibilityMode: data.eligibility_mode,
      targetType: data.target_type,
      targetId: data.target_id,
      maxVotesPerSession: data.max_votes_per_session,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
      status: data.status,
      isPaused: data.is_paused,
      winningOptionId: data.winning_option_id,
      isManuallyOverridden: data.is_manually_overridden,
      overrideReason: data.override_reason,
      resolvedBy: data.resolved_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  };
}

export async function getLiveEventTimelineDB(
  eventId: string,
  limit: number = 50,
  includeRehearsal: boolean = true
): Promise<import('./types').LiveEventTimelineEntry[]> {
  return localEngine.getLiveEventTimeline(eventId, limit, includeRehearsal);
}

export async function runAudienceVoteSimulationDB(
  eventId: string,
  params?: {
    title?: string;
    optionsCount?: number;
    votesCount?: number;
    preferredOptionIndex?: number;
  }
): Promise<import('./types').AudienceVoteSimulationResult> {
  return localEngine.runAudienceVoteSimulation(eventId, params);
}

export async function resolveAudienceEventDB(
  audienceEventId: string,
  overrideOptionId?: string,
  overrideReason?: string,
  resolvedBy?: string
): Promise<{ success: boolean; winningOption?: AudienceEventOption; effect?: AudienceEffect; error?: string }> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.resolveAudienceEvent(audienceEventId, overrideOptionId, overrideReason, resolvedBy);
  }

  if (!supabaseModule.supabaseAdmin) {
    return { success: false, error: 'Supabase Service Role configuration missing for resolving audience event.' };
  }

  // Fetch event and options
  const { data: eventRow, error: evtErr } = await supabaseModule.supabaseAdmin
    .from('audience_events')
    .select('*')
    .eq('id', audienceEventId)
    .single();

  if (evtErr || !eventRow) {
    return { success: false, error: `Event not found in DB: ${evtErr?.message}` };
  }

  // Idempotency: If already resolved, return existing winner
  if (eventRow.status === 'resolved') {
    const { data: opt } = await supabaseModule.supabaseAdmin
      .from('audience_event_options')
      .select('*')
      .eq('id', eventRow.winning_option_id)
      .maybeSingle();

    const { data: eff } = await supabaseModule.supabaseAdmin
      .from('audience_effects')
      .select('*')
      .eq('audience_event_id', audienceEventId)
      .maybeSingle();

    return {
      success: true,
      winningOption: opt
        ? {
            id: opt.id,
            audienceEventId: opt.audience_event_id,
            optionLabel: opt.option_label,
            optionDescription: opt.option_description,
            effectPayload: opt.effect_payload,
            voteCount: opt.vote_count,
            sortOrder: opt.sort_order,
            createdAt: opt.created_at,
          }
        : undefined,
      effect: eff
        ? {
            id: eff.id,
            audienceEventId: eff.audience_event_id,
            effectType: eff.effect_type,
            payload: eff.payload,
            status: eff.status,
            appliedAt: eff.applied_at,
            resolvedAt: eff.resolved_at,
            createdAt: eff.created_at,
          }
        : undefined,
    };
  }

  const { data: optionRows, error: optErr } = await supabaseModule.supabaseAdmin
    .from('audience_event_options')
    .select('*')
    .eq('audience_event_id', audienceEventId);

  if (optErr || !optionRows || optionRows.length === 0) {
    return { success: false, error: 'No options found for audience event.' };
  }

  let winnerRow: any;
  let isOverridden = false;

  if (overrideOptionId) {
    winnerRow = optionRows.find((o) => o.id === overrideOptionId);
    if (!winnerRow) {
      return { success: false, error: 'Specified override option ID does not exist for this event.' };
    }
    isOverridden = true;
  } else {
    winnerRow = [...optionRows].sort((a, b) => b.vote_count - a.vote_count || a.sort_order - b.sort_order)[0];
  }

  const now = new Date().toISOString();

  // Update audience_events
  const { error: updateErr } = await supabaseModule.supabaseAdmin
    .from('audience_events')
    .update({
      winning_option_id: winnerRow.id,
      status: 'resolved',
      is_manually_overridden: isOverridden,
      override_reason: isOverridden ? overrideReason || 'Game Director Manual Override' : null,
      resolved_by: resolvedBy || null,
      updated_at: now,
    })
    .eq('id', audienceEventId);

  if (updateErr) {
    return { success: false, error: `Failed to update audience_events status: ${updateErr.message}` };
  }

  // Insert audience_effects with full audit & lifecycle context
  const { data: effectRow, error: effectErr } = await supabaseModule.supabaseAdmin
    .from('audience_effects')
    .insert({
      audience_event_id: audienceEventId,
      effect_type: eventRow.event_type,
      payload: winnerRow.effect_payload || {},
      status: isOverridden ? 'overridden' : 'applied',
      applied_at: now,
      resolved_at: now,
      override_context: isOverridden ? overrideReason || 'Game Director Manual Override' : null,
      resolved_by: resolvedBy || null,
    })
    .select('*')
    .single();

  if (effectErr || !effectRow) {
    return { success: false, error: `Failed to record audience_effect: ${effectErr?.message}` };
  }

  // Create Automated Broadcast
  const broadcastHeadline = isOverridden
    ? `⚡ GAME MASTER OVERRIDE: ${winnerRow.option_label}`
    : `🏆 THE AUDIENCE HAS SPOKEN: ${winnerRow.option_label}`;

  const broadcastBody = isOverridden
    ? `The Game Master has resolved the decision: "${winnerRow.option_label}". Reason: ${overrideReason || 'Game Master Decision'}`
    : `The watchers have chosen "${winnerRow.option_label}" with ${winnerRow.vote_count} community votes! Active gameplay modifiers are now in effect.`;

  await createHostBroadcastDB({
    eventId: eventRow.event_id,
    headline: broadcastHeadline,
    body: broadcastBody,
    tone: isOverridden ? 'urgent' : 'theatrical',
    targetChannel: 'all',
    priority: 'high',
    isPublished: true,
  });

  const winningOption: AudienceEventOption = {
    id: winnerRow.id,
    audienceEventId: winnerRow.audience_event_id,
    optionLabel: winnerRow.option_label,
    optionDescription: winnerRow.option_description,
    effectPayload: winnerRow.effect_payload,
    voteCount: winnerRow.vote_count,
    sortOrder: winnerRow.sort_order,
    createdAt: winnerRow.created_at,
  };

  const effect: AudienceEffect = {
    id: effectRow.id,
    audienceEventId: effectRow.audience_event_id,
    effectType: effectRow.effect_type,
    payload: effectRow.payload,
    status: effectRow.status,
    appliedAt: effectRow.applied_at,
    resolvedAt: effectRow.resolved_at,
    cancellationReason: effectRow.cancellation_reason,
    overrideContext: effectRow.override_context,
    createdBy: effectRow.created_by,
    appliedBy: effectRow.applied_by,
    resolvedBy: effectRow.resolved_by,
    createdAt: effectRow.created_at,
  };

  return { success: true, winningOption, effect };
}

export async function createHostBroadcastDB(params: {
  eventId: string;
  headline: string;
  body: string;
  tone?: 'theatrical' | 'urgent' | 'announcement' | 'flash';
  targetChannel?: 'all' | 'spectators' | 'players' | 'internal';
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  isPublished?: boolean;
}): Promise<HostBroadcast> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.createHostBroadcast(params);
  }

  if (!supabaseModule.supabaseAdmin) {
    throw new Error('Supabase Service Role client is required for creating host broadcasts.');
  }

  const now = new Date().toISOString();
  const isPublished = params.isPublished !== undefined ? params.isPublished : true;
  const targetChannel = params.targetChannel || 'all';

  const cleanHeadline = localEngine.sanitizeTextContent(params.headline);
  const cleanBody = localEngine.sanitizeTextContent(params.body);

  const { data: broadcastRow, error: bErr } = await supabaseModule.supabaseAdmin
    .from('host_broadcasts')
    .insert({
      event_id: params.eventId,
      headline: cleanHeadline,
      body: cleanBody,
      tone: params.tone || 'theatrical',
      target_channel: targetChannel,
      priority: params.priority || 'normal',
      is_published: isPublished,
      published_at: now,
    })
    .select('*')
    .single();

  if (bErr || !broadcastRow) {
    throw new Error(`Failed to create host_broadcast in database: ${bErr?.message}`);
  }

  // If published to public spectators, also insert into public_game_feed
  if (isPublished && ['all', 'spectators'].includes(targetChannel)) {
    await supabaseModule.supabaseAdmin.from('public_game_feed').insert({
      event_id: params.eventId,
      feed_type: 'host_broadcast',
      headline: `📢 HOST BROADCAST: ${cleanHeadline}`,
      body: cleanBody,
      urgency: params.tone === 'urgent' ? 'urgent' : 'warning',
      is_host: true,
      is_retracted: false,
      is_minor_participant: false,
      is_public_feed_eligible: true,
      published_at: now,
    });
  }

  return {
    id: broadcastRow.id,
    eventId: broadcastRow.event_id,
    headline: broadcastRow.headline,
    body: broadcastRow.body,
    tone: broadcastRow.tone,
    targetChannel: broadcastRow.target_channel,
    priority: broadcastRow.priority,
    isPublished: broadcastRow.is_published,
    publishedAt: broadcastRow.published_at,
    createdAt: broadcastRow.created_at,
    updatedAt: broadcastRow.updated_at,
  };
}

export async function toggleSpectatorSystemFreezeDB(
  eventId: string,
  isDisabled: boolean,
  reason?: string
): Promise<SpectatorSystemSettings> {
  if (!supabaseModule.isSupabaseConfigured) {
    return localEngine.toggleSpectatorSystemFreeze(eventId, isDisabled, reason);
  }

  if (!supabaseModule.supabaseAdmin) {
    throw new Error('Supabase Service Role client is required for setting spectator freeze settings.');
  }

  const now = new Date().toISOString();

  const { data: settingsRow, error } = await supabaseModule.supabaseAdmin
    .from('spectator_system_settings')
    .upsert({
      event_id: eventId,
      is_spectator_system_disabled: isDisabled,
      disabled_reason: isDisabled ? reason || 'Emergency Game Master Freeze' : null,
      disabled_at: isDisabled ? now : null,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error || !settingsRow) {
    throw new Error(`Failed to update spectator_system_settings in database: ${error?.message}`);
  }

  return {
    eventId: settingsRow.event_id,
    isSpectatorSystemDisabled: settingsRow.is_spectator_system_disabled,
    disabledReason: settingsRow.disabled_reason,
    disabledAt: settingsRow.disabled_at,
    updatedAt: settingsRow.updated_at,
  };
}

export async function getSpectatorSessionCountDB(eventId: string): Promise<number> {
  if (!supabaseModule.isSupabaseConfigured || !supabaseModule.supabaseAdmin) {
    return localEngine.getSpectatorSessionCount(eventId);
  }
  try {
    const { count, error } = await supabaseModule.supabaseAdmin
      .from('spectator_sessions')
      .select('*', { count: 'exact', head: true });
    if (error || count === null) return localEngine.getSpectatorSessionCount(eventId);
    return count;
  } catch {
    return localEngine.getSpectatorSessionCount(eventId);
  }
}

export async function getDistrictActivityDB(eventId: string): Promise<localEngine.DistrictActivity[]> {
  if (!supabaseModule.isSupabaseConfigured || !supabaseModule.supabaseAdmin) {
    return localEngine.getDistrictActivity(eventId);
  }

  try {
    const isInputUUID = UUID_RE.test(eventId);
    let eventSlug: string | undefined;
    let resolvedEventId = eventId;

    if (isInputUUID) {
      const { data: ev } = await supabaseModule.supabaseAdmin
        .from('events')
        .select('id, slug')
        .eq('id', eventId)
        .maybeSingle();
      eventSlug = ev?.slug;
    } else {
      eventSlug = eventId;
      const { data: ev } = await supabaseModule.supabaseAdmin
        .from('events')
        .select('id, slug')
        .eq('slug', eventId)
        .maybeSingle();
      if (ev?.id) resolvedEventId = ev.id;
    }

    // 1. Fair QR Hunt Operation
    if (isFairOperation(eventSlug || eventId)) {
      return localEngine.getDistrictActivity(eventId);
    }

    // 2. Future / Unrelated Operation: do not inherit Founder's Cipher
    if (!isFounderCipherOperation(eventSlug || eventId)) {
      return [];
    }

    // 3. Founder's Cipher: Query real authoritative event_players, quests, and public_game_feed
    const [epRes, questRes, feedRes] = await Promise.all([
      supabaseModule.supabaseAdmin
        .from('event_players')
        .select('path, player_id, players(selected_starting_path)')
        .eq('event_id', resolvedEventId),
      supabaseModule.supabaseAdmin
        .from('quests')
        .select('id, starting_path, status')
        .eq('event_id', resolvedEventId)
        .eq('status', 'active'),
      supabaseModule.supabaseAdmin
        .from('public_game_feed')
        .select('headline, body, district_name')
        .eq('event_id', resolvedEventId)
        .eq('is_public_feed_eligible', true)
        .order('published_at', { ascending: false })
        .limit(50),
    ]);

    const playerCounts: Record<'family' | 'challenge' | 'secret', number> = {
      family: 0,
      challenge: 0,
      secret: 0,
    };
    for (const row of epRes.data || []) {
      const rawPath = (row.path || (row.players as any)?.selected_starting_path || '').toLowerCase();
      if (rawPath === 'family') playerCounts.family++;
      else if (rawPath === 'challenge') playerCounts.challenge++;
      else if (rawPath === 'secret') playerCounts.secret++;
    }

    const questCounts: Record<'family' | 'challenge' | 'secret', number> = {
      family: 0,
      challenge: 0,
      secret: 0,
    };
    for (const q of questRes.data || []) {
      const rawPath = (q.starting_path || '').toLowerCase();
      if (rawPath === 'family') questCounts.family++;
      else if (rawPath === 'challenge') questCounts.challenge++;
      else if (rawPath === 'secret') questCounts.secret++;
    }

    const feedItems = feedRes.data || [];

    return FOUNDER_CIPHER_CANONICAL_DISTRICTS.map((cfg) => {
      const matchingFeed = feedItems.filter((item) => {
        if (item.district_name && item.district_name.toLowerCase().includes(cfg.path)) return true;
        const text = `${item.headline || ''} ${item.body || ''}`.toLowerCase();
        // West Lawn is post-master-cipher finale destination, never count it toward Secret district
        if (cfg.path === 'secret' && (text.includes('west lawn') || text.includes('frankenstein'))) {
          return false;
        }
        return cfg.keywords.some((kw) => text.includes(kw));
      });

      const uniqueFeedActors = new Set(matchingFeed.map((i) => (i.headline || '').split(' ')[0])).size;
      const agentCount = Math.max(playerCounts[cfg.path], uniqueFeedActors);
      const activeQuestsCount = questCounts[cfg.path] + matchingFeed.length;

      let activityLevel: localEngine.DistrictActivity['activityLevel'] = 'NO ACTIVITY';
      if (agentCount >= 5 || matchingFeed.length >= 5) activityLevel = 'HIGH';
      else if (agentCount >= 2 || matchingFeed.length >= 2) activityLevel = 'MODERATE';
      else if (agentCount >= 1 || matchingFeed.length >= 1) activityLevel = 'QUIET';

      return {
        id: cfg.id,
        name: cfg.name,
        landmark: cfg.landmark,
        activityLevel,
        agentCount,
        activeQuestsCount,
        path: cfg.path,
      };
    });
  } catch (error) {
    console.error('[spectator-db] getDistrictActivityDB error, falling back to localEngine:', error);
    return localEngine.getDistrictActivity(eventId);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves the real event id for spectator/live-admin reads and writes.
 * Callers used to fall back to the placeholder literal string
 * "default-event" when no eventId was supplied, which Postgres rejects with
 * `invalid input syntax for type uuid` the moment a Supabase-backed query
 * does `.eq('event_id', eventId)` against a UUID column (public_game_feed,
 * audience_events, host_broadcasts, ...) — causing spectator/admin-live GET
 * requests to 500 instead of loading.
 *
 * A caller-supplied id that already looks like a real UUID is trusted as-is.
 *
 * When `requestedEventSlug` is supplied (e.g. /watch?eventSlug=fair-qr-hunt),
 * it is the single authoritative Operation-scoping signal — every spectator
 * feed action shares this one resolution, so passing it once here correctly
 * scopes all of them. An unknown slug resolves to null (an honest "no such
 * Operation" empty state) and never silently falls back to another
 * Operation's data.
 *
 * With no id and no slug at all, this falls back to the stable Volume 1
 * event — the documented default for spectator/live-admin surfaces that
 * don't carry Operation context (e.g. the bare admin live-control panel).
 * Returns null (not a fabricated id) when no event can be resolved, so
 * callers can return an honest empty state.
 */
export async function resolveSpectatorEventId(
  requestedEventId?: string | null,
  requestedEventSlug?: string | null
): Promise<string | null> {
  if (requestedEventId && UUID_RE.test(requestedEventId)) return requestedEventId;

  const { getEventBySlugDB } = await import('./supabase-db');

  if (requestedEventSlug) {
    const event = await getEventBySlugDB(requestedEventSlug);
    return event?.id || null;
  }

  const { SEED_EVENT } = await import('./seed-data');
  const event = await getEventBySlugDB(SEED_EVENT.slug);
  return event?.id || null;
}
