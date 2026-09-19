import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSupabaseGridVisitorEconomyPolicyResolver,
  parseGridVisitorEconomyPolicy,
} from '../lib/grid/server/supabase-visitor-economy-policy';

type Row = Record<string, unknown>;
type Fixtures = Record<string, Row[]>;

class FakeQuery {
  private equals = new Map<string, unknown>();
  private includes = new Map<string, unknown[]>();

  constructor(
    private readonly table: string,
    private readonly fixtures: Fixtures,
  ) {}

  select(_columns: string) {
    return this;
  }

  eq(field: string, value: unknown) {
    this.equals.set(field, value);
    return this;
  }

  in(field: string, values: unknown[]) {
    this.includes.set(field, values);
    return this;
  }

  private rows(): Row[] {
    return (this.fixtures[this.table] ?? []).filter((row) => {
      for (const [field, value] of this.equals) {
        if (row[field] !== value) return false;
      }
      for (const [field, values] of this.includes) {
        if (!values.includes(row[field])) return false;
      }
      return true;
    });
  }

  maybeSingle() {
    const rows = this.rows();
    return Promise.resolve({
      data: rows.length === 1 ? rows[0] : null,
      error: rows.length > 1 ? { message: 'multiple rows' } : null,
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: { data: Row[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.rows(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }
}

function fakeClient(fixtures: Fixtures): SupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(table, fixtures);
    },
  } as unknown as SupabaseClient;
}

function explicitPolicy() {
  return {
    visitorInvestmentCapCredits: 2000,
    visitorPropertyLimit: 4,
    visitorDeploymentAllowance: 3,
    residencyThresholdPoints: 120,
  };
}

function fixtures(): Fixtures {
  return {
    grid_cities: [{ id: 'city-akron', slug: 'akron-oh' }],
    grid_seasons: [{
      id: 'season-akron',
      city_id: 'city-akron',
      status: 'active',
      config: { visitorEconomy: explicitPolicy() },
    }],
  };
}

describe('Grid visitor economy policy parser', () => {
  it('accepts only an explicit policy and delegates numeric bounds to Core', () => {
    expect(parseGridVisitorEconomyPolicy({ visitorEconomy: explicitPolicy() }))
      .toEqual(explicitPolicy());
    expect(parseGridVisitorEconomyPolicy({ otherConfig: true })).toBeNull();
  });

  it('supports an explicitly disabled residency threshold without adding a default', () => {
    expect(parseGridVisitorEconomyPolicy({
      visitorEconomy: {
        ...explicitPolicy(),
        residencyThresholdPoints: null,
      },
    })?.residencyThresholdPoints).toBeNull();
  });

  it('rejects missing, nonnumeric, fractional, negative, and invalid residency values', () => {
    expect(() => parseGridVisitorEconomyPolicy({
      visitorEconomy: { ...explicitPolicy(), visitorPropertyLimit: undefined },
    })).toThrow(/numeric visitorPropertyLimit/);
    expect(() => parseGridVisitorEconomyPolicy({
      visitorEconomy: { ...explicitPolicy(), visitorDeploymentAllowance: '3' },
    })).toThrow(/numeric visitorDeploymentAllowance/);
    expect(() => parseGridVisitorEconomyPolicy({
      visitorEconomy: { ...explicitPolicy(), visitorInvestmentCapCredits: 1.5 },
    })).toThrow(/safe integer/);
    expect(() => parseGridVisitorEconomyPolicy({
      visitorEconomy: { ...explicitPolicy(), visitorPropertyLimit: -1 },
    })).toThrow(/non-negative/);
    expect(() => parseGridVisitorEconomyPolicy({
      visitorEconomy: { ...explicitPolicy(), residencyThresholdPoints: 0 },
    })).toThrow(/positive safe integer/);
  });
});

describe('Supabase Grid visitor economy policy resolver', () => {
  it('resolves explicit policy from the target city single playable season', async () => {
    const resolver = createSupabaseGridVisitorEconomyPolicyResolver(
      fakeClient(fixtures()),
    );
    await expect(resolver.resolvePolicy('akron-oh')).resolves.toEqual({
      cityId: 'city-akron',
      citySlug: 'akron-oh',
      seasonId: 'season-akron',
      policy: explicitPolicy(),
    });
  });

  it('returns null when the city has no playable season or no explicit policy', async () => {
    const none = fixtures();
    none.grid_seasons = [];
    await expect(createSupabaseGridVisitorEconomyPolicyResolver(fakeClient(none))
      .resolvePolicy('akron-oh')).resolves.toBeNull();

    const unconfigured = fixtures();
    unconfigured.grid_seasons[0].config = { economy: {} };
    await expect(createSupabaseGridVisitorEconomyPolicyResolver(fakeClient(unconfigured))
      .resolvePolicy('akron-oh')).resolves.toBeNull();
  });

  it('fails closed when multiple playable seasons make policy selection ambiguous', async () => {
    const ambiguous = fixtures();
    ambiguous.grid_seasons.push({
      id: 'season-akron-surge',
      city_id: 'city-akron',
      status: 'surge',
      config: { visitorEconomy: explicitPolicy() },
    });
    await expect(createSupabaseGridVisitorEconomyPolicyResolver(fakeClient(ambiguous))
      .resolvePolicy('akron-oh'))
      .rejects.toThrow('GRID_VISITOR_PLAYABLE_SEASON_AMBIGUOUS');
  });

  it('rejects unknown cities and requires service-role configuration', async () => {
    const resolver = createSupabaseGridVisitorEconomyPolicyResolver(
      fakeClient(fixtures()),
    );
    await expect(resolver.resolvePolicy('missing-city'))
      .rejects.toThrow('GRID_VISITOR_TARGET_CITY_NOT_FOUND');
    expect(() => createSupabaseGridVisitorEconomyPolicyResolver(null))
      .toThrow(/service-role configuration/);
  });
});
