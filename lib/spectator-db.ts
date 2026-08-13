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

export async function getSpectatorSessionCountDB(eventId: string = 'default-event'): Promise<number> {
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

export async function getDistrictActivityDB(eventId: string = 'default-event'): Promise<localEngine.DistrictActivity[]> {
  return localEngine.getDistrictActivity(eventId);
}
