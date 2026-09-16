import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function sql(): string {
  const file = path.join(process.cwd(), 'supabase/migrations/20260916141500_grid_chat_rooms.sql');
  if (!fs.existsSync(file)) throw new Error('Grid chat rooms migration not found');
  return fs.readFileSync(file, 'utf8').toLowerCase();
}

describe('Grid public chat rooms SQL', () => {
  it('adds room as a first-class channel type', () => {
    const source = sql();
    expect(source).toContain("'room'");
    expect(source).toContain('grid_chat_channels_channel_type_check');
  });

  it('stores public room metadata separately from message history', () => {
    const source = sql();
    expect(source).toContain('create table public.grid_chat_rooms');
    expect(source).toContain('topic text');
    expect(source).toContain('member_limit integer');
    expect(source).toContain("visibility in ('public', 'unlisted')");
    expect(source).toContain('channel_id uuid primary key');
  });

  it('creates a room with the creator as owner', () => {
    const source = sql();
    expect(source).toContain('grid_create_public_chat_room');
    expect(source).toContain("'room'");
    expect(source).toContain("'owner'");
    expect(source).toContain('insert into public.grid_chat_members');
  });

  it('requires season membership and enforces room capacity on join', () => {
    const source = sql();
    expect(source).toContain('grid_join_public_chat_room');
    expect(source).toContain('player_not_in_season');
    expect(source).toContain('room_full');
    expect(source).toContain('member_limit');
  });

  it('lets a joined non-owner leave without deleting room history', () => {
    const source = sql();
    expect(source).toContain('grid_leave_public_chat_room');
    expect(source).toContain('left_at = p_now');
    expect(source).toContain('room_owner_cannot_leave');
  });

  it('keeps room metadata and commands behind service-role access', () => {
    const source = sql();
    expect(source).toContain('enable row level security');
    expect(source).toContain('revoke all on public.grid_chat_rooms from anon, authenticated');
    expect(source.match(/to service_role/g)?.length).toBeGreaterThanOrEqual(4);
  });
});
