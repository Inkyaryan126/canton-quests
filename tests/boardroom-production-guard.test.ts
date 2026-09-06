// Canton Quests Boardroom V2 — production safety tests (Section 13).

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { evaluateGuardedAction, evaluatePrePush, isProtectedBranch } from '../lib/boardroom/productionGuard';

describe('evaluateGuardedAction', () => {
  it('blocks a push to origin/main', () => {
    const result = evaluateGuardedAction({ kind: 'git-push', target: 'main', remote: 'origin' });
    expect(result.allowed).toBe(false);
  });

  it('blocks a push to origin/master', () => {
    const result = evaluateGuardedAction({ kind: 'git-push', target: 'refs/heads/master', remote: 'origin' });
    expect(result.allowed).toBe(false);
  });

  it('allows a push to a non-protected branch', () => {
    const result = evaluateGuardedAction({ kind: 'git-push', target: 'boardroom/astra-overnight-20260905', remote: 'origin' });
    expect(result.allowed).toBe(true);
  });

  it('allows a push to main on a non-origin remote (e.g. a personal fork remote)', () => {
    const result = evaluateGuardedAction({ kind: 'git-push', target: 'main', remote: 'fork' });
    expect(result.allowed).toBe(true);
  });

  it('always blocks db-migrate', () => {
    expect(evaluateGuardedAction({ kind: 'db-migrate' }).allowed).toBe(false);
  });

  it('always blocks deploy', () => {
    expect(evaluateGuardedAction({ kind: 'deploy', target: 'production' }).allowed).toBe(false);
  });

  it('allows an unrecognized action kind by default', () => {
    expect(evaluateGuardedAction({ kind: 'other' }).allowed).toBe(true);
  });
});

describe('isProtectedBranch', () => {
  it('flags main and master', () => {
    expect(isProtectedBranch('main')).toBe(true);
    expect(isProtectedBranch('master')).toBe(true);
  });

  it('does not flag an overnight branch', () => {
    expect(isProtectedBranch('boardroom/astra-overnight-x')).toBe(false);
  });
});

describe('evaluatePrePush (pure mirror of .githooks/pre-push)', () => {
  it('blocks origin/main while the autonomous marker is present', () => {
    const result = evaluatePrePush({ remote: 'origin', remoteRef: 'refs/heads/main', markerPresent: true });
    expect(result.allowed).toBe(false);
  });

  it('allows origin/main when no autonomous run is active', () => {
    const result = evaluatePrePush({ remote: 'origin', remoteRef: 'refs/heads/main', markerPresent: false });
    expect(result.allowed).toBe(true);
  });

  it('allows pushing the overnight branch itself even while the marker is present', () => {
    const result = evaluatePrePush({ remote: 'origin', remoteRef: 'refs/heads/boardroom/astra-overnight-x', markerPresent: true });
    expect(result.allowed).toBe(true);
  });
});

describe('.githooks/pre-push (the real hook script)', () => {
  const hookPath = path.resolve(__dirname, '..', '.githooks', 'pre-push');

  it('exists and is executable', () => {
    expect(fs.existsSync(hookPath)).toBe(true);
    const mode = fs.statSync(hookPath).mode;
    expect(mode & 0o111).not.toBe(0);
  });

  it('references the autonomous-run marker and blocks main/master pushes', () => {
    const contents = fs.readFileSync(hookPath, 'utf8');
    expect(contents).toMatch(/AUTONOMOUS_RUN_ACTIVE/);
    expect(contents).toMatch(/main/);
  });
});
