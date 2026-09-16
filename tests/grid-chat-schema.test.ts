import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function migration(): string {
  const file = path.join(
    process.cwd(),
    'supabase',
    'migrations',
    '20260916070000_grid_chat_foundation.sql',
  );
  if (!fs.existsSync(file)) throw new Error('Grid chat migration not found');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('GRID chat foundation SQL contract', () => {
  it('creates channels, membership, messages, blocks, and reports', () => {
    const sql = migration();
    for (const table of [
      'grid_chat_channels',
      'grid_chat_members',
      'grid_chat_messages',
      'grid_chat_blocks',
      'grid_chat_reports',
    ]) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('supports city, district, party, direct, and system channel classes', () => {
    const sql = migration();
    for (const type of ['city', 'district', 'party', 'direct', 'system']) {
      expect(sql).toContain(`'${type}'`);
    }
    expect(sql).toContain('unique (season_id, channel_type, scope_key)');
  });

  it('makes client message retries idempotent', () => {
    const sql = migration();
    expect(sql).toContain('unique (channel_id, sender_player_id, client_nonce)');
    expect(sql).toContain('grid_send_chat_message');
  });

  it('enforces direct-chat minor and blocking safety in authoritative SQL', () => {
    const sql = migration();
    expect(sql).toContain('direct_chat_minor_restricted');
    expect(sql).toContain('grid_chat_blocks');
    expect(sql).toContain('chat_blocked');
  });

  it('uses an advisory lock before rate-limit checks to stop concurrent spam races', () => {
    const sql = migration();
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain('chat_rate_limited');
    expect(sql).toContain("interval '10 seconds'");
    expect(sql).toContain("interval '60 seconds'");
  });

  it('supports message reporting and read cursors', () => {
    const sql = migration();
    expect(sql).toContain('grid_report_chat_message');
    expect(sql).toContain('grid_mark_chat_read');
    expect(sql).toContain('grid_moderate_chat_report');
    expect(sql).toContain('last_read_at');
  });

  it('keeps mutations server-authoritative', () => {
    const sql = migration();
    expect(sql.match(/revoke all on function public\.grid_/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql.match(/to service_role/g)?.length).toBeGreaterThanOrEqual(8);
    expect(sql).not.toContain('security definer');
  });

  it('does not expose chat tables directly to anon or authenticated clients', () => {
    const sql = migration();
    expect(sql).toContain('revoke all on public.grid_chat_channels from anon, authenticated');
    expect(sql).toContain('revoke all on public.grid_chat_messages from anon, authenticated');
  });
});
