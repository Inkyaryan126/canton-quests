import { describe, expect, it } from 'vitest';
import { buildGridProgressionSnapshot } from '../lib/grid/core/progression';
import {
  rankGridProgression,
  type GridProgressionRankingBoard,
  type GridProgressionRankingCandidate,
} from '../lib/grid/core/progression-ranking';

function candidate(
  playerId: string,
  stats: Parameters<typeof buildGridProgressionSnapshot>[0],
): GridProgressionRankingCandidate {
  return { playerId, snapshot: buildGridProgressionSnapshot(stats) };
}

describe('Grid progression ranking engine', () => {
  const candidates = [
    candidate('alpha', {
      xp: 5000,
      territoryControl: 9000,
      territoriesCaptured: 80,
      propertyValue: 10000,
    }),
    candidate('bravo', {
      xp: 9000,
      territoryControl: 2000,
      territoriesCaptured: 10,
      propertyValue: 200000,
      netWorth: 300000,
    }),
    candidate('charlie', {
      xp: 7000,
      territoryControl: 5000,
      territoriesCaptured: 50,
      propertyValue: 100000,
      netWorth: 200000,
    }),
  ];

  it('ranks overall by Grid Rating with XP as deterministic tiebreak input', () => {
    const ranked = rankGridProgression(candidates, { type: 'overall' });
    expect(ranked.map((entry) => entry.playerId)).toEqual(
      [...ranked]
        .sort(
          (a, b) =>
            b.snapshot.gridRating - a.snapshot.gridRating ||
            b.snapshot.totalXp - a.snapshot.totalXp ||
            a.playerId.localeCompare(b.playerId),
        )
        .map((entry) => entry.playerId),
    );
    expect(ranked[0].rank).toBe(1);
    expect(ranked[0].score).toBe(ranked[0].snapshot.gridRating);
  });

  it('can rank by a category without changing the underlying overall rating', () => {
    const territory = rankGridProgression(candidates, {
      type: 'category',
      category: 'territory',
    });
    const economy = rankGridProgression(candidates, {
      type: 'category',
      category: 'economy',
    });

    expect(territory[0].playerId).toBe('alpha');
    expect(economy[0].playerId).toBe('bravo');
    expect(territory[0].score).toBe(territory[0].snapshot.categoryScores.territory);
    expect(economy[0].score).toBe(economy[0].snapshot.categoryScores.economy);
  });

  it('can rank by an enabled raw stat', () => {
    const ranked = rankGridProgression(candidates, {
      type: 'stat',
      stat: 'territoriesCaptured',
    });
    expect(ranked.map((entry) => entry.playerId)).toEqual(['alpha', 'charlie', 'bravo']);
    expect(ranked.map((entry) => entry.score)).toEqual([80, 50, 10]);
  });

  it('refuses to turn explicitly non-ranking stats into leaderboards', () => {
    for (const stat of ['scrimmageLosses', 'heat', 'wantedLevel'] as const) {
      expect(() =>
        rankGridProgression(candidates, { type: 'stat', stat }),
      ).toThrow(`Grid stat ${stat} is not ranking-enabled`);
    }
  });

  it('gives true score ties the same competition rank but keeps stable player ordering', () => {
    const tied = [
      candidate('zulu', { xp: 1000, territoriesCaptured: 10 }),
      candidate('alpha', { xp: 1000, territoriesCaptured: 10 }),
      candidate('middle', { xp: 500, territoriesCaptured: 5 }),
    ];
    const ranked = rankGridProgression(tied, {
      type: 'stat',
      stat: 'territoriesCaptured',
    });

    expect(ranked.map(({ playerId, rank }) => [playerId, rank])).toEqual([
      ['alpha', 1],
      ['zulu', 1],
      ['middle', 3],
    ]);
  });

  it('is input-order independent for every supported board shape', () => {
    const boards: GridProgressionRankingBoard[] = [
      { type: 'overall' },
      { type: 'category', category: 'territory' },
      { type: 'stat', stat: 'propertiesOwned' },
    ];
    for (const board of boards) {
      expect(rankGridProgression([...candidates].reverse(), board)).toEqual(
        rankGridProgression(candidates, board),
      );
    }
  });
});
