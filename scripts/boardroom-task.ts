/**
 * Manual task creation/inspection.
 *
 *   npm run boardroom:task -- create --title "..." --goal "..." --priority HIGH \
 *       --phase PHASE_1_RECON --primary CLAUDE [--fallback1 AGY] [--fallback2 ASTRA] \
 *       [--category ROUTINE_IMPLEMENTATION] [--scope "app/foo/,lib/bar.ts"] \
 *       [--tests "npm test,npm run build"]
 *   npm run boardroom:task -- list
 *   npm run boardroom:task -- show <TASK_ID>
 */
import { createTask, listTasks, getTask } from '../lib/boardroom/tasks';
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
    });
    console.log(`Created ${task.taskId}`);
    return;
  }

  console.error(`Unknown command: ${cmd}. Use "create", "list", or "show".`);
  process.exit(1);
}

main();
