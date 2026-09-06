/**
 * Manual task creation/inspection.
 *
 *   npm run boardroom:task -- create --title "..." --goal "..." --priority HIGH \
 *       --phase PHASE_1_RECON --primary CLAUDE [--fallback1 AGY] [--fallback2 ASTRA] \
 *       [--category ROUTINE_IMPLEMENTATION] [--scope "app/foo/,lib/bar.ts"] \
 *       [--tests "npm test,npm run build"] \
 *       [--acceptance "criterion one|criterion two|criterion three"] \
 *       [--checkpoint-expectations "what a checkpoint on this task should look like"]
 *   npm run boardroom:task -- list
 *   npm run boardroom:task -- show <TASK_ID>
 *   npm run boardroom:task -- update-scope <TASK_ID> --scope "app/foo/,lib/bar.ts,tests/"
 *
 * --scope, --tests, and --acceptance are each a single flag holding a
 * delimited list — --scope/--tests split on "," (paths/commands rarely
 * contain a literal comma), --acceptance splits on "|" instead since
 * acceptance-criteria sentences routinely contain commas.
 *
 * update-scope REPLACES the task's writeScope with the exact list given —
 * it's the deliberate, reviewable way to broaden a task's scope after a
 * real run shows it needs a shared/cross-cutting path (e.g. tests/ for a
 * task expected to add new test files, or boardroom/recon/ for a task that
 * legitimately collaborates on the shared recon docs). It never appends
 * silently and never disables the commit gate — see commitGate.ts.
 */
import { createTask, listTasks, getTask, setWriteScope } from '../lib/boardroom/tasks';
import type { AgentName, Phase, Priority } from '../lib/boardroom/types';

function flag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'list') {
    const tasks = listTasks();
    if (tasks.length === 0) {
      console.log('No tasks.');
      return;
    }
    for (const t of tasks) {
      console.log(`${t.taskId}  [${t.status}]  ${t.priority}/${t.phase}  ${t.primaryAgent}  ${t.title}`);
    }
    return;
  }

  if (cmd === 'show') {
    const taskId = rest[0];
    const task = taskId ? getTask(taskId) : null;
    if (!task) {
      console.error(`Task not found: ${taskId}`);
      process.exit(1);
    }
    console.log(JSON.stringify(task, null, 2));
    return;
  }

  if (cmd === 'create') {
    const title = flag(rest, 'title');
    const goal = flag(rest, 'goal');
    const priority = (flag(rest, 'priority') || 'MEDIUM') as Priority;
    const phase = (flag(rest, 'phase') || 'PHASE_1_RECON') as Phase;
    const primary = (flag(rest, 'primary') || 'CLAUDE') as AgentName;
    const fallback1 = flag(rest, 'fallback1') as AgentName | undefined;
    const fallback2 = flag(rest, 'fallback2') as AgentName | undefined;
    const category = flag(rest, 'category');
    const scopeRaw = flag(rest, 'scope');
    const testsRaw = flag(rest, 'tests');
    const acceptanceRaw = flag(rest, 'acceptance');
    const checkpointExpectations = flag(rest, 'checkpoint-expectations');

    if (!title || !goal) {
      console.error('Usage: boardroom:task create --title "..." --goal "..." [options]');
      process.exit(1);
    }

    const task = createTask({
      title,
      goal,
      priority,
      phase,
      primaryAgent: primary,
      fallbackAgent1: fallback1,
      fallbackAgent2: fallback2,
      category,
      writeScope: scopeRaw ? scopeRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      testsRequired: testsRaw ? testsRaw.split(',').map((s) => s.trim()).filter(Boolean) : [],
      acceptanceCriteria: acceptanceRaw ? acceptanceRaw.split('|').map((s) => s.trim()).filter(Boolean) : [],
      checkpointExpectations,
    });
    console.log(`Created ${task.taskId}`);
    return;
  }

  if (cmd === 'update-scope') {
    const taskId = rest[0];
    const scopeRaw = flag(rest.slice(1), 'scope');
    if (!taskId || scopeRaw === undefined) {
      console.error('Usage: boardroom:task update-scope <TASK_ID> --scope "path/one,path/two"');
      process.exit(1);
    }
    const before = getTask(taskId);
    if (!before) {
      console.error(`Task not found: ${taskId}`);
      process.exit(1);
    }
    const newScope = scopeRaw.split(',').map((s) => s.trim()).filter(Boolean);
    const updated = setWriteScope(taskId, newScope, undefined);
    console.log(`${taskId} writeScope updated.`);
    console.log(`  before: ${JSON.stringify(before!.writeScope)}`);
    console.log(`  after:  ${JSON.stringify(updated.writeScope)}`);
    return;
  }

  console.error(`Unknown command: ${cmd}. Use "create", "list", "show", or "update-scope".`);
  process.exit(1);
}

main();
