import { describe, expect, it } from 'vitest';

import {
  recommendGridProductWork,
  type GridProductCandidate,
  type GridProductDirectorInput,
} from '../lib/grid/ops/product-director';
import type { PlayableLoopScore } from '../lib/grid/ops/playable-loop-score';

const loopScore = (stageId: PlayableLoopScore['highestValueBrokenLink'] extends infer _T ? 'action' : never = 'action'): PlayableLoopScore => ({
  version: 1,
  score: 70,
  status: 'RED',
  stages: [],
  highestValueBrokenLink: {
    stageId,
    title: 'Meaningful action',
    status: 'RED',
    lostPoints: 16,
    recommendation: 'Connect one meaningful action end to end.',
  },
});

const candidate = (overrides: Partial<GridProductCandidate> = {}): GridProductCandidate => ({
  id: 'contest-system',
  title: 'Contest Core',
  phase: 'gameplay',
  stage: 'action',
  status: 'SAFE_NEXT_WORK',
  actionType: 'IMPLEMENT',
  priority: 50,
  safe: true,
  actionable: true,
  dependencies: [],
  evidence: ['safe next work'],
  acceptanceCriteria: ['focused checks pass'],
  scopeHints: ['lib/grid/contest/**'],
  claimPatterns: ['contest-system', 'contest'],
  ...overrides,
});

const input = (overrides: Partial<GridProductDirectorInput> = {}): GridProductDirectorInput => ({
  masterBoard: { milestones: [], candidates: [] },
  claims: [],
  playableLoopScore: loopScore(),
  limit: 3,
  ...overrides,
});

describe('Grid product director', () => {
  it('prioritizes a safe candidate matching the highest-value playable-loop break', () => {
    const result = recommendGridProductWork(input({
      masterBoard: {
        milestones: [],
        candidates: [
          candidate({ id: 'contest-system', title: 'Repair action loop', priority: 20 }),
          candidate({ id: 'polish', title: 'Dashboard polish', stage: undefined, priority: 99, claimPatterns: ['polish'] }),
        ],
      },
    }));

    expect(result.recommendations[0]).toMatchObject({ id: 'contest-system', matchesPlayableBottleneck: true });
    expect(result.recommendations[0].whyNow).toContain('highest-value playable-loop');
  });

  it('excludes already-claimed and scope-overlapping candidates', () => {
    const result = recommendGridProductWork(input({
      masterBoard: {
        milestones: [],
        candidates: [
          candidate({ id: 'claimed', claimPatterns: ['claimed'] }),
          candidate({ id: 'overlap', scopeHints: ['lib/grid/contest/**'], claimPatterns: ['overlap'] }),
          candidate({ id: 'safe-new', scopeHints: ['lib/grid/safe-new.ts'], claimPatterns: ['safe-new'] }),
        ],
      },
      claims: [
        { candidateId: 'claimed', scope: ['other/**'] },
        { candidateId: 'other', scope: ['lib/grid/contest/**'] },
      ],
    }));

    expect(result.recommendations.map((item) => item.id)).toEqual(['safe-new']);
  });

  it('prefers READY_TO_INTEGRATE over equivalent implementation work', () => {
    const result = recommendGridProductWork(input({
      playableLoopScore: { ...loopScore(), highestValueBrokenLink: null, status: 'GREEN', score: 100 },
      masterBoard: {
        milestones: [],
        candidates: [
          candidate({ id: 'new-work', title: 'Same value', stage: undefined, priority: 90 }),
          candidate({
            id: 'integration',
            title: 'Same value',
            stage: undefined,
            status: 'READY_TO_INTEGRATE',
            actionType: 'INTEGRATE',
            priority: 90,
          }),
        ],
      },
    }));

    expect(result.recommendations[0]).toMatchObject({ id: 'integration', actionType: 'INTEGRATE' });
  });

  it('excludes dependency-blocked and non-actionable candidates', () => {
    const result = recommendGridProductWork(input({
      masterBoard: {
        milestones: [{ id: 'missing-contract', title: 'Dependency', status: 'BLOCKED' }],
        candidates: [
          candidate({ id: 'blocked', dependencies: ['missing-contract'] }),
          candidate({ id: 'not-actionable', actionable: false }),
          candidate({ id: 'safe' }),
        ],
      },
    }));

    expect(result.recommendations.map((item) => item.id)).toEqual(['safe']);
  });

  it('does not misclassify a lightweight milestone board as a full Master Board', () => {
    const result = recommendGridProductWork(input({
      playableLoopScore: { ...loopScore(), highestValueBrokenLink: null, status: 'GREEN', score: 100 },
      masterBoard: {
        milestones: [
          {
            id: 'contest-system',
            title: 'Contest Core',
            phase: 'gameplay',
            status: 'SAFE_NEXT_WORK',
            detail: 'synthetic lightweight evidence',
          },
        ],
      },
    }));

    expect(result.recommendations).toEqual([]);
  });

  it('returns fewer than the limit when fewer safe candidates exist', () => {
    const result = recommendGridProductWork(input({
      limit: 3,
      masterBoard: {
        milestones: [],
        candidates: [candidate({ id: 'only-safe' }), candidate({ id: 'unsafe', safe: false })],
      },
    }));

    expect(result.recommendations).toHaveLength(1);
  });

  it('orders true ties deterministically by title then id', () => {
    const result = recommendGridProductWork(input({
      playableLoopScore: { ...loopScore(), highestValueBrokenLink: null, status: 'GREEN', score: 100 },
      masterBoard: {
        milestones: [],
        candidates: [
          candidate({ id: 'z-id', title: 'Same title', stage: undefined, priority: 50 }),
          candidate({ id: 'a-id', title: 'Same title', stage: undefined, priority: 50 }),
          candidate({ id: 'b-id', title: 'Earlier title', stage: undefined, priority: 50 }),
        ],
      },
    }));

    expect(result.recommendations.map((item) => item.id)).toEqual(['b-id', 'a-id', 'z-id']);
  });

  it('selects only the three supported agent specializations', () => {
    const result = recommendGridProductWork(input({
      playableLoopScore: { ...loopScore(), highestValueBrokenLink: null, status: 'GREEN', score: 100 },
      masterBoard: {
        milestones: [],
        candidates: [
          candidate({ id: 'ui', phase: 'player', stage: undefined, specialization: undefined }),
          candidate({ id: 'backend', phase: 'gameplay', stage: undefined, specialization: undefined }),
          candidate({ id: 'integrate', phase: 'operations', stage: undefined, actionType: 'INTEGRATE', specialization: undefined }),
        ],
      },
    }));

    expect(result.recommendations.map((item) => item.specialization).sort()).toEqual([
      'backend/gameplay',
      'player UI/UX',
      'verification/ops',
    ].sort());
  });
});
