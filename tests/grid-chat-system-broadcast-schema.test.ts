import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260916073000_grid_chat_system_broadcasts.sql'), 'utf8').toLowerCase();

describe('Grid chat system broadcasts SQL', () => {
  it('models system messages without a fake player identity', () => {
    expect(sql).toContain("sender_kind in ('player', 'system')");
    expect(sql).toContain('alter column sender_player_id drop not null');
    expect(sql).toContain("sender_kind = 'system' and sender_player_id is null");
    expect(sql).toContain('sender_label');
  });

  it('makes system broadcast retries idempotent', () => {
    expect(sql).toContain('grid_chat_messages_system_nonce_uq');
    expect(sql).toContain('grid_broadcast_city_chat_message');
    expect(sql).toContain("m.sender_kind = 'system'");
    expect(sql).toContain("raise exception 'chat_nonce_collision'");
  });

  it('prevents players from filing reports against authoritative system broadcasts', () => {
    expect(sql).toContain('grid_reject_system_chat_report');
    expect(sql).toContain('chat_report_system_forbidden');
    expect(sql).toContain('grid_chat_reports_reject_system');
  });

  it('keeps broadcast authority server-only', () => {
    expect(sql).toContain('revoke all on function public.grid_broadcast_city_chat_message');
    expect(sql).toContain('to service_role');
    expect(sql).not.toContain('security definer');
  });
});
