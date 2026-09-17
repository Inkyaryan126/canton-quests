import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  renderMasterBoardMarkdown,
  renderMasterBoardText,
  serializeMasterBoardJson,
} from '../lib/grid/master-board/render';
import type { GridMasterBoard } from '../lib/grid/master-board/types';
import { runGridMasterBoardCli } from '../lib/grid/master-board/cli';

const board: GridMasterBoard = {
  version: 1,
  health: {
    generatedAt: '2026-09-17T20:00:00.000Z',
    integrationRef: 'grid-integration-20260917',
    integrationCommit: 'abc123',
    localMainAvailable: true,
    originMainAvailable: true,
    boardroomAutonomousRunActive: false,
    liveClaimCount: 2,
    staleClaimCount: 0,
    coordinationWarnings: [],
  },
  milestones: [
    { id: 'map-world', title: '2.5D Map & World', phase: 'world', status: 'IN_PROGRESS', promotion: 'SIDE_BRANCH_ONLY', detail: 'Active lane map-scene', owner: 'agent-map', branch: 'grid-map-scene-20260916', warnings: [] },
    { id: 'road-network', title: 'Road Network', phase: 'world', status: 'INTEGRATED', promotion: 'GRID_INTEGRATION', detail: 'Integrated via abc123', evidenceCommit: 'abc123', evidenceSubject: 'GRID Roads 13', warnings: [] },
    { id: 'passport', title: 'Grid Passport', phase: 'identity', status: 'PLANNED', promotion: 'DEPLOYMENT_UNKNOWN', detail: 'No implementation evidence found', warnings: [] },
    { id: 'anti-cheat', title: 'Anti-Cheat & Fraud Controls', phase: 'operations', status: 'READY_TO_INTEGRATE', promotion: 'SIDE_BRANCH_ONLY', detail: 'Completed on clean branch grid-anti-cheat', branch: 'grid-anti-cheat', warnings: [] },
  ],
};

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function makeRepo(): string {
  const repo = mkdtempSync(path.join(tmpdir(), 'grid-board-cli-'));
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.email', 'grid-board@test.local');
  git(repo, 'config', 'user.name', 'Grid Board Test');
  writeFileSync(path.join(repo, 'README.md'), '# fixture\n');
  git(repo, 'add', 'README.md');
  git(repo, 'commit', '-m', 'base');
  return repo;
}

describe('Grid Master Board rendering and CLI', () => {
  it('keeps READY TO INTEGRATE visibly separate from INTEGRATED in text and markdown', () => {
    const text = renderMasterBoardText(board);
    const markdown = renderMasterBoardMarkdown(board);

    expect(text).toContain('READY TO INTEGRATE');
    expect(text).toContain('INTEGRATED');
    expect(text.indexOf('READY TO INTEGRATE')).not.toBe(text.indexOf('INTEGRATED'));
    expect(markdown).toContain('## READY TO INTEGRATE');
    expect(markdown).toContain('## INTEGRATED');
  });

  it('serializes the same underlying milestone states as JSON', () => {
    const parsed = JSON.parse(serializeMasterBoardJson(board)) as GridMasterBoard;
    expect(parsed.version).toBe(1);
    expect(parsed.health.integrationRef).toBe('grid-integration-20260917');
    expect(parsed.milestones.map((item) => item.status)).toEqual(board.milestones.map((item) => item.status));
  });

  it('honors an explicit integration ref and emits clean JSON from the CLI', () => {
    const repo = makeRepo();
    const out: string[] = [];
    const err: string[] = [];

    const exitCode = runGridMasterBoardCli(['--json', '--integration-ref', 'main'], {
      cwd: repo,
      stdout: (value) => out.push(value),
      stderr: (value) => err.push(value),
    });

    expect(exitCode).toBe(0);
    expect(err).toEqual([]);
    const parsed = JSON.parse(out.join('')) as GridMasterBoard;
    expect(parsed.health.integrationRef).toBe('main');
  });

  it('writes snapshots only beneath the Git common coordination directory', () => {
    const repo = makeRepo();
    const out: string[] = [];
    const err: string[] = [];

    const exitCode = runGridMasterBoardCli(['--snapshot', '--integration-ref', 'main'], {
      cwd: repo,
      stdout: (value) => out.push(value),
      stderr: (value) => err.push(value),
    });

    expect(exitCode).toBe(0);
    const common = path.resolve(repo, git(repo, 'rev-parse', '--git-common-dir'));
    const jsonPath = path.join(common, 'grid-agent-control', 'master-board.json');
    const markdownPath = path.join(common, 'grid-agent-control', 'master-board.md');
    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(markdownPath)).toBe(true);
    expect(JSON.parse(readFileSync(jsonPath, 'utf8')).version).toBe(1);
    expect(readFileSync(markdownPath, 'utf8')).toContain('# THE GRID — MASTER BOARD');
    expect(git(repo, 'status', '--short')).toBe('');
    expect(err.join('\n')).toContain(jsonPath);
    expect(out.join('')).toContain('THE GRID — MASTER BOARD');
  });
});
