-- THE GRID: additive hardening for durable Contract persistence.
-- The base tables and commit RPC are created by 20260918070000_grid_contract_progress.sql.
-- This migration does not replace that history; it makes the reward outbox's
-- logical identity explicit so a replay cannot enqueue a second reward even
-- if an old worker or a repaired instance attempts the completion twice.

alter table public.grid_contract_reward_outbox
  add column if not exists reward_key text;

update public.grid_contract_reward_outbox
   set reward_key = progress_event_id::text || ':' || reward_kind
 where reward_key is null;

alter table public.grid_contract_reward_outbox
  alter column reward_key set not null;

create or replace function public.grid_contract_reward_key_trigger()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.reward_key := new.progress_event_id::text || ':' || new.reward_kind;
  return new;
end;
$$;

drop trigger if exists grid_contract_reward_key on public.grid_contract_reward_outbox;
create trigger grid_contract_reward_key
before insert or update of progress_event_id, reward_kind
on public.grid_contract_reward_outbox
for each row execute function public.grid_contract_reward_key_trigger();

create unique index if not exists grid_contract_reward_outbox_reward_key_uq
  on public.grid_contract_reward_outbox (reward_key);

-- A Contract instance can complete only once.  This second invariant protects
-- the outbox from duplicate completion rows even if a future writer bypasses
-- the current transition function.
create unique index if not exists grid_contract_reward_outbox_contract_reward_uq
  on public.grid_contract_reward_outbox (season_id, player_id, contract_id, reward_kind);

comment on column public.grid_contract_reward_outbox.reward_key is
  'Stable reward delivery key; consumers must acknowledge this key idempotently.';

-- Keep the outbox private and preserve the service-role-only write boundary
-- established by the base migration.
revoke all on public.grid_contract_reward_outbox from anon, authenticated;
revoke all on function public.grid_contract_reward_key_trigger() from public, anon, authenticated;
