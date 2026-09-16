import { describe, expect, it } from 'vitest';
import {
  projectGridSurge,
  resolveGridSurgeStartAt,
  selectGridSurgeHotspots,
  validateGridSurgeConfig,
} from '../lib/grid/core/surge';
import type {
  GridSurgeConfig,
  GridSurgeHotspotCandidate,
  GridSurgeSeasonWindow,
} from '../lib/grid/core/surge-types';

const config: GridSurgeConfig = {
  durationMinutes: 72 * 60,
  districtControlValueMultiplierBps: 15_000,
  landmarkValueMultiplierBps: 17_500,
  hotspotValueMultiplierBps: 20_000,
  dominanceExposureMultiplierBps: 12_500,
  hotspotCount: 3,
  maxHotspotsPerDistrict: 1,
  specialObjectiveSlots: 4,
  npcStrongholdSlots: 2,
  emphasizeFinalRankings: true,
  hotspotWeights: {
    strategicValueBps: 4_000,
    contestPressureBps: 3_500,
    underdogOpportunityBps: 2_500,
  },
};

const window: GridSurgeSeasonWindow = {
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-09-15T00:00:00.000Z',
};

const candidate = (
  territorySlug: string,
  districtSlug: string,
  strategicValueBps: number,
  contestPressureBps: number,
  underdogOpportunityBps: number,
): GridSurgeHotspotCandidate => ({
  territorySlug,
  districtSlug,
  strategicValueBps,
  contestPressureBps,
  underdogOpportunityBps,
});

describe('Grid Surge core', () => {
  it('derives the default Surge start from the configured finale duration', () => {
    expect(resolveGridSurgeStartAt(window, config)).toBe(
      '2026-09-12T00:00:00.000Z',
    );
  });

  it('uses an explicit season surgeStartsAt when supplied', () => {
    expect(
      resolveGridSurgeStartAt(
        {
          ...window,
          surgeStartsAt: '2026-09-11T18:30:00.000Z',
        },
        config,
      ),
    ).toBe('2026-09-11T18:30:00.000Z');
  });

  it('clamps an oversized derived Surge duration to the playable season start', () => {
    expect(
      resolveGridSurgeStartAt(window, {
        ...config,
        durationMinutes: 30 * 24 * 60,
      }),
    ).toBe(window.startsAt);
  });

  it('projects pre-season, regular, Surge, and ended phases deterministically', () => {
    const pre = projectGridSurge(
      '2026-08-31T23:00:00.000Z',
      window,
      config,
    );
    const regular = projectGridSurge(
      '2026-09-10T00:00:00.000Z',
      window,
      config,
    );
    const surge = projectGridSurge(
      '2026-09-13T00:00:00.000Z',
      window,
      config,
    );
    const ended = projectGridSurge(
      '2026-09-15T00:00:00.000Z',
      window,
      config,
    );

    expect(pre.phase).toBe('pre-season');
    expect(regular.phase).toBe('regular');
    expect(surge.phase).toBe('surge');
    expect(ended.phase).toBe('ended');

    expect(pre.effects.landmarkValueMultiplierBps).toBe(10_000);
    expect(regular.effects.specialObjectiveSlots).toBe(0);
    expect(surge.effects).toMatchObject({
      landmarkValueMultiplierBps: 17_500,
      hotspotValueMultiplierBps: 20_000,
      specialObjectiveSlots: 4,
      npcStrongholdSlots: 2,
      emphasizeFinalRankings: true,
    });
    expect(ended.effects.landmarkValueMultiplierBps).toBe(10_000);
  });

  it('reports countdown, remaining time, and finale progress without wall-clock dependence', () => {
    const regular = projectGridSurge(
      '2026-09-11T12:00:00.000Z',
      window,
      config,
    );
    const halfway = projectGridSurge(
      '2026-09-13T12:00:00.000Z',
      window,
      config,
    );

    expect(regular.millisecondsUntilSurge).toBe(12 * 60 * 60 * 1000);
    expect(regular.millisecondsRemaining).toBeNull();

    expect(halfway.millisecondsUntilSurge).toBeNull();
    expect(halfway.millisecondsRemaining).toBe(36 * 60 * 60 * 1000);
    expect(halfway.progressBps).toBe(5_000);
  });

  it('selects high-value hotspots while enforcing district spread', () => {
    const candidates = [
      candidate('arts-alpha', 'arts', 10_000, 10_000, 10_000),
      candidate('arts-beta', 'arts', 9_900, 9_900, 9_900),
      candidate('downtown-alpha', 'downtown', 7_000, 8_000, 9_000),
      candidate('south-alpha', 'south', 6_500, 7_500, 9_500),
      candidate('west-alpha', 'west', 2_000, 2_000, 2_000),
    ];

    const selected = selectGridSurgeHotspots(candidates, config);

    expect(selected.map(({ territorySlug }) => territorySlug)).toEqual([
      'arts-alpha',
      'downtown-alpha',
      'south-alpha',
    ]);
    expect(selected.map(({ rank }) => rank)).toEqual([1, 2, 3]);
    expect(new Set(selected.map(({ districtSlug }) => districtSlug)).size).toBe(
      3,
    );
  });

  it('breaks equal hotspot scores deterministically by district then territory', () => {
    const same = [
      candidate('zulu', 'beta', 5_000, 5_000, 5_000),
      candidate('bravo', 'alpha', 5_000, 5_000, 5_000),
      candidate('alpha', 'alpha', 5_000, 5_000, 5_000),
    ];
    const tieConfig = {
      ...config,
      hotspotCount: 3,
      maxHotspotsPerDistrict: 2,
    };

    expect(
      selectGridSurgeHotspots(same, tieConfig).map(({ territorySlug }) => territorySlug),
    ).toEqual(['alpha', 'bravo', 'zulu']);
  });

  it('returns fewer hotspots instead of violating the configured district cap', () => {
    const onlyOneDistrict = [
      candidate('a', 'arts', 9_000, 9_000, 9_000),
      candidate('b', 'arts', 8_000, 8_000, 8_000),
      candidate('c', 'arts', 7_000, 7_000, 7_000),
    ];

    expect(selectGridSurgeHotspots(onlyOneDistrict, config)).toHaveLength(1);
  });

  it('keeps hotspots dormant before Surge activation', () => {
    const projection = projectGridSurge(
      '2026-09-10T00:00:00.000Z',
      window,
      config,
      [candidate('arts-alpha', 'arts', 10_000, 10_000, 10_000)],
    );

    expect(projection.hotspots).toEqual([]);
  });

  it('requires hotspot weights to total exactly 10000', () => {
    expect(() =>
      validateGridSurgeConfig({
        ...config,
        hotspotWeights: {
          ...config.hotspotWeights,
          underdogOpportunityBps: 2_499,
        },
      }),
    ).toThrow(/must total exactly 10000/);
  });

  it('rejects a duration that would overflow millisecond math', () => {
    expect(() =>
      validateGridSurgeConfig({
        ...config,
        durationMinutes: Number.MAX_SAFE_INTEGER,
      }),
    ).toThrow(/durationMinutes is too large/);
  });

  it('keeps finale multipliers bounded and non-deflationary', () => {
    expect(() =>
      validateGridSurgeConfig({
        ...config,
        landmarkValueMultiplierBps: 9_999,
      }),
    ).toThrow(/between 10000 and 50000/);

    expect(() =>
      validateGridSurgeConfig({
        ...config,
        hotspotValueMultiplierBps: 50_001,
      }),
    ).toThrow(/between 10000 and 50000/);
  });

  it('rejects malformed season windows and explicit Surge timestamps', () => {
    expect(() =>
      resolveGridSurgeStartAt(
        {
          startsAt: '2026-09-15T00:00:00.000Z',
          endsAt: '2026-09-01T00:00:00.000Z',
        },
        config,
      ),
    ).toThrow(/startsAt must be before endsAt/);

    expect(() =>
      resolveGridSurgeStartAt(
        {
          ...window,
          surgeStartsAt: '2026-09-16T00:00:00.000Z',
        },
        config,
      ),
    ).toThrow(/must fall within the playable season window/);
  });

  it('rejects duplicate territories and out-of-range candidate metrics', () => {
    expect(() =>
      selectGridSurgeHotspots(
        [
          candidate('same', 'arts', 5_000, 5_000, 5_000),
          candidate('same', 'downtown', 5_000, 5_000, 5_000),
        ],
        config,
      ),
    ).toThrow(/Duplicate Grid Surge hotspot territory/);

    expect(() =>
      selectGridSurgeHotspots(
        [candidate('bad', 'arts', 10_001, 0, 0)],
        config,
      ),
    ).toThrow(/cannot exceed 10000 basis points/);
  });
});
