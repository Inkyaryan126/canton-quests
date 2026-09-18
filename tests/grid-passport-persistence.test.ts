import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { GridPassportPersistencePort } from '../lib/grid/server/passport-port';
import { recordGridPassportCityEntry } from '../lib/grid/server/passport-service';
import { createSupabaseGridPassportPersistencePort } from '../lib/grid/server/supabase-passport';

const migration = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260918050000_grid_passport_city_entry.sql'),
  'utf8',
);

const result = {
  passport: {
    version: 1 as const,
    homeCityId: 'city-home',
    citiesEntered: 1,
    entriesRecorded: 1,
    stamps: [
      {
        cityId: 'city-home',
        firstEnteredAt: '2026-09-18T05:00:00.000Z',
        lastEnteredAt: '2026-09-18T05:00:00.000Z',
        entryCount: 1,
        isHomeCity: true,
      },
    ],
  },
  eventId: 'event-1',
  recorded: true,
};

function port(): GridPassportPersistencePort {
  return { recordCityEntry: vi.fn().mockResolvedValue(result) };
}

describe('Grid Passport persistence service', () => {
  it('forwards a validated permanent city-entry command', async () => {
    const p = port();
    const command = {
      playerId: 'player-1',
      cityId: 'city-home',
      idempotencyKey: 'passport:player-1:city-home:entry-1',
      enteredAt: '2026-09-18T05:00:00.000Z',
    };

    await expect(recordGridPassportCityEntry(p, command)).resolves.toEqual(result);
    expect(p.recordCityEntry).toHaveBeenCalledWith(command);
  });

  it('rejects malformed commands before persistence', async () => {
    const p = port();
    await expect(recordGridPassportCityEntry(p, {
      playerId: ' ',
      cityId: 'city-1',
      idempotencyKey: 'key',
      enteredAt: '2026-09-18T05:00:00.000Z',
    })).rejects.toThrow('Grid Passport entry requires playerId');
    await expect(recordGridPassportCityEntry(p, {
      playerId: 'player-1',
      cityId: 'city-1',
      idempotencyKey: ' ',
      enteredAt: '2026-09-18T05:00:00.000Z',
    })).rejects.toThrow('non-empty idempotency key');
    await expect(recordGridPassportCityEntry(p, {
      playerId: 'player-1',
      cityId: 'city-1',
      idempotencyKey: 'key',
      enteredAt: 'bad-time',
    })).rejects.toThrow('valid enteredAt timestamp');
    expect(p.recordCityEntry).not.toHaveBeenCalled();
  });
});

describe('Supabase Grid Passport adapter', () => {
  it('requires service-role configuration and calls the atomic RPC', async () => {
    expect(() => createSupabaseGridPassportPersistencePort(null as any)).toThrow(
      'Grid Passport persistence requires Supabase service-role configuration',
    );

    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const adapter = createSupabaseGridPassportPersistencePort({ rpc } as any);
    await expect(adapter.recordCityEntry({
      playerId: 'player-1',
      cityId: 'city-2',
      idempotencyKey: 'passport:entry:2',
      enteredAt: '2026-09-18T05:00:00.000Z',
    })).resolves.toEqual(result);

    expect(rpc).toHaveBeenCalledWith('grid_record_passport_city_entry', {
      p_player_id: 'player-1',
      p_city_id: 'city-2',
      p_idempotency_key: 'passport:entry:2',
      p_entered_at: '2026-09-18T05:00:00.000Z',
    });
  });
});

describe('Grid Passport persistence schema contract', () => {
  it('serializes concurrent profile updates and requires an existing Home City', () => {
    expect(migration).toContain('from public.grid_player_profiles');
    expect(migration).toContain('for update;');
    expect(migration).toContain('PASSPORT_HOME_CITY_REQUIRED');
    expect(migration).toContain('PASSPORT_CITY_NOT_FOUND');
  });

  it('is idempotent and rejects cross-command key reuse', () => {
    expect(migration).toContain('idempotency_key = p_idempotency_key');
    expect(migration).toContain("'recorded', false");
    expect(migration).toContain('PASSPORT_IDEMPOTENCY_KEY_REUSED');
  });

  it('writes the compact Passport projection and immutable city-entry event atomically', () => {
    expect(migration).toContain("'{stamps}'");
    expect(migration).toContain("'{citiesEntered}'");
    expect(migration).toContain("'{entriesRecorded}'");
    expect(migration).toContain("'grid:passport_city_entered'");
    expect(migration).toContain('entity_type');
    expect(migration).toContain("'city'");
  });

  it('keeps local economy balances entirely outside the command', () => {
    expect(migration).not.toMatch(/grid_player_season_state/);
    expect(migration).not.toMatch(/\bcredits\b/i);
    expect(migration).not.toMatch(/\binfluence\b/i);
    expect(migration).not.toMatch(/command_points/i);
  });

  it('keeps browser roles away from the security-definer command', () => {
    expect(migration).toContain('security definer');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
  });
});
