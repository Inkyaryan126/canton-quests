/**
 * Canton Quests Boardroom V2 — where runtime/durable state lives.
 *
 * Every function here accepts an optional `root` (defaulting to the real
 * repo root) so tests can point the whole module graph at a throwaway temp
 * directory instead of touching the real .boardroom/runtime/ — no test in
 * this suite ever reads or writes real Boardroom state.
 */
import path from 'path';

export const REPO_ROOT = path.resolve(__dirname, '..', '..');

export function runtimeDir(root: string = REPO_ROOT): string {
  return path.join(root, '.boardroom', 'runtime');
}

export function lockFile(root: string = REPO_ROOT): string {
  return path.join(runtimeDir(root), 'write-lock.json');
}

export function budgetFile(root: string = REPO_ROOT): string {
  return path.join(runtimeDir(root), 'astra-budget.json');
}

export function tasksDir(root: string = REPO_ROOT): string {
  return path.join(runtimeDir(root), 'tasks');
}

export function taskFile(taskId: string, root: string = REPO_ROOT): string {
  return path.join(tasksDir(root), `${taskId}.json`);
}

export function logsDir(root: string = REPO_ROOT): string {
  return path.join(runtimeDir(root), 'logs');
}

export function invocationLogFile(taskId: string, agent: string, attempt: number, root: string = REPO_ROOT): string {
  return path.join(logsDir(root), `${taskId}-${agent}-${attempt}.log`);
}

export function autonomousRunMarkerFile(root: string = REPO_ROOT): string {
  return path.join(runtimeDir(root), 'AUTONOMOUS_RUN_ACTIVE');
}

export function boardroomDurableDir(root: string = REPO_ROOT): string {
  return path.join(root, 'boardroom');
}

export function morningReportFile(root: string = REPO_ROOT): string {
  return path.join(boardroomDurableDir(root), 'reports', 'MORNING_REPORT.md');
}

export function handoffFile(taskId: string, root: string = REPO_ROOT): string {
  return path.join(boardroomDurableDir(root), 'handoffs', `${taskId}.md`);
}
