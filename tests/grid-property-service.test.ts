import { describe, expect, it, vi } from 'vitest';
import {
  acquireGridProperty,
  developGridProperty,
} from '../lib/grid/server/property-service';
import type {
  GridPropertyAcquisitionResult,
  GridPropertyCommandPort,
  GridPropertyDevelopmentResult,
} from '../lib/grid/server/property-port';
import { createSupabaseGridPropertyCommandPort } from '../lib/grid/server/supabase-property';

const base = {
  seasonId: '00000000-0000-4000-8000-000000000001',
  cityId: '00000000-0000-4000-8000-000000000002',
  playerId: '00000000-0000-4000-8000-000000000003',
  propertyId: '00000000-0000-4000-8000-000000000004',
  propertySlug: 'market-block',
  territoryId: '00000000-0000-4000-8000-000000000005',
  creditsSpent: 200,
  commandPointsSpent: 1,
  credits: 4800,
  influence: 100,
  commandPoints: 8,
  eventId: '00000000-0000-4000-8000-000000000006',
};
const acquired: GridPropertyAcquisitionResult = {
  ...base,
  acquiredAt: '2026-09-14T22:30:00.000Z',
};

const developed: GridPropertyDevelopmentResult = {
  ...base,
  creditsSpent: 75,
  commandPointsSpent: 2,
  credits: 4725,
  commandPoints: 6,
  developmentBranch: 'commerce',
  previousLevel: 0,
  developmentLevel: 1,
  developedAt: '2026-09-14T22:35:00.000Z',
  skylineEventId: null,
  skylineRuleIds: [],
};

const acquireCommand = {
  seasonId: base.seasonId,
  playerId: base.playerId,
  propertyId: base.propertyId,
  idempotencyKey: 'acquire:market-block:p3',
  now: acquired.acquiredAt,
};

const developCommand = {
  ...acquireCommand,
  idempotencyKey: 'develop:market-block:commerce:1:p3',
  now: developed.developedAt,
  branch: 'commerce' as const,
};
describe('Grid property services', () => {
  it('validates and forwards property acquisition', async () => {
    const port: GridPropertyCommandPort = {
      acquireProperty: vi.fn().mockResolvedValue(acquired),
      developProperty: vi.fn(),
    };

    await expect(acquireGridProperty(port, acquireCommand)).resolves.toEqual(acquired);
    expect(port.acquireProperty).toHaveBeenCalledWith(acquireCommand);
  });

  it('validates and forwards one of the five development branches', async () => {
    const port: GridPropertyCommandPort = {
      acquireProperty: vi.fn(),
      developProperty: vi.fn().mockResolvedValue(developed),
    };

    await expect(developGridProperty(port, developCommand)).resolves.toEqual(developed);
    expect(port.developProperty).toHaveBeenCalledWith(developCommand);
  });

  it('rejects malformed commands before reaching the port', async () => {
    const port: GridPropertyCommandPort = {
      acquireProperty: vi.fn(),
      developProperty: vi.fn(),
    };

    await expect(
      acquireGridProperty(port, { ...acquireCommand, idempotencyKey: ' ' }),
    ).rejects.toThrow('non-empty idempotency key');
    await expect(
      acquireGridProperty(port, { ...acquireCommand, now: 'bad-time' }),
    ).rejects.toThrow('valid now timestamp');
    expect(port.acquireProperty).not.toHaveBeenCalled();
  });
});
describe('Supabase Grid property adapter', () => {
  it('requires service-role Supabase configuration', () => {
    expect(() => createSupabaseGridPropertyCommandPort(null as any)).toThrow(
      'Grid property commands require Supabase service-role configuration',
    );
  });

  it('calls the atomic acquisition RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: acquired, error: null });
    const port = createSupabaseGridPropertyCommandPort({ rpc } as any);

    await expect(port.acquireProperty(acquireCommand)).resolves.toEqual(acquired);
    expect(rpc).toHaveBeenCalledWith('grid_acquire_property', {
      p_season_id: acquireCommand.seasonId,
      p_player_id: acquireCommand.playerId,
      p_property_id: acquireCommand.propertyId,
      p_idempotency_key: acquireCommand.idempotencyKey,
      p_now: acquireCommand.now,
    });
  });

  it('calls the atomic development RPC with the configured branch', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: developed, error: null });
    const port = createSupabaseGridPropertyCommandPort({ rpc } as any);

    await expect(port.developProperty(developCommand)).resolves.toEqual(developed);
    expect(rpc).toHaveBeenCalledWith('grid_develop_property', {
      p_season_id: developCommand.seasonId,
      p_player_id: developCommand.playerId,
      p_property_id: developCommand.propertyId,
      p_branch: 'commerce',
      p_idempotency_key: developCommand.idempotencyKey,
      p_now: developCommand.now,
    });
  });
});