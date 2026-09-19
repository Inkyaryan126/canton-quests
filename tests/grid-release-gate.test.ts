import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function plan(...args: string[]) {
  const raw = execFileSync(
    'node',
    ['./node_modules/vite-node/vite-node.mjs', 'scripts/grid-release-gate.ts', '--plan', ...args],
    { cwd: process.cwd(), encoding: 'utf8' },
  );
  return JSON.parse(raw);
}

describe('Grid release gate', () => {
  it('orders cheap correctness checks before the production build', () => {
    const result = plan();
    expect(result.cleanWorktreeRequired).toBe(true);
    expect(result.steps.map((step: { id: string }) => step.id)).toEqual([
      'coordination',
      'diagnostics',
      'playable-loop',
      'integration-tests',
      'typecheck',
      'lint',
      'diff-check',
      'build',
    ]);
  });

  it('allows an explicit build skip for constrained local verification', () => {
    const result = plan('--skip-build');
    expect(result.skipBuild).toBe(true);
    expect(result.steps.some((step: { id: string }) => step.id === 'build')).toBe(false);
  });

  it('keeps the production build last', () => {
    const result = plan();
    expect(result.steps.at(-1)).toMatchObject({
      id: 'build',
      command: 'npm run build',
    });
  });

  it('runs only the build step with production NODE_ENV', () => {
    const result = plan();

    expect(result.steps.slice(0, -1).every((step: { env?: Record<string, string> }) => !step.env)).toBe(
      true,
    );
    expect(result.steps.at(-1)).toMatchObject({
      id: 'build',
      env: { NODE_ENV: 'production' },
    });
  });

  it('checks playable-loop evidence before integration and build checks', () => {
    const result = plan();
    const ids = result.steps.map((step: { id: string }) => step.id);

    expect(ids.indexOf('playable-loop')).toBeLessThan(ids.indexOf('integration-tests'));
    expect(ids.indexOf('playable-loop')).toBeLessThan(ids.indexOf('build'));
  });
});
