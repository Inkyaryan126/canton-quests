// Canton Quests Boardroom V2 — commit-gate tests.
//
// This is the "Boardroom owns every commit" mechanism: an out-of-scope
// change must BLOCK before any test run or commit, never get swept in.

import { describe, expect, it } from 'vitest';
import { evaluateChangedPaths, parseGitStatusShort, isBoardroomBookkeepingPath } from '../lib/boardroom/commitGate';

describe('evaluateChangedPaths', () => {
  it('COMMITs when every changed path is within a declared scope prefix', () => {
    const result = evaluateChangedPaths(['app/foo/', 'lib/bar.ts'], ['app/foo/page.tsx', 'lib/bar.ts']);
    expect(result.decision).toBe('COMMIT');
    expect(result.inScope).toEqual(['app/foo/page.tsx', 'lib/bar.ts']);
    expect(result.outOfScope).toEqual([]);
  });

  it('BLOCKs when any path falls outside the declared scope', () => {
    const result = evaluateChangedPaths(['app/foo/'], ['app/foo/page.tsx', 'app/other/page.tsx']);
    expect(result.decision).toBe('BLOCK');
    expect(result.outOfScope).toEqual(['app/other/page.tsx']);
    expect(result.inScope).toEqual(['app/foo/page.tsx']);
  });

  it('an empty/undeclared writeScope accepts everything, but still enumerates paths explicitly', () => {
    const result = evaluateChangedPaths([], ['app/foo/page.tsx', 'lib/bar.ts']);
    expect(result.decision).toBe('COMMIT');
    expect(result.inScope).toEqual(['app/foo/page.tsx', 'lib/bar.ts']);
  });

  it('a scope prefix without a trailing slash still matches path-prefix style (e.g. a whole directory named as a bare prefix)', () => {
    const result = evaluateChangedPaths(['lib/boardroom'], ['lib/boardroom/tasks.ts']);
    expect(result.decision).toBe('COMMIT');
  });

  it('does not falsely match a sibling directory that merely shares a prefix string', () => {
    const result = evaluateChangedPaths(['lib/board'], ['lib/boardroom/x.ts']);
    expect(result.decision).toBe('BLOCK');
    expect(result.outOfScope).toEqual(['lib/boardroom/x.ts']);
  });

  it('an exact-file scope entry matches only that file', () => {
    const result = evaluateChangedPaths(['lib/bar.ts'], ['lib/bar.ts', 'lib/bar2.ts']);
    // 'lib/bar2.ts'.startsWith('lib/bar.ts') is false, so this correctly BLOCKs.
    expect(result.decision).toBe('BLOCK');
    expect(result.outOfScope).toEqual(['lib/bar2.ts']);
  });

  it('no changed paths at all is trivially COMMIT with empty inScope', () => {
    const result = evaluateChangedPaths(['app/foo/'], []);
    expect(result.decision).toBe('COMMIT');
    expect(result.inScope).toEqual([]);
  });
});

describe('isBoardroomBookkeepingPath', () => {
  it('flags .boardroom/runtime, boardroom/handoffs, and boardroom/reports paths', () => {
    expect(isBoardroomBookkeepingPath('.boardroom/runtime/write-lock.json')).toBe(true);
    expect(isBoardroomBookkeepingPath('boardroom/handoffs/TASK-1.md')).toBe(true);
    expect(isBoardroomBookkeepingPath('boardroom/reports/MORNING_REPORT.md')).toBe(true);
  });

  it('does not flag an agent-authored path, even one that happens to live under boardroom/', () => {
    expect(isBoardroomBookkeepingPath('app/foo/page.tsx')).toBe(false);
    expect(isBoardroomBookkeepingPath('boardroom/BOARDROOM.md')).toBe(false);
  });
});

describe('parseGitStatusShort', () => {
  it('parses modified/added/deleted lines to bare paths', () => {
    const output = [' M app/foo/page.tsx', 'A  lib/bar.ts', 'D  old-file.ts', ''].join('\n');
    expect(parseGitStatusShort(output)).toEqual(['app/foo/page.tsx', 'lib/bar.ts', 'old-file.ts']);
  });

  it('resolves a rename line to the new path', () => {
    const output = 'R  old/path.ts -> new/path.ts';
    expect(parseGitStatusShort(output)).toEqual(['new/path.ts']);
  });

  it('handles an empty status (no changes)', () => {
    expect(parseGitStatusShort('')).toEqual([]);
    expect(parseGitStatusShort('   \n  \n')).toEqual([]);
  });

  it('handles untracked files (?? prefix)', () => {
    expect(parseGitStatusShort('?? new-file.ts')).toEqual(['new-file.ts']);
  });
});
