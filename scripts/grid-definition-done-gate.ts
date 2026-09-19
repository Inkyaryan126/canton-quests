import {
  inspectDefinitionDoneGate,
  type DefinitionDoneVerificationEvidence,
} from '../lib/grid/ops/definition-done-gate';

function value(args: string[], name: string): string | undefined {
  const index = args.indexOf('--' + name);
  return index === -1 ? undefined : args[index + 1];
}

function evidenceFlag(args: string[], name: string): boolean | undefined {
  if (args.includes('--' + name + '-passed')) return true;
  if (args.includes('--' + name + '-failed')) return false;
  return undefined;
}

function main(): void {
  const args = process.argv.slice(2);
  const branch = value(args, 'branch');
  if (!branch) {
    throw new Error('Usage: grid-definition-done-gate --branch NAME [--lane NAME] [--integration-ref REF] [verification flags] [--json]');
  }
  const verification: DefinitionDoneVerificationEvidence = {
    focusedTests: evidenceFlag(args, 'focused-tests'),
    diffCheck: evidenceFlag(args, 'diff-check'),
    typecheck: evidenceFlag(args, 'typecheck'),
    lint: evidenceFlag(args, 'lint'),
    build: evidenceFlag(args, 'build'),
  };
  const result = inspectDefinitionDoneGate({
    branch,
    lane: value(args, 'lane'),
    integrationRef: value(args, 'integration-ref'),
    verification,
  });
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    const lines = [
      result.status + ' ' + result.branch,
      'verification: ' + (result.verification.present ? (result.verification.passed ? 'passed' : 'failed') : 'missing'),
      ...(result.blockers.length ? ['blockers: ' + result.blockers.join(', ')] : []),
      'next: ' + result.nextAction,
    ];
    process.stdout.write(lines.join('\n') + '\n');
  }
  if (result.status === 'NOT_READY') process.exitCode = 1;
}

try {
  main();
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n');
  process.exitCode = 1;
}
