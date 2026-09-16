import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(path.join(process.cwd(), 'supabase/migrations/20260916072000_grid_chat_party_management.sql'), 'utf8').toLowerCase();

describe('Grid chat party management SQL', () => {
  it('lets only the owner promote or demote non-owner members', () => {
    expect(sql).toContain('grid_set_party_chat_member_role');
    expect(sql).toContain("v_actor_role is distinct from 'owner'");
    expect(sql).toContain("p_role not in ('member', 'moderator')");
  });

  it('lets moderators remove regular members but not owners or moderators', () => {
    expect(sql).toContain('grid_remove_party_chat_member');
    expect(sql).toContain("v_actor_role not in ('owner', 'moderator')");
    expect(sql).toContain("v_actor_role = 'moderator' and v_target_role <> 'member'");
    expect(sql).toContain('party_owner_cannot_be_removed');
  });

  it('supports explicit ownership transfer to an active party member', () => {
    expect(sql).toContain('grid_transfer_party_chat_owner');
    expect(sql).toContain("set role = 'moderator'");
    expect(sql).toContain("set role = 'owner'");
  });

  it('keeps every lifecycle mutation server-only', () => {
    expect(sql.match(/revoke all on function public\.grid_/g)?.length).toBe(3);
    expect(sql.match(/to service_role/g)?.length).toBe(3);
    expect(sql).not.toContain('security definer');
  });
});
