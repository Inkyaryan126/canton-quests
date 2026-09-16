-- THE GRID — Comms 3B: authoritative system / Commander broadcasts.

alter table public.grid_chat_messages
  add column sender_kind text not null default 'player'
    check (sender_kind in ('player', 'system')),
  add column sender_label text;

alter table public.grid_chat_messages
  alter column sender_player_id drop not null;

alter table public.grid_chat_messages
  add constraint grid_chat_messages_sender_identity_chk
  check (
    (sender_kind = 'player' and sender_player_id is not null and sender_label is null)
    or
    (sender_kind = 'system' and sender_player_id is null and sender_label is not null and length(sender_label) between 1 and 80)
  );

create unique index grid_chat_messages_system_nonce_uq
  on public.grid_chat_messages (channel_id, client_nonce)
  where sender_kind = 'system';

create or replace function public.grid_broadcast_city_chat_message(
  p_season_id uuid,
  p_body text,
  p_client_nonce text,
  p_sender_label text default 'COMMANDER',
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
  v_existing public.grid_chat_messages%rowtype;
  v_message public.grid_chat_messages%rowtype;
  v_body text;
  v_label text := btrim(p_sender_label);
begin
  v_body := btrim(replace(replace(p_body, E'\r\n', E'\n'), E'\r', E'\n'));
  if v_body is null or length(v_body) = 0 then raise exception 'CHAT_MESSAGE_EMPTY'; end if;
  if length(v_body) > 1200 then raise exception 'CHAT_MESSAGE_TOO_LONG'; end if;
  if p_client_nonce is null or length(btrim(p_client_nonce)) = 0 then raise exception 'CHAT_NONCE_REQUIRED'; end if;
  if length(p_client_nonce) > 100 then raise exception 'CHAT_NONCE_TOO_LONG'; end if;
  if v_label is null or length(v_label) = 0 or length(v_label) > 80 then raise exception 'CHAT_SYSTEM_LABEL_INVALID'; end if;

  select city_id into v_city_id from public.grid_seasons where id = p_season_id;
  if not found then raise exception 'SEASON_NOT_FOUND'; end if;

  insert into public.grid_chat_channels (
    city_id, season_id, channel_type, scope_key, display_name, created_at, updated_at
  ) values (
    v_city_id, p_season_id, 'city', 'city', 'CITY // OPEN CHANNEL', p_now, p_now
  )
  on conflict (season_id, channel_type, scope_key) do update
    set updated_at = public.grid_chat_channels.updated_at
  returning id into v_channel_id;

  select * into v_existing
    from public.grid_chat_messages m
   where m.channel_id = v_channel_id
     and m.sender_kind = 'system'
     and m.client_nonce = p_client_nonce;
  if found then
    if v_existing.body <> v_body or v_existing.sender_label <> v_label then
      raise exception 'CHAT_NONCE_COLLISION';
    end if;
    return jsonb_build_object('messageId', v_existing.id, 'channelId', v_channel_id, 'duplicate', true, 'createdAt', v_existing.created_at);
  end if;

  insert into public.grid_chat_messages (
    channel_id, sender_player_id, sender_kind, sender_label,
    sender_is_minor, client_nonce, body, created_at
  ) values (
    v_channel_id, null, 'system', v_label,
    false, p_client_nonce, v_body, p_now
  ) returning * into v_message;

  update public.grid_chat_channels
     set last_message_at = p_now,
         updated_at = p_now
   where id = v_channel_id;

  return jsonb_build_object(
    'messageId', v_message.id,
    'channelId', v_channel_id,
    'duplicate', false,
    'createdAt', v_message.created_at
  );
end;
$$;

create or replace function public.grid_reject_system_chat_report()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.grid_chat_messages m
     where m.id = new.message_id and m.sender_kind = 'system'
  ) then
    raise exception 'CHAT_REPORT_SYSTEM_FORBIDDEN';
  end if;
  return new;
end;
$$;

drop trigger if exists grid_chat_reports_reject_system on public.grid_chat_reports;
create trigger grid_chat_reports_reject_system
before insert or update of message_id on public.grid_chat_reports
for each row execute function public.grid_reject_system_chat_report();

revoke all on function public.grid_broadcast_city_chat_message(uuid, text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.grid_broadcast_city_chat_message(uuid, text, text, text, timestamptz) to service_role;
revoke all on function public.grid_reject_system_chat_report() from public, anon, authenticated;
grant execute on function public.grid_reject_system_chat_report() to service_role;
