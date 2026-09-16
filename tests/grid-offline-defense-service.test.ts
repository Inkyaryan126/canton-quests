import { describe, expect, it, vi } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import type { GridOfflineDefensePolicy } from '../lib/grid/core/offline-defense-types';
import type {
  GridOfflineDefensePolicyPort,
  GridSetOfflineDefensePolicyResult,
} from '../lib/grid/server/offline-defense-port';
import {
  getGridOfflineDefensePolicy,
  setGridOfflineDefensePolicy,
} from '../lib/grid/server/offline-defense-service';
import {
  createSupabaseGridOfflineDefensePolicyPort,
  resolveSupabaseGridSeasonId,
} from '../lib/grid/server/supabase-offline-defense';

const seasonId = '10000000-0000-4000-8000-000000000001';
const playerId = '10000000-0000-4000-8000-000000000002';
const now = '2026-09-16T08:20:00.000Z';

const policy: GridOfflineDefensePolicy = {
  doctrineId: 'balanced-v1',
  reserveInfluence: 80,
  maxCommitPerContest: 60,
  defaultCommitBps: 7500,
  autoRetreatBelowInfluence: 10,
  autoRetreatAfterLosses: 50,
  defaultTactic: 'fortify',
  priorityRules: [
    {
      territorySlug: 'territory-alpha',
      priority: 100,
      commitBps: 10000,
      tactic: 'pressure',
    },
  ],
};

const command = {
  seasonId,
  playerId,
  policy,
  idempotencyKey: 'offline-defense:set:one',
  now,
};

const result: GridSetOfflineDefensePolicyResult = {
  seasonId,
  playerId,
  policy,
  updatedAt: now,
  eventId: '10000000-0000-4000-8000-000000000003',
};

describe('Grid offline defense policy service', () => {
  it('validates and forwards policy writes', async () => {
    const port: GridOfflineDefensePolicyPort = {
      getPolicy: vi.fn(),
      setPolicy: vi.fn().mockResolvedValue(result),
    };

    await expect(setGridOfflineDefensePolicy(port, command)).resolves.toEqual(result);
    expect(port.setPolicy).toHaveBeenCalledWith(command);
  });

  it('rejects malformed writes before persistence', async () => {
    const port: GridOfflineDefensePolicyPort = {
      getPolicy: vi.fn(),
      setPolicy: vi.fn(),
    };

    await expect(
      setGridOfflineDefensePolicy(port, { ...command, idempotencyKey: ' ' }),
    ).rejects.toThrow('non-empty idempotency key');

    await expect(
      setGridOfflineDefensePolicy(port, {
        ...command,
        policy: { ...policy, defaultCommitBps: 10001 },
      }),
    ).rejects.toThrow('defaultCommitBps');

    await expect(
      setGridOfflineDefensePolicy(port, { ...command, now: 'not-a-date' }),
    ).rejects.toThrow('valid now timestamp');

    expect(port.setPolicy).not.toHaveBeenCalled();
  });

  it('validates policy lookup identity before reading persistence', async () => {
    const port: GridOfflineDefensePolicyPort = {
      getPolicy: vi.fn().mockResolvedValue({
        seasonId,
        playerId,
        policy,
        updatedAt: now,
      }),
      setPolicy: vi.fn(),
    };

    await expect(
      getGridOfflineDefensePolicy(port, seasonId, playerId),
    ).resolves.toMatchObject({ seasonId, playerId, policy });
    await expect(
      getGridOfflineDefensePolicy(port, ' ', playerId),
    ).rejects.toThrow('seasonId');
  });
});

describe('Supabase Grid offline defense adapter', () => {
  it('requires service-role configuration', () => {
    expect(() =>
      createSupabaseGridOfflineDefensePolicyPort(null as any),
    ).toThrow('Grid offline defense requires Supabase service-role configuration');
  });

  it('resolves the runtime season from trusted city-package slugs', async () => {
    const cityMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'city-1' },
      error: null,
    });
    const cityEq = vi.fn().mockReturnValue({ maybeSingle: cityMaybeSingle });
    const citySelect = vi.fn().mockReturnValue({ eq: cityEq });

    const seasonMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: seasonId },
      error: null,
    });
    const seasonSlugEq = vi.fn().mockReturnValue({
      maybeSingle: seasonMaybeSingle,
    });
    const seasonCityEq = vi.fn().mockReturnValue({ eq: seasonSlugEq });
    const seasonSelect = vi.fn().mockReturnValue({ eq: seasonCityEq });
    const from = vi.fn((table: string) =>
      table === 'grid_cities'
        ? { select: citySelect }
        : { select: seasonSelect },
    );

    await expect(
      resolveSupabaseGridSeasonId(cantonFoundingSeasonPackage, { from } as any),
    ).resolves.toBe(seasonId);
    expect(cityEq).toHaveBeenCalledWith('slug', cantonFoundingSeasonPackage.city.slug);
    expect(seasonCityEq).toHaveBeenCalledWith('city_id', 'city-1');
    expect(seasonSlugEq).toHaveBeenCalledWith(
      'slug',
      cantonFoundingSeasonPackage.seasonTemplate.slug,
    );
  });

  it('uses the audited atomic policy RPC for writes', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: result, error: null });
    const adapter = createSupabaseGridOfflineDefensePolicyPort({ rpc } as any);

    await expect(adapter.setPolicy(command)).resolves.toEqual(result);
    expect(rpc).toHaveBeenCalledWith('grid_set_offline_defense_policy', {
      p_season_id: seasonId,
      p_player_id: playerId,
      p_doctrine_id: 'balanced-v1',
      p_reserve_influence: 80,
      p_max_commit_per_contest: 60,
      p_default_commit_bps: 7500,
      p_auto_retreat_below_influence: 10,
      p_auto_retreat_after_losses: 50,
      p_default_tactic: 'fortify',
      p_priority_rules: policy.priorityRules,
      p_idempotency_key: command.idempotencyKey,
      p_now: now,
    });
  });
});
