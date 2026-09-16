import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260916071000_grid_chat_districts_parties.sql'), 'utf8').toLowerCase();

describe('Grid chat district + party SQL', () => {
  it('joins district channels by approved Grid district identity instead of player GPS', () => {
    expect(sql).toContain('grid_join_district_chat_channel');
    expect(sql).toContain('public.grid_districts');
    expect(sql).not.toContain('latitude');
    expect(sql).not.toContain('longitude');
  });

  it('creates private party channels with an owner membership', () => {
    expect(sql).toContain('grid_create_party_chat_channel');
    expect(sql).toContain("'owner'");
    expect(sql).toContain("'party:' || v_channel_id::text");
  });

  it('restricts private parties involving minor accounts and honors blocks', () => {
    expect(sql).toContain('private_chat_minor_restricted');
    expect(sql).toContain('public.grid_chat_blocks');
    expect(sql).toContain('chat_blocked');
  });

  it('requires owner/moderator permission for party invitations', () => {
    expect(sql).toContain("v_actor_role not in ('owner', 'moderator')");
    expect(sql).toContain('party_invite_forbidden');
  });

  it('prevents an owner from orphaning a party with active members', () => {
    expect(sql).toContain('party_owner_cannot_leave');
  });
});
