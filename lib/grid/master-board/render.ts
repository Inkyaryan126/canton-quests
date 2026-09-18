import fs from 'node:fs';
import path from 'node:path';
import { gitCommonDir } from '../../agent-control';
import type { GridMasterBoard, GridMilestoneState, GridMilestoneStatus } from './types';

const STATUS_ORDER: GridMilestoneStatus[] = [
  'IN_PROGRESS',
  'READY_TO_INTEGRATE',
  'SAFE_NEXT_WORK',
  'INTEGRATED',
  'DIRTY_DORMANT',
  'BLOCKED',
  'REJECTED',
  'PLANNED',
  'UNKNOWN',
];

const STATUS_LABEL: Record<GridMilestoneStatus, string> = {
  IN_PROGRESS: 'IN PROGRESS',
  READY_TO_INTEGRATE: 'READY TO INTEGRATE',
  SAFE_NEXT_WORK: 'SAFE NEXT WORK',
  INTEGRATED: 'INTEGRATED',
  DIRTY_DORMANT: 'DIRTY DORMANT',
  BLOCKED: 'BLOCKED',
  REJECTED: 'REJECTED',
  PLANNED: 'PLANNED',
  UNKNOWN: 'UNKNOWN',
};

function byStatus(board: GridMasterBoard, status: GridMilestoneStatus): GridMilestoneState[] {
  return board.milestones.filter((item) => item.status === status);
}

function compactEvidence(item: GridMilestoneState): string {
  const parts = [item.title];
  if (item.owner) parts.push(`owner=${item.owner}`);
  if (item.branch) parts.push(`branch=${item.branch}`);
  if (item.evidenceCommit) parts.push(`commit=${item.evidenceCommit.slice(0, 8)}`);
  parts.push(`promotion=${item.promotion}`);
  return parts.join('  ');
}
export function renderMasterBoardText(board: GridMasterBoard): string {
  const scanBadge = board.health.deepScan ? ' [DEEP SCAN]' : '';
  const lines = [
    `THE GRID — MASTER BOARD${scanBadge}`,
    `Generated: ${board.health.generatedAt}`,
    `Integration ref: ${board.health.integrationRef ?? 'UNKNOWN'}${board.health.integrationCommit ? ` @ ${board.health.integrationCommit.slice(0, 8)}` : ''}`,
    `Health: claims=${board.health.liveClaimCount} stale=${board.health.staleClaimCount} safeNext=${board.health.safeNextWorkCount ?? 0} dirtyDormant=${board.health.dirtyDormantCount ?? 0} warnings=${board.health.coordinationWarnings.length} boardroom=${board.health.boardroomAutonomousRunActive ? 'ACTIVE' : 'inactive'}`,
  ];

  if (board.health.hygiene) {
    const h = board.health.hygiene;
    lines.push(`Hygiene: totalWorktrees=${h.totalWorktrees} safeToPrune=${h.safeToPruneCount} dirtyDormant=${h.dirtyDormantCount} unmergedDormant=${h.unmergedDormantCount}`);
  }

  if (board.health.coordinationWarnings.length > 0) {
    lines.push('', 'COORDINATION WARNINGS');
    for (const warning of board.health.coordinationWarnings) {
      lines.push(`  ${warning.code}: ${warning.message}`);
    }
  }

  for (const status of STATUS_ORDER) {
    const items = byStatus(board, status);
    if (items.length === 0) continue;
    lines.push('', STATUS_LABEL[status]);
    for (const item of items) {
      lines.push(`  ${compactEvidence(item)}`);
      lines.push(`    ${item.detail}`);
      for (const warning of item.warnings) lines.push(`    warning: ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function serializeMasterBoardJson(board: GridMasterBoard): string {
  return `${JSON.stringify(board, null, 2)}\n`;
}
export function renderMasterBoardMarkdown(board: GridMasterBoard): string {
  const scanBadge = board.health.deepScan ? ' *(Deep Scan)*' : '';
  const lines = [
    `# THE GRID — MASTER BOARD${scanBadge}`,
    '',
    `Generated: ${board.health.generatedAt}  `,
    `Integration ref: ${board.health.integrationRef ?? 'UNKNOWN'}${board.health.integrationCommit ? ` @ ${board.health.integrationCommit.slice(0, 8)}` : ''}  `,
    `Health: ${board.health.liveClaimCount} live claims · ${board.health.staleClaimCount} stale · ${board.health.safeNextWorkCount ?? 0} safe next · ${board.health.dirtyDormantCount ?? 0} dirty dormant · ${board.health.coordinationWarnings.length} coordination warnings`,
  ];

  if (board.health.hygiene) {
    const h = board.health.hygiene;
    lines.push(`Hygiene: ${h.totalWorktrees} worktrees (${h.safeToPruneCount} safe to prune, ${h.dirtyDormantCount} dirty dormant, ${h.unmergedDormantCount} unmerged dormant)`);
  }

  if (board.health.coordinationWarnings.length > 0) {
    lines.push('', '## COORDINATION WARNINGS');
    for (const warning of board.health.coordinationWarnings) {
      lines.push(`- **${warning.code}** — ${warning.message}`);
    }
  }

  for (const status of STATUS_ORDER) {
    const items = byStatus(board, status);
    if (items.length === 0) continue;
    lines.push('', `## ${STATUS_LABEL[status]}`);
    for (const item of items) {
      const metadata = [item.owner && `owner: ${item.owner}`, item.branch && `branch: ${item.branch}`, `promotion: ${item.promotion}`].filter(Boolean).join(' · ');
      lines.push(`- **${item.title}** — ${item.detail}${metadata ? ` _(${metadata})_` : ''}`);
      for (const warning of item.warnings) lines.push(`  - Warning: ${warning}`);
    }
  }

  return `${lines.join('\n')}\n`;
}
export function writeMasterBoardSnapshot(board: GridMasterBoard, cwd: string): {
  jsonPath: string;
  markdownPath: string;
} {
  const root = path.join(gitCommonDir(cwd), 'grid-agent-control');
  fs.mkdirSync(root, { recursive: true });
  const jsonPath = path.join(root, 'master-board.json');
  const markdownPath = path.join(root, 'master-board.md');
  fs.writeFileSync(jsonPath, serializeMasterBoardJson(board));
  fs.writeFileSync(markdownPath, renderMasterBoardMarkdown(board));
  return { jsonPath, markdownPath };
}
