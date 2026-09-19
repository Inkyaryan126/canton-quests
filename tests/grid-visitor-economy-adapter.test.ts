import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseGridVisitorEconomyEvidencePort } from '../lib/grid/server/supabase-visitor-economy';

type Row = Record<string, unknown>;

type Fixtures = Record<string, Row[]>;

class FakeQuery {
  private equals = new Map<string, unknown>();
  private includes = new Map<string, unknown[]>();
  private selectOptions: { count?: string; head?: boolean } | undefined;

  constructor(
    private readonly table: string,
    private readonly fixtures: Fixtures,
  ) {}

  select(_columns: string, options?: { count?: string; head?: boolean }) {
    this.selectOptions = options;
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

  private result() {
    const rows = this.rows();
    if (this.selectOptions?.head && this.selectOptions.count === 'exact') {
      return { data: null, count: rows.length, error: null };
    }
    return { data: rows, count: null, error: null };
  }

  maybeSingle() {
    const result = this.result();
    const rows = (result.data ?? []) as Row[];
    return Promise.resolve({
      data: rows.length === 1 ? rows[0] : null,
      count: result.count,
      error: rows.length > 1 ? { message: 'multiple rows' } : null,
    });
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: ReturnType<FakeQuery['result']>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onfulfilled, onrejected);
  }
}

function fakeClient(fixtures: Fixtures): SupabaseClient {
  return {
    from(table: string) {
      return new FakeQuery(table, fixtures);
    },
  } as unknown as SupabaseClient;
}

const baseFixtures = (): Fixtures => ({
  grid_cities: [
    { id: 'city-canton', slug: 'canton-oh' },
    { id: 'city-akron', slug: 'akron-oh' },
  ],
  grid_player_profiles: [
    { player_id: 'player-1', home_city_id: 'city-canton' },
  ],
  grid_seasons: [
    { id: 'season-akron', city_id: 'city-akron', status: 'active' },
  ],
  grid_season_property_state: [
    { id: 'p1', season_id: 'season-akron', city_id: 'city-akron', owner_player_id: 'player-1' },
    { id: 'p2', season_id: 'season-akron', city_id: 'city-akron', owner_player_id: 'player-1' },
    { id: 'p3', season_id: 'season-akron', city_id: 'city-akron', owner_player_id: 'other-player' },
  ],
});

describe('Supabase Grid visitor economy evidence adapter', () => {
  it('proves Home City and owned property count from authoritative Grid state', async () => {
    const port = createSupabaseGridVisitorEconomyEvidencePort(fakeClient(baseFixtures()));

    await expect(port.readEvidence('player-1', 'akron-oh')).resolves.toEqual({
      targetCitySlug: 'akron-oh',
      homeCitySlug: 'canton-oh',
      localInvestmentCredits: null,
      ownedPropertyCount: 2,
      deploymentsUsed: null,
      residencyPoints: null,
    });
  });

  it('treats a missing profile as unassigned Home City rather than inventing one', async () => {
    const fixtures = baseFixtures();
    fixtures.grid_player_profiles = [];
    const port = createSupabaseGridVisitorEconomyEvidencePort(fakeClient(fixtures));

    const result = await port.readEvidence('player-1', 'akron-oh');
    expect(result.homeCitySlug).toBeNull();
    expect(result.ownedPropertyCount).toBe(2);
  });

  it('fails closed on property count when the target city has zero or multiple playable seasons', async () => {
    const zero = baseFixtures();
    zero.grid_seasons = [];
    const zeroResult = await createSupabaseGridVisitorEconomyEvidencePort(fakeClient(zero))
      .readEvidence('player-1', 'akron-oh');
    expect(zeroResult.ownedPropertyCount).toBeNull();

    const multiple = baseFixtures();
    multiple.grid_seasons.push({ id: 'season-akron-surge', city_id: 'city-akron', status: 'surge' });
    const multipleResult = await createSupabaseGridVisitorEconomyEvidencePort(fakeClient(multiple))
      .readEvidence('player-1', 'akron-oh');
    expect(multipleResult.ownedPropertyCount).toBeNull();
  });

  it('rejects an unknown target city rather than fabricating empty evidence', async () => {
    const port = createSupabaseGridVisitorEconomyEvidencePort(fakeClient(baseFixtures()));
    await expect(port.readEvidence('player-1', 'missing-city'))
      .rejects.toThrow('GRID_VISITOR_TARGET_CITY_NOT_FOUND');
  });

  it('requires service-role configuration and non-empty identity inputs', async () => {
    expect(() => createSupabaseGridVisitorEconomyEvidencePort(null))
      .toThrow(/service-role configuration/);

    const port = createSupabaseGridVisitorEconomyEvidencePort(fakeClient(baseFixtures()));
    await expect(port.readEvidence(' ', 'akron-oh')).rejects.toThrow(/playerId/);
    await expect(port.readEvidence('player-1', ' ')).rejects.toThrow(/targetCitySlug/);
  });
});
