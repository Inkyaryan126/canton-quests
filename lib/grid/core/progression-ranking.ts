import { GRID_STAT_DEFINITIONS } from './progression';
import type {
  GridProgressionSnapshot,
  GridStatCategory,
  GridStatKey,
} from './progression-types';

export type GridProgressionRankingBoard =
  | { type: 'overall' }
  | { type: 'category'; category: GridStatCategory }
  | { type: 'stat'; stat: GridStatKey };

export interface GridProgressionRankingCandidate {
  playerId: string;
  snapshot: GridProgressionSnapshot;
}

export interface GridProgressionRankedEntry extends GridProgressionRankingCandidate {
  rank: number;
  score: number;
}

const STAT_BY_KEY = new Map(
  GRID_STAT_DEFINITIONS.map((definition) => [definition.key, definition] as const),
);

function tupleFor(
  candidate: GridProgressionRankingCandidate,
  board: GridProgressionRankingBoard,
): number[] {
  if (board.type === 'overall') {
    return [candidate.snapshot.gridRating, candidate.snapshot.totalXp];
  }

  if (board.type === 'category') {
    return [
      candidate.snapshot.categoryScores[board.category],
      candidate.snapshot.gridRating,
      candidate.snapshot.totalXp,
    ];
  }

  const definition = STAT_BY_KEY.get(board.stat);
  if (!definition?.rankingEnabled) {
    throw new Error(`Grid stat ${board.stat} is not ranking-enabled`);
  }

  return [
    candidate.snapshot.stats[board.stat],
    candidate.snapshot.gridRating,
    candidate.snapshot.totalXp,
  ];
}

function compareTupleDescending(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (b[index] ?? 0) - (a[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function sameTuple(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function rankGridProgression(
  candidates: readonly GridProgressionRankingCandidate[],
  board: GridProgressionRankingBoard,
): GridProgressionRankedEntry[] {
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (seen.has(candidate.playerId)) {
      throw new Error(`duplicate Grid progression ranking player: ${candidate.playerId}`);
    }
    seen.add(candidate.playerId);
  }

  const scored = candidates.map((candidate) => ({
    candidate,
    tuple: tupleFor(candidate, board),
  }));

  scored.sort((a, b) => {
    const tupleOrder = compareTupleDescending(a.tuple, b.tuple);
    return tupleOrder !== 0
      ? tupleOrder
      : a.candidate.playerId.localeCompare(b.candidate.playerId);
  });

  let previousTuple: number[] | null = null;
  let previousRank = 0;

  return scored.map(({ candidate, tuple }, index) => {
    const rank = previousTuple && sameTuple(previousTuple, tuple)
      ? previousRank
      : index + 1;
    previousTuple = tuple;
    previousRank = rank;

    return {
      ...candidate,
      rank,
      score: tuple[0] ?? 0,
    };
  });
}
