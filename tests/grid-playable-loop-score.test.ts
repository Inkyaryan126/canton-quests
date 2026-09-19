import { describe, expect, it } from 'vitest';
import type { GridMasterBoard } from '../lib/grid/master-board/types';
import {
  PLAYABLE_LOOP_STAGES,
  collectPlayableLoopScore,
  scorePlayableLoop,
  type PlayableLoopStageEvidence,
  type PlayableLoopStageId,
} from '../lib/grid/ops/playable-loop-score';

function evidence(status: PlayableLoopStageEvidence['status'] = 'GREEN'): PlayableLoopStageEvidence {
  return {
    status,
    evidence: [`${status.toLowerCase()} evidence`],
    source: 'master-board',
  };
}

function allStages(status: PlayableLoopStageEvidence['status'] = 'GREEN') {
  return Object.fromEntries(
    PLAYABLE_LOOP_STAGES.map((stage) => [stage.id, evidence(status)]),
  ) as Partial<Record<PlayableLoopStageId, PlayableLoopStageEvidence>>;
}

describe('Grid playable loop score', () => {
  it('returns 100 with every stage green', () => {
    const result = scorePlayableLoop({ stages: allStages() });

    expect(result.score).toBe(100);
    expect(result.status).toBe('GREEN');
    expect(result.highestValueBrokenLink).toBeNull();
    expect(result.stages.every((stage) => stage.contribution === stage.weight)).toBe(true);
  });

  it('penalizes an early hard break more than a late hard break', () => {
    const early = allStages();
    early.entry = evidence('RED');
    const late = allStages();
    late.returnExperience = evidence('RED');

    const earlyResult = scorePlayableLoop({ stages: early });
    const lateResult = scorePlayableLoop({ stages: late });

    expect(earlyResult.score).toBeLessThan(lateResult.score);
    expect(earlyResult.highestValueBrokenLink?.stageId).toBe('entry');
  });

  it('keeps a late-stage degradation visible without making the loop fail hard', () => {
    const stages = allStages();
    stages.progression = evidence('YELLOW');
    stages.returnExperience = evidence('YELLOW');

    const result = scorePlayableLoop({ stages });

    expect(result.score).toBe(95);
    expect(result.status).toBe('YELLOW');
    expect(result.highestValueBrokenLink?.stageId).toBe('progression');
  });

  it('uses fixed weights and deterministic tie-breaking', () => {
    const stages = allStages();
    stages.identity = evidence('RED');
    stages.seasonJoin = evidence('RED');

    const first = scorePlayableLoop({ stages });
    const second = scorePlayableLoop({ stages });

    expect(PLAYABLE_LOOP_STAGES.reduce((total, stage) => total + stage.weight, 0)).toBe(100);
    expect(first).toEqual(second);
    expect(first.highestValueBrokenLink?.stageId).toBe('identity');
  });

  it('reports missing evidence as yellow and names it as the broken link', () => {
    const stages = allStages();
    delete stages.action;

    const result = scorePlayableLoop({ stages });
    const action = result.stages.find((stage) => stage.id === 'action');

    expect(action?.status).toBe('YELLOW');
    expect(action?.contribution).toBe(8);
    expect(action?.verification).toBe('missing evidence');
    expect(result.highestValueBrokenLink?.stageId).toBe('action');
  });


  it('lets concrete runtime entry evidence upgrade the collected entry stage to GREEN', () => {
    const board = {
      version: 1,
      health: {
        generatedAt: '2026-09-19T06:00:00.000Z',
        integrationRef: 'grid-integration-test',
        integrationCommit: 'abc123',
        localMainAvailable: false,
        originMainAvailable: false,
        boardroomAutonomousRunActive: false,
        liveClaimCount: 0,
        staleClaimCount: 0,
        coordinationWarnings: [],
      },
      milestones: [],
    } satisfies GridMasterBoard;

    const result = collectPlayableLoopScore({
      cwd: process.cwd(),
      board,
      runtimeEvidence: {
        entry: {
          status: 'GREEN',
          evidence: ['real Next runtime redirect verified'],
          source: 'runtime',
          runtimeVerified: true,
        },
      },
    });

    const entry = result.stages.find((stage) => stage.id === 'entry');
    expect(entry).toMatchObject({
      status: 'GREEN',
      contribution: 16,
      source: 'runtime',
      verification: 'browser/runtime verified',
    });
  });

  it('labels implementation evidence as not browser/runtime verified unless stated', () => {
    const stages = allStages();
    stages.entry = { ...evidence(), runtimeVerified: true };

    const result = scorePlayableLoop({ stages });

    expect(result.stages.find((stage) => stage.id === 'entry')?.verification).toBe('browser/runtime verified');
    expect(result.stages.find((stage) => stage.id === 'identity')?.verification).toBe('browser/runtime not yet verified');
  });

  it('recognizes canonical integrated entry and onboarding evidence without runtime verification', () => {
    const board = {
      version: 1,
      health: {
        generatedAt: '2026-09-19T06:00:00.000Z',
        integrationRef: 'grid-canonical-integration-20260918',
        integrationCommit: '514759bb',
        localMainAvailable: false,
        originMainAvailable: false,
        boardroomAutonomousRunActive: false,
        liveClaimCount: 0,
        staleClaimCount: 0,
        coordinationWarnings: [],
      },
      milestones: [],
    } satisfies GridMasterBoard;

    const result = collectPlayableLoopScore({ cwd: process.cwd(), board });
    const stages = new Map(result.stages.map((stage) => [stage.id, stage]));

    expect(stages.get('entry')).toMatchObject({
      status: 'GREEN',
      contribution: 16,
      verification: 'browser/runtime not yet verified',
    });
    expect(stages.get('identity')).toMatchObject({
      status: 'GREEN',
      contribution: 14,
      verification: 'browser/runtime not yet verified',
    });
    expect(stages.get('seasonJoin')).toMatchObject({
      status: 'GREEN',
      contribution: 12,
      verification: 'browser/runtime not yet verified',
    });
    expect(stages.get('starterTerritory')).toMatchObject({
      status: 'GREEN',
      contribution: 12,
      verification: 'browser/runtime not yet verified',
    });
  });

  it('keeps absent canonical entry and onboarding evidence RED', () => {
    const board = {
      version: 1,
      health: {
        generatedAt: '2026-09-19T06:00:00.000Z',
        integrationRef: null,
        integrationCommit: null,
        localMainAvailable: false,
        originMainAvailable: false,
        boardroomAutonomousRunActive: false,
        liveClaimCount: 0,
        staleClaimCount: 0,
        coordinationWarnings: [],
      },
      milestones: [],
    } satisfies GridMasterBoard;

    const result = collectPlayableLoopScore({
      cwd: '/private/tmp/grid-loop-evidence-calibration-absent',
      board,
    });
    const stages = new Map(result.stages.map((stage) => [stage.id, stage]));

    expect(stages.get('entry')?.status).toBe('RED');
    expect(stages.get('identity')?.status).toBe('RED');
    expect(stages.get('seasonJoin')?.status).toBe('RED');
    expect(stages.get('starterTerritory')?.status).toBe('RED');
    expect(stages.get('seasonJoin')?.verification).toBe('browser/runtime not yet verified');
  });
});
