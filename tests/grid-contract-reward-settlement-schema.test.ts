import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260919123000_grid_contract_reward_settlement.sql',
  ),
  'utf8',
).toLowerCase();

describe('Grid Contract reward settlement persistence contract', () => {
  it('locks the outbox row before checking replay or applying money', () => {
    expect(sql).toContain('from public.grid_contract_reward_outbox');
    expect(sql).toContain('where id = p_outbox_id');
    expect(sql).toContain('for update');
  });

  it('uses the outbox reward as the only payout source', () => {
    expect(sql).toContain("v_outbox.reward ->> 'credits'");
    expect(sql).toContain("v_outbox.reward ->> 'influence'");
    expect(sql).toContain("v_outbox.reward ->> 'commandpoints'");
    expect(sql).not.toContain('p_credits');
    expect(sql).not.toContain('p_influence');
    expect(sql).not.toContain('p_command_points');
  });

  it('strictly validates the three reward fields and rejects extra keys', () => {
    expect(sql).toContain('jsonb_object_keys(v_outbox.reward)');
    expect(sql).toContain(
      "reward_key.key not in ('credits', 'influence', 'commandpoints')",
    );
    expect(sql).toContain('contract_reward_payload_invalid');
  });

  it('settles rewards before archive but not in draft, scheduled, or archived seasons', () => {
    expect(sql).toContain(
      "v_season.status not in ('active', 'surge', 'complete')",
    );
    expect(sql).toContain('contract_reward_season_not_settleable');
  });

  it('caps Command Points using the authoritative season balance config', () => {
    expect(sql).toContain("v_season.config -> 'balance'");
    expect(sql).toContain("'maxcommandpoints'");
    expect(sql).toContain('least(');
    expect(sql).toContain('v_command_points_granted');
  });

  it('credits player state, marks the outbox processed, and writes one audit event atomically', () => {
    const wallet = sql.indexOf('update public.grid_player_season_state');
    const outbox = sql.indexOf('update public.grid_contract_reward_outbox');
    const event = sql.indexOf('insert into public.grid_game_events');
    expect(wallet).toBeGreaterThan(0);
    expect(outbox).toBeGreaterThan(wallet);
    expect(event).toBeGreaterThan(outbox);
    expect(sql).toContain("'grid:contract_reward_settled'");
  });

  it('replays already-processed rows only from their immutable settlement event', () => {
    expect(sql).toContain('if v_outbox.processed_at is not null then');
    expect(sql).toContain("'contract-reward-settlement:'");
    expect(sql).toContain('contract_reward_processed_event_missing');
    expect(sql).toContain("'outcome', 'duplicate'");
  });

  it('allows direct execution only through service role', () => {
    expect(sql).toContain(
      'revoke all on function public.grid_settle_contract_reward',
    );
    expect(sql).toContain('from public, anon, authenticated');
    expect(sql).toContain('to service_role');
  });
});
