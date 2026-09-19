import { describe, expect, it } from 'vitest';
import {
  calculateDownstreamUnlocks,
  prioritizeGridMasterBoard,
  validateMilestoneGraph,
} from '../lib/grid/master-board/prioritize';
import type { GridMasterBoard, GridMilestoneDefinition, GridMilestoneState } from '../lib/grid/master-board/types';

const definition = (overrides: Partial<GridMilestoneDefinition> = {}): GridMilestoneDefinition => ({
  id: 'root',
  title: 'Root milestone',
  phase: 'gameplay',
  dependsOn: [],
  lanePatterns: [],
  branchPatterns: [],
  integrationCommitSignals: [],
  ...overrides,
});

const state = (overrides: Partial<GridMilestoneState> = {}): GridMilestoneState => ({
  id: 'root',
  title: 'Root milestone',
  phase: 'gameplay',
  status: 'SAFE_NEXT_WORK',
  promotion: 'DEPLOYMENT_UNKNOWN',
  detail: 'Ready',
  warnings: [],
  ...overrides,
});

const board = (milestones: GridMilestoneState[]): GridMasterBoard => ({
  version: 1,
  health: {
    generatedAt: '2026-09-19T00:00:00.000Z',
    integrationRef: 'grid-integration-20260919',
    integrationCommit: 'abc',
    localMainAvailable: true,
    originMainAvailable: false,
    boardroomAutonomousRunActive: false,
    liveClaimCount: 0,
    staleClaimCount: 0,
    coordinationWarnings: [],
  },
  milestones,
});

describe('Grid milestone graph validation', () => {
  it('rejects duplicate ids and unknown dependencies with clear errors', () => {
    expect(() => validateMilestoneGraph([
      definition({ id: 'same', dependsOn: ['missing'] }),
      definition({ id: 'same' }),
    ])).toThrow(/duplicate milestone id.*same.*unknown dependency.*missing/i);
  });

  it('rejects dependency cycles and names the cycle path', () => {
    expect(() => validateMilestoneGraph([
      definition({ id: 'a', dependsOn: ['b'] }),
      definition({ id: 'b', dependsOn: ['a'] }),
    ])).toThrow(/dependency cycle.*a.*b.*a/i);
  });
});

describe('Grid milestone prioritizer', () => {
  it('counts all transitive downstream unlocks from the authoritative graph', () => {
    const definitions = [
      definition({ id: 'root' }),
      definition({ id: 'child', dependsOn: ['root'] }),
      definition({ id: 'grandchild', dependsOn: ['child'] }),
      definition({ id: 'sibling', dependsOn: ['root'] }),
    ];

    expect(calculateDownstreamUnlocks(definitions, 'root')).toEqual(['child', 'grandchild', 'sibling']);
  });

  it('ranks only actionable statuses by deterministic score and stable id tie-break', () => {
    const definitions = [
      definition({ id: 'zeta', phase: 'player' }),
      definition({ id: 'alpha', phase: 'player' }),
      definition({ id: 'planned', phase: 'launch' }),
    ];
    const states = [
      state({ id: 'zeta', title: 'Zeta', phase: 'player' }),
      state({ id: 'alpha', title: 'Alpha', phase: 'player' }),
      state({ id: 'planned', title: 'Planned', phase: 'launch', status: 'PLANNED' }),
    ];

    const result = prioritizeGridMasterBoard(board(states), definitions, { limit: 10 });
    expect(result.recommendations.map((item) => item.id)).toEqual(['alpha', 'zeta']);
    expect(result.recommendations.every((item) => item.score.total === item.score.total)).toBe(true);
    expect(result.recommendations[0]?.score.breakdown).toEqual(expect.objectContaining({
      playerImpact: expect.any(Number),
      dependencyUnlock: expect.any(Number),
      launchValue: expect.any(Number),
      urgency: expect.any(Number),
      coordinationRiskPenalty: expect.any(Number),
      phaseWeight: expect.any(Number),
    }));
    expect(result.recommendations[0]?.whyNow).toMatch(/now|unlock|ready/i);
  });

  it('applies a coordination-risk penalty and includes dependency context', () => {
    const definitions = [
      definition({ id: 'safe', phase: 'gameplay' }),
      definition({ id: 'risky', phase: 'gameplay', dependsOn: ['safe'] }),
      definition({ id: 'downstream', phase: 'launch', dependsOn: ['risky'] }),
    ];
    const result = prioritizeGridMasterBoard(board([
      state({ id: 'safe', title: 'Safe', phase: 'gameplay' }),
      state({ id: 'risky', title: 'Risky', phase: 'gameplay', warnings: ['stale claim matched', 'coordination warning'] }),
      state({ id: 'downstream', title: 'Downstream', phase: 'launch', status: 'PLANNED' }),
    ]), definitions);
    const risky = result.recommendations.find((item) => item.id === 'risky');

    expect(risky?.score.breakdown.coordinationRiskPenalty).toBeGreaterThan(0);
    expect(risky?.dependencies).toEqual(['safe']);
    expect(risky?.downstreamUnlocks).toEqual(['downstream']);
    expect(risky?.whyNow).toMatch(/downstream|dependency/i);
  });

  it('returns top-N recommendations only', () => {
    const definitions = [
      definition({ id: 'one' }),
      definition({ id: 'two' }),
      definition({ id: 'three' }),
    ];
    const result = prioritizeGridMasterBoard(board([
      state({ id: 'one', title: 'One' }),
      state({ id: 'two', title: 'Two' }),
      state({ id: 'three', title: 'Three' }),
    ]), definitions, { limit: 2 });

    expect(result.recommendations).toHaveLength(2);
    expect(result.limit).toBe(2);
  });
});
