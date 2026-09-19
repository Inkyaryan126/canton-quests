import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918120000_grid_anti_cheat_review.sql'),
  'utf8',
).toLowerCase();

describe('Grid anti-cheat review schema', () => {
  it('stores private immutable assessments and signal evidence', () => {
    expect(sql).toContain('create table public.grid_anti_cheat_assessments');
    expect(sql).toContain('create table public.grid_anti_cheat_signals');
    expect(sql).toContain('assessment_key');
    expect(sql).toContain('signal_ids');
    expect(sql).toContain('hard_reject_signal_ids');
    expect(sql).toContain('before update or delete on public.grid_anti_cheat_assessments');
    expect(sql).toContain('before update or delete on public.grid_anti_cheat_signals');
  });

  it('closes direct player access and grants only service-role execution', () => {
    for (const table of ['grid_anti_cheat_assessments', 'grid_anti_cheat_signals', 'grid_anti_cheat_reviews']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on public.${table} from anon, authenticated`);
    }
    expect(sql).toContain('revoke all on function public.grid_record_anti_cheat_assessment');
    expect(sql).toContain('grant execute on function public.grid_record_anti_cheat_assessment');
    expect(sql).toContain('to service_role;');
    expect(sql).not.toContain('security definer');
  });

  it('uses one transactional RPC and never mutates player or account state', () => {
    expect(sql).toContain('grid_record_anti_cheat_assessment');
    expect(sql).toContain('on conflict (city_id, season_id, assessment_key) do nothing');
    expect(sql).toContain('v_assessment.created_at <> p_created_at');
    expect(sql).toContain('grid_anti_cheat_reviews');
    expect(sql).toContain('grid_anti_cheat_assessment_conflict');
    expect(sql).toContain('signal_order');
    expect(sql).toContain("status in ('pending', 'in-review', 'resolved')");
    expect(sql).not.toMatch(/update\s+public\.players/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.players/);
    expect(sql).not.toContain('ban');
    expect(sql).not.toContain('suspend');
    expect(sql).not.toContain('confiscat');
  });
});
