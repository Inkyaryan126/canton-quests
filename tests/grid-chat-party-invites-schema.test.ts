import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function sql(): string {
  const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter((name) => name.endsWith('_grid_chat_party_invites.sql'))
    .sort();
  if (files.length !== 1) {
    throw new Error(`Expected one Grid party invite migration, found ${files.length}`);
  }
  return fs.readFileSync(path.join(migrationsDir, files[0]), 'utf8').toLowerCase();
}

describe('Grid chat consent-based party invites', () => {
  it('stores pending invitations separately from channel membership', () => {
    const source = sql();
    expect(source).toContain('create table public.grid_chat_party_invites');
    expect(source).toContain("status in ('pending', 'accepted', 'declined', 'cancelled', 'expired')");
    expect(source).toContain('expires_at');
    expect(source).toContain("where status = 'pending'");
  });

  it('creates an invite instead of immediately adding the target as a member', () => {
    const source = sql();
    expect(source).toContain('grid_invite_party_chat_member');
    const inviteFn = source.split('grid_invite_party_chat_member', 2)[1].split('$$;', 1)[0];
    expect(inviteFn).toContain('insert into public.grid_chat_party_invites');
    expect(inviteFn).not.toContain('insert into public.grid_chat_members');
  });

  it('rechecks minor and block safety when an invite is accepted', () => {
    const source = sql();
    const acceptFn = source.split('grid_accept_party_chat_invite', 2)[1].split('$$;', 1)[0];
    expect(acceptFn).toContain('private_chat_minor_restricted');
    expect(acceptFn).toContain('public.grid_chat_blocks');
    expect(acceptFn).toContain('chat_blocked');
    expect(acceptFn).toContain('insert into public.grid_chat_members');
  });

  it('lets only the invitee accept or decline their invitation', () => {
    const source = sql();
    const acceptFn = source.split('grid_accept_party_chat_invite', 2)[1].split('$$;', 1)[0];
    const declineFn = source.split('grid_decline_party_chat_invite', 2)[1].split('$$;', 1)[0];
    expect(acceptFn).toContain('v_invite.invitee_player_id <> p_player_id');
    expect(declineFn).toContain('v_invite.invitee_player_id <> p_player_id');
  });

  it('retires the old force-add service-role command', () => {
    const source = sql();
    expect(source).toContain('revoke all on function public.grid_add_party_chat_member');
    expect(source).toContain('from service_role');
  });

  it('keeps invite tables and commands off direct browser access', () => {
    const source = sql();
    expect(source).toContain('enable row level security');
    expect(source).toContain('from anon, authenticated');
    expect(source.match(/to service_role/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
