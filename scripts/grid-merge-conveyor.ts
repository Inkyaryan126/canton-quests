import { executeMergeConveyor, planMergeConveyor } from '../lib/grid/ops/merge-conveyor';

function value(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function values(flag: string): string[] {
  const result: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) result.push(process.argv[index + 1]);
  }
  return result;
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function main(): void {
  const options = {
    branch: value('--branch'),
    integrationRef: value('--integration-ref'),
    execute: has('--execute'),
    push: has('--push'),
    retireSource: has('--retire-source'),
    verification: values('--verify'),
  };
  const result = options.execute ? executeMergeConveyor(options) : planMergeConveyor(options);
  console.log(JSON.stringify(result, null, 2));
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ mode: has('--execute') ? 'execute' : 'plan', ok: false, error: message }));
  process.exitCode = 1;
}
