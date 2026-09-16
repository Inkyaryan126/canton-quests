-- THE GRID — multiplayer chat foundation.
-- Server-authoritative channel membership, messages, blocking, reporting, and rate limits.

create table public.grid_chat_channels (
  id uuid primary key default gen_random_uuid(),
  city_id uuid not null references public.grid_cities(id) on delete cascade,
  season_id uuid not null references public.grid_seasons(id) on delete cascade,
  channel_type text not null check (channel_type in ('city', 'district', 'party', 'direct', 'system')),
  scope_key text not null check (length(scope_key) between 1 and 300),
  display_name text check (display_name is null or length(display_name) between 1 and 100),
  created_by_player_id uuid references public.players(id) on delete set null,
  is_locked boolean not null default false,
  is_archived boolean not null default false,
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season_id, channel_type, scope_key)
);

create table public.grid_chat_members (
  channel_id uuid not null references public.grid_chat_channels(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'moderator', 'owner')),
  notifications_enabled boolean not null default true,
  muted_until timestamptz,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (channel_id, player_id)
);

create table public.grid_chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.grid_chat_channels(id) on delete cascade,
  sender_player_id uuid not null references public.players(id) on delete cascade,
  sender_is_minor boolean not null default false,
  client_nonce text not null check (length(client_nonce) between 1 and 100),
  body text not null check (length(body) between 1 and 1200),
  reply_to_message_id uuid references public.grid_chat_messages(id) on delete set null,
  status text not null default 'visible' check (status in ('visible', 'hidden', 'removed')),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  removed_at timestamptz,
  unique (channel_id, sender_player_id, client_nonce)
);

create table public.grid_chat_blocks (
  blocker_player_id uuid not null references public.players(id) on delete cascade,
  blocked_player_id uuid not null references public.players(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_player_id, blocked_player_id),
  check (blocker_player_id <> blocked_player_id)
);

create table public.grid_chat_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.grid_chat_messages(id) on delete cascade,
  reporter_player_id uuid not null references public.players(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'spam', 'safety', 'cheating', 'inappropriate', 'other')),
  details text check (details is null or length(details) <= 500),
  status text not null default 'pending' check (status in ('pending', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_player_id uuid references public.players(id) on delete set null,
  reviewed_by_label text check (reviewed_by_label is null or length(reviewed_by_label) <= 100),
  unique (message_id, reporter_player_id)
);

create index grid_chat_channels_season_last_message_idx
  on public.grid_chat_channels (season_id, last_message_at desc nulls last, created_at desc);
create index grid_chat_members_player_active_idx
  on public.grid_chat_members (player_id, joined_at desc)
  where left_at is null;
create index grid_chat_messages_channel_created_idx
  on public.grid_chat_messages (channel_id, created_at desc, id desc);
create index grid_chat_messages_sender_created_idx
  on public.grid_chat_messages (sender_player_id, created_at desc);
create index grid_chat_blocks_blocked_idx
  on public.grid_chat_blocks (blocked_player_id, blocker_player_id);
create index grid_chat_reports_status_created_idx
  on public.grid_chat_reports (status, created_at asc);

alter table public.grid_chat_channels enable row level security;
alter table public.grid_chat_members enable row level security;
alter table public.grid_chat_messages enable row level security;
alter table public.grid_chat_blocks enable row level security;
alter table public.grid_chat_reports enable row level security;

revoke all on public.grid_chat_channels from anon, authenticated;
revoke all on public.grid_chat_members from anon, authenticated;
revoke all on public.grid_chat_messages from anon, authenticated;
revoke all on public.grid_chat_blocks from anon, authenticated;
revoke all on public.grid_chat_reports from anon, authenticated;

grant select, insert, update, delete on public.grid_chat_channels to service_role;
grant select, insert, update, delete on public.grid_chat_members to service_role;
grant select, insert, update, delete on public.grid_chat_messages to service_role;
grant select, insert, update, delete on public.grid_chat_blocks to service_role;
grant select, insert, update, delete on public.grid_chat_reports to service_role;

create or replace function public.grid_ensure_city_chat_channel(
  p_season_id uuid,
  p_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_city_id uuid;
  v_channel_id uuid;
begin
  select s.city_id into v_city_id
    from public.grid_seasons s
   where s.id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = p_season_id
       and state.player_id = p_player_id
  ) then
    raise exception 'PLAYER_NOT_IN_SEASON';
  end if;

  insert into public.grid_chat_channels (
    city_id, season_id, channel_type, scope_key, display_name, created_at, updated_at
  ) values (
    v_city_id, p_season_id, 'city', 'city', 'CITY // OPEN CHANNEL', p_now, p_now
  )
  on conflict (season_id, channel_type, scope_key) do update
    set updated_at = public.grid_chat_channels.updated_at
  returning id into v_channel_id;

  insert into public.grid_chat_members (channel_id, player_id, joined_at, left_at)
  values (v_channel_id, p_player_id, p_now, null)
  on conflict (channel_id, player_id) do update
    set left_at = null;

  return jsonb_build_object('channelId', v_channel_id, 'channelType', 'city');
end;
$$;

create or replace function public.grid_create_direct_chat_channel(
  p_season_id uuid,
  p_player_id uuid,
  p_target_player_id uuid,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_city_id uuid;
  v_scope_key text;
  v_channel_id uuid;
  v_player_minor boolean;
  v_target_minor boolean;
begin
  if p_player_id = p_target_player_id then raise exception 'DIRECT_CHAT_SELF'; end if;

  select s.city_id into v_city_id from public.grid_seasons s where s.id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;

  if not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = p_season_id and state.player_id = p_player_id
  ) or not exists (
    select 1 from public.grid_player_season_state state
     where state.season_id = p_season_id and state.player_id = p_target_player_id
  ) then
    raise exception 'PLAYER_NOT_IN_SEASON';
  end if;

  select coalesce(is_minor, false) into v_player_minor from public.players where id = p_player_id;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;
  select coalesce(is_minor, false) into v_target_minor from public.players where id = p_target_player_id;
  if not found then raise exception 'TARGET_PLAYER_NOT_FOUND'; end if;
  if v_player_minor or v_target_minor then raise exception 'DIRECT_CHAT_MINOR_RESTRICTED'; end if;

  if exists (
    select 1 from public.grid_chat_blocks b
     where (b.blocker_player_id = p_player_id and b.blocked_player_id = p_target_player_id)
        or (b.blocker_player_id = p_target_player_id and b.blocked_player_id = p_player_id)
  ) then
    raise exception 'CHAT_BLOCKED';
  end if;

  v_scope_key := case
    when p_player_id::text < p_target_player_id::text
      then 'direct:' || p_player_id::text || ':' || p_target_player_id::text
    else 'direct:' || p_target_player_id::text || ':' || p_player_id::text
  end;

  insert into public.grid_chat_channels (
    city_id, season_id, channel_type, scope_key, created_by_player_id, created_at, updated_at
  ) values (
    v_city_id, p_season_id, 'direct', v_scope_key, p_player_id, p_now, p_now
  )
  on conflict (season_id, channel_type, scope_key) do update
    set updated_at = public.grid_chat_channels.updated_at
  returning id into v_channel_id;

  insert into public.grid_chat_members (channel_id, player_id, joined_at, left_at)
  values
    (v_channel_id, p_player_id, p_now, null),
    (v_channel_id, p_target_player_id, p_now, null)
  on conflict (channel_id, player_id) do update
    set left_at = null;

  return jsonb_build_object('channelId', v_channel_id, 'channelType', 'direct');
end;
$$;

create or replace function public.grid_send_chat_message(
  p_channel_id uuid,
  p_sender_player_id uuid,
  p_body text,
  p_client_nonce text,
  p_reply_to_message_id uuid default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_channel public.grid_chat_channels%rowtype;
  v_existing public.grid_chat_messages%rowtype;
  v_message public.grid_chat_messages%rowtype;
  v_body text;
  v_sender_minor boolean;
  v_count_10 integer;
  v_count_60 integer;
begin
  v_body := btrim(replace(replace(p_body, E'\r\n', E'\n'), E'\r', E'\n'));
  if v_body is null or length(v_body) = 0 then raise exception 'CHAT_MESSAGE_EMPTY'; end if;
  if length(v_body) > 1200 then raise exception 'CHAT_MESSAGE_TOO_LONG'; end if;
  if p_client_nonce is null or length(btrim(p_client_nonce)) = 0 then raise exception 'CHAT_NONCE_REQUIRED'; end if;
  if length(p_client_nonce) > 100 then raise exception 'CHAT_NONCE_TOO_LONG'; end if;

  select * into v_existing
    from public.grid_chat_messages m
   where m.channel_id = p_channel_id
     and m.sender_player_id = p_sender_player_id
     and m.client_nonce = p_client_nonce;
  if found then
    if v_existing.body <> v_body or v_existing.reply_to_message_id is distinct from p_reply_to_message_id then
      raise exception 'CHAT_NONCE_COLLISION';
    end if;
    return jsonb_build_object('messageId', v_existing.id, 'duplicate', true, 'createdAt', v_existing.created_at);
  end if;

  select * into v_channel from public.grid_chat_channels c where c.id = p_channel_id for update;
  if not found then raise exception 'CHAT_CHANNEL_NOT_FOUND'; end if;
  if v_channel.is_archived then raise exception 'CHAT_CHANNEL_ARCHIVED'; end if;
  if v_channel.is_locked then raise exception 'CHAT_CHANNEL_LOCKED'; end if;

  if not exists (
    select 1 from public.grid_chat_members m
     where m.channel_id = p_channel_id
       and m.player_id = p_sender_player_id
       and m.left_at is null
       and (m.muted_until is null or m.muted_until <= p_now)
  ) then
    raise exception 'CHAT_MEMBERSHIP_REQUIRED';
  end if;

  if v_channel.channel_type = 'direct' and exists (
    select 1
      from public.grid_chat_members member
      join public.players participant on participant.id = member.player_id
     where member.channel_id = p_channel_id
       and member.left_at is null
       and coalesce(participant.is_minor, false)
  ) then
    raise exception 'DIRECT_CHAT_MINOR_RESTRICTED';
  end if;

  if v_channel.channel_type = 'direct' and exists (
    select 1
      from public.grid_chat_members mine
      join public.grid_chat_members other
        on other.channel_id = mine.channel_id
       and other.player_id <> mine.player_id
       and other.left_at is null
      join public.grid_chat_blocks b
        on (b.blocker_player_id = mine.player_id and b.blocked_player_id = other.player_id)
        or (b.blocker_player_id = other.player_id and b.blocked_player_id = mine.player_id)
     where mine.channel_id = p_channel_id
       and mine.player_id = p_sender_player_id
       and mine.left_at is null
  ) then
    raise exception 'CHAT_BLOCKED';
  end if;

  if p_reply_to_message_id is not null and not exists (
    select 1 from public.grid_chat_messages reply
     where reply.id = p_reply_to_message_id
       and reply.channel_id = p_channel_id
       and reply.status = 'visible'
  ) then
    raise exception 'CHAT_REPLY_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_sender_player_id::text, 0));

  select count(*) into v_count_10
    from public.grid_chat_messages m
   where m.sender_player_id = p_sender_player_id
     and m.created_at > p_now - interval '10 seconds';
  select count(*) into v_count_60
    from public.grid_chat_messages m
   where m.sender_player_id = p_sender_player_id
     and m.created_at > p_now - interval '60 seconds';
  if v_count_10 >= 6 or v_count_60 >= 30 then raise exception 'CHAT_RATE_LIMITED'; end if;

  select coalesce(p.is_minor, false) into v_sender_minor
    from public.players p where p.id = p_sender_player_id;
  if not found then raise exception 'PLAYER_NOT_FOUND'; end if;

  insert into public.grid_chat_messages (
    channel_id, sender_player_id, sender_is_minor, client_nonce, body,
    reply_to_message_id, created_at
  ) values (
    p_channel_id, p_sender_player_id, v_sender_minor, p_client_nonce, v_body,
    p_reply_to_message_id, p_now
  ) returning * into v_message;

  update public.grid_chat_channels
     set last_message_at = p_now,
         updated_at = p_now
   where id = p_channel_id;

  return jsonb_build_object('messageId', v_message.id, 'duplicate', false, 'createdAt', v_message.created_at);
end;
$$;

create or replace function public.grid_mark_chat_read(
  p_channel_id uuid,
  p_player_id uuid,
  p_read_at timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.grid_chat_members
     set last_read_at = greatest(coalesce(last_read_at, '-infinity'::timestamptz), p_read_at)
   where channel_id = p_channel_id
     and player_id = p_player_id
     and left_at is null;
  if not found then raise exception 'CHAT_MEMBERSHIP_REQUIRED'; end if;
  return jsonb_build_object('channelId', p_channel_id, 'readAt', p_read_at);
end;
$$;

create or replace function public.grid_set_chat_block(
  p_player_id uuid,
  p_blocked_player_id uuid,
  p_blocked boolean,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_player_id = p_blocked_player_id then raise exception 'CHAT_BLOCK_SELF'; end if;
  if not exists (select 1 from public.players p where p.id = p_player_id) then raise exception 'PLAYER_NOT_FOUND'; end if;
  if not exists (select 1 from public.players p where p.id = p_blocked_player_id) then raise exception 'TARGET_PLAYER_NOT_FOUND'; end if;

  if p_blocked then
    insert into public.grid_chat_blocks (blocker_player_id, blocked_player_id, created_at)
    values (p_player_id, p_blocked_player_id, p_now)
    on conflict (blocker_player_id, blocked_player_id) do nothing;
  else
    delete from public.grid_chat_blocks
     where blocker_player_id = p_player_id
       and blocked_player_id = p_blocked_player_id;
  end if;

  return jsonb_build_object('blockedPlayerId', p_blocked_player_id, 'blocked', p_blocked);
end;
$$;

create or replace function public.grid_report_chat_message(
  p_message_id uuid,
  p_reporter_player_id uuid,
  p_reason text,
  p_details text default null,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message public.grid_chat_messages%rowtype;
  v_report_id uuid;
begin
  if p_reason not in ('harassment', 'spam', 'safety', 'cheating', 'inappropriate', 'other') then
    raise exception 'CHAT_REPORT_REASON_INVALID';
  end if;
  if p_details is not null and length(btrim(p_details)) > 500 then raise exception 'CHAT_REPORT_DETAILS_TOO_LONG'; end if;

  select * into v_message from public.grid_chat_messages where id = p_message_id;
  if not found then raise exception 'CHAT_MESSAGE_NOT_FOUND'; end if;
  if v_message.sender_player_id = p_reporter_player_id then raise exception 'CHAT_REPORT_SELF'; end if;
  if not exists (
    select 1 from public.grid_chat_members m
     where m.channel_id = v_message.channel_id
       and m.player_id = p_reporter_player_id
       and m.left_at is null
  ) then
    raise exception 'CHAT_MEMBERSHIP_REQUIRED';
  end if;

  insert into public.grid_chat_reports (
    message_id, reporter_player_id, reason, details, created_at
  ) values (
    p_message_id, p_reporter_player_id, p_reason, nullif(btrim(p_details), ''), p_now
  )
  on conflict (message_id, reporter_player_id) do update
    set reason = excluded.reason,
        details = excluded.details,
        status = 'pending',
        reviewed_at = null,
        reviewed_by_player_id = null
  returning id into v_report_id;

  return jsonb_build_object('reportId', v_report_id, 'status', 'pending');
end;
$$;

revoke all on function public.grid_ensure_city_chat_channel(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_ensure_city_chat_channel(uuid, uuid, timestamptz) to service_role;
revoke all on function public.grid_create_direct_chat_channel(uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_create_direct_chat_channel(uuid, uuid, uuid, timestamptz) to service_role;
revoke all on function public.grid_send_chat_message(uuid, uuid, text, text, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_send_chat_message(uuid, uuid, text, text, uuid, timestamptz) to service_role;
revoke all on function public.grid_mark_chat_read(uuid, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_mark_chat_read(uuid, uuid, timestamptz) to service_role;
revoke all on function public.grid_set_chat_block(uuid, uuid, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_set_chat_block(uuid, uuid, boolean, timestamptz) to service_role;
revoke all on function public.grid_report_chat_message(uuid, uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_report_chat_message(uuid, uuid, text, text, timestamptz) to service_role;

create or replace function public.grid_resolve_chat_callsign(p_callsign text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_player record;
begin
  if p_callsign is null or length(btrim(p_callsign)) < 2 then
    raise exception 'CHAT_CALLSIGN_INVALID';
  end if;

  select count(*) into v_count
    from public.players p
   where lower(p.display_name) = lower(btrim(p_callsign));

  if v_count = 0 then return null; end if;
  if v_count > 1 then raise exception 'CHAT_CALLSIGN_AMBIGUOUS'; end if;

  select p.id, p.display_name, p.avatar_url
    into v_player
    from public.players p
   where lower(p.display_name) = lower(btrim(p_callsign))
   limit 1;

  return jsonb_build_object(
    'playerId', v_player.id,
    'callsign', v_player.display_name,
    'avatarUrl', v_player.avatar_url
  );
end;
$$;

revoke all on function public.grid_resolve_chat_callsign(text) from public, anon, authenticated;
grant execute on function public.grid_resolve_chat_callsign(text) to service_role;

create or replace function public.grid_moderate_chat_report(
  p_report_id uuid,
  p_action text,
  p_reviewer_label text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_report public.grid_chat_reports%rowtype;
  v_message_status text;
begin
  if p_action not in ('hide', 'remove', 'restore', 'dismiss') then
    raise exception 'CHAT_MODERATION_ACTION_INVALID';
  end if;

  select * into v_report from public.grid_chat_reports where id = p_report_id for update;
  if not found then raise exception 'CHAT_REPORT_NOT_FOUND'; end if;

  if p_action = 'hide' then
    update public.grid_chat_messages set status = 'hidden' where id = v_report.message_id;
    v_message_status := 'hidden';
  elsif p_action = 'remove' then
    update public.grid_chat_messages set status = 'removed', removed_at = p_now where id = v_report.message_id;
    v_message_status := 'removed';
  elsif p_action = 'restore' then
    update public.grid_chat_messages set status = 'visible', removed_at = null where id = v_report.message_id;
    v_message_status := 'visible';
  else
    select status into v_message_status from public.grid_chat_messages where id = v_report.message_id;
  end if;

  update public.grid_chat_reports
     set status = case when p_action = 'dismiss' then 'dismissed' else 'resolved' end,
         reviewed_at = p_now,
         reviewed_by_label = nullif(btrim(p_reviewer_label), '')
   where message_id = v_report.message_id
     and status in ('pending', 'reviewing');

  return jsonb_build_object(
    'reportId', p_report_id,
    'messageId', v_report.message_id,
    'action', p_action,
    'messageStatus', v_message_status
  );
end;
$$;

revoke all on function public.grid_moderate_chat_report(uuid, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_moderate_chat_report(uuid, text, text, timestamptz) to service_role;
