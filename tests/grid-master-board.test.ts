import { describe, expect, it } from 'vitest';
import { classifyMilestone } from '../lib/grid/master-board/classify';
import type {
  GridMilestoneDefinition,
  GridMilestoneEvidence,
} from '../lib/grid/master-board/types';

const definition: GridMilestoneDefinition = {
  id: 'road-network',
  title: 'Road Network',
  phase: 'world',
  dependsOn: [],
  lanePatterns: ['road-network'],
  branchPatterns: ['grid-road-network'],
  integrationCommitSignals: ['GRID Roads 13'],
};

function evidence(overrides: Partial<GridMilestoneEvidence> = {}): GridMilestoneEvidence {
  return {
    activeClaims: [],
    branches: [],
    integrationMatches: [],
    blockers: [],
    warnings: [],
    contradictions: [],
    ...overrides,
  };
}

describe('Grid Master Board classification', () => {
  it('classifies an active non-stale claim as IN_PROGRESS', () => {
    const result = classifyMilestone(definition, evidence({
      activeClaims: [{ lane: 'road-network', owner: 'agent-a', branch: 'grid-road-network-x', stale: false }],
    }));

    expect(result.status).toBe('IN_PROGRESS');
    expect(result.owner).toBe('agent-a');
  });

  it('does not treat a stale claim as active progress', () => {
    const result = classifyMilestone(definition, evidence({
      activeClaims: [{ lane: 'road-network', owner: 'agent-a', branch: 'grid-road-network-x', stale: true }],
    }));

    expect(result.status).toBe('PLANNED');
    expect(result.warnings.join(' ')).toMatch(/stale/i);
  });

  it('classifies a clean completed side branch as READY_TO_INTEGRATE', () => {
    const result = classifyMilestone(definition, evidence({
      branches: [{ branch: 'grid-road-network-20260915', clean: true, completionCommit: 'abc123', completionSubject: 'GRID Roads 13: derive stable named road corridors', mergedIntoIntegration: false, onLocalMain: false, onOriginMain: false }],
    }));

    expect(result.status).toBe('READY_TO_INTEGRATE');
    expect(result.promotion).toBe('SIDE_BRANCH_ONLY');
  });
  it('refuses to mark a dirty completed branch ready to integrate', () => {
    const result = classifyMilestone(definition, evidence({
      branches: [{ branch: 'grid-road-network-20260915', clean: false, completionCommit: 'abc123', completionSubject: 'GRID Roads 13: derive stable named road corridors', mergedIntoIntegration: false, onLocalMain: false, onOriginMain: false }],
    }));

    expect(result.status).toBe('UNKNOWN');
    expect(result.warnings.join(' ')).toMatch(/dirty/i);
  });

  it('gives integrated ancestry precedence over an old side branch', () => {
    const result = classifyMilestone(definition, evidence({
      integrationMatches: [{ commit: 'abc123', subject: 'GRID Roads 13: derive stable named road corridors', onLocalMain: false, onOriginMain: false }],
      branches: [{ branch: 'grid-road-network-20260915', clean: true, completionCommit: 'abc123', completionSubject: 'GRID Roads 13: derive stable named road corridors', mergedIntoIntegration: true, onLocalMain: false, onOriginMain: false }],
    }));

    expect(result.status).toBe('INTEGRATED');
    expect(result.promotion).toBe('GRID_INTEGRATION');
  });

  it('uses blocked evidence when no stronger implementation evidence exists', () => {
    const result = classifyMilestone(definition, evidence({ blockers: ['waiting for schema'] }));
    expect(result.status).toBe('BLOCKED');
    expect(result.detail).toMatch(/waiting for schema/i);
  });
  it('keeps a catalog-only milestone visible as PLANNED', () => {
    const result = classifyMilestone(definition, evidence());
    expect(result.status).toBe('PLANNED');
  });

  it('surfaces contradictory evidence as UNKNOWN instead of guessing', () => {
    const result = classifyMilestone(definition, evidence({
      contradictions: ['two incompatible completion commits were found'],
    }));

    expect(result.status).toBe('UNKNOWN');
    expect(result.detail).toMatch(/incompatible completion commits/i);
  });

  it('reports promotion to origin/main when integrated evidence is already there', () => {
    const result = classifyMilestone(definition, evidence({
      integrationMatches: [{ commit: 'abc123', subject: 'GRID Roads 13: derive stable named road corridors', onLocalMain: true, onOriginMain: true }],
    }));

    expect(result.status).toBe('INTEGRATED');
    expect(result.promotion).toBe('ORIGIN_MAIN');
  });
});

import { GRID_MILESTONES } from '../lib/grid/master-board/milestones';

describe('Grid Master Board milestone catalog', () => {
  it('keeps major completed and future Grid systems visible with stable unique ids', () => {
    const ids = GRID_MILESTONES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      'city-compiler', 'road-network', 'market', 'auctions', 'alliances',
      'map-world', 'admin-control', 'launch-readiness', 'passport',
      'anti-cheat', 'season-archive', 'production-activation',
    ]));
  });
});
