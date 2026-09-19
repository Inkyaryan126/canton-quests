import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildMigrationSafetyEvidenceRecord,
  evaluateGridMigrationSafety,
  renderMigrationSafetyReportText,
  resolveMigrationSafetyBaseRef,
  writeMigrationSafetyEvidence,
} from '../lib/grid/ops/migration-safety';
import { coordinationRoot } from '../lib/agent-control';

const roots: string[] = [];

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function migrationsDir(root: string): string {
  return path.join(root, 'supabase', 'migrations');
}

function writeMigration(root: string, name: string, content: string): void {
  fs.writeFileSync(path.join(migrationsDir(root), name), content);
}

function removeMigration(root: string, name: string): void {
  fs.rmSync(path.join(migrationsDir(root), name));
}

function repo(): { root: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-migration-safety-'));
  roots.push(root);
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'migsafety@example.com');
  git(root, 'config', 'user.name', 'Migration Safety Test');
  fs.mkdirSync(migrationsDir(root), { recursive: true });
  writeMigration(root, '20260101000000_initial_setup.sql', 'create table public.example (id uuid primary key);\n');
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  return { root };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('Grid migration safety base ref resolution', () => {
  it('fails clearly when nothing can be resolved', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-migration-safety-'));
    roots.push(root);
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'config', 'user.email', 'migsafety@example.com');
    git(root, 'config', 'user.name', 'Migration Safety Test');
    expect(() => resolveMigrationSafetyBaseRef(root)).toThrow(/BASE_REF_UNRESOLVED/);
  });

  it('rejects an explicit --base-ref that does not exist', () => {
    const { root } = repo();
    expect(() => resolveMigrationSafetyBaseRef(root, 'does-not-exist')).toThrow(/BASE_REF_UNRESOLVED/);
    expect(() => evaluateGridMigrationSafety({ cwd: root, baseRef: 'does-not-exist' })).toThrow(/BASE_REF_UNRESOLVED/);
  });

  it('falls back to local main with no canonical branch or origin/main', () => {
    const { root } = repo();
    expect(resolveMigrationSafetyBaseRef(root)).toBe('main');
  });

  it('prefers the latest grid-canonical-integration branch over main', () => {
    const { root } = repo();
    git(root, 'branch', 'grid-canonical-integration-20260101');
    git(root, 'branch', 'grid-canonical-integration-20260119');
    expect(resolveMigrationSafetyBaseRef(root)).toBe('grid-canonical-integration-20260119');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.baseRef).toBe('grid-canonical-integration-20260119');
  });

  it('honors an explicit --base-ref over the canonical default', () => {
    const { root } = repo();
    git(root, 'branch', 'grid-canonical-integration-20260119');
    const report = evaluateGridMigrationSafety({ cwd: root, baseRef: 'main' });
    expect(report.baseRef).toBe('main');
  });
});

describe('Grid migration safety additive and history-integrity checks', () => {
  it('reports SAFE for a clean additive migration', () => {
    const { root } = repo();
    writeMigration(root, '20260101010000_add_widgets_table.sql', 'create table public.widgets (id uuid primary key);\n');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('SAFE');
    expect(report.addedFiles).toEqual(['20260101010000_add_widgets_table.sql']);
    expect(report.findings).toEqual([]);
  });

  it('reports SAFE with zero findings when nothing changed since base ref', () => {
    const { root } = repo();
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('SAFE');
    expect(report.addedFiles).toEqual([]);
    expect(report.modifiedFiles).toEqual([]);
    expect(report.removedFiles).toEqual([]);
  });

  it('blocks a malformed migration filename', () => {
    const { root } = repo();
    writeMigration(root, 'not-a-valid-migration-name.sql', 'create table public.widgets (id uuid primary key);\n');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(
      expect.objectContaining({ kind: 'MALFORMED_MIGRATION_FILENAME', severity: 'BLOCKED', file: 'not-a-valid-migration-name.sql' }),
    );
  });

  it('does not re-block an unchanged duplicate timestamp already present at the base ref', () => {
    const { root } = repo();
    writeMigration(root, '20260101000000_historical_duplicate.sql', 'create table public.historical (id uuid primary key);\n');
    git(root, 'add', '.');
    git(root, 'commit', '-q', '-m', 'historical duplicate baseline');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('SAFE');
    expect(report.findings).toEqual([]);
  });

  it('blocks a new migration that collides with a timestamp already present at the base ref', () => {
    const { root } = repo();
    writeMigration(root, '20260101000000_new_collision.sql', 'create table public.collision (id uuid primary key);\n');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(
      expect.objectContaining({
        kind: 'DUPLICATE_TIMESTAMP_PREFIX',
        severity: 'BLOCKED',
        file: '20260101000000_new_collision.sql',
      }),
    );
  });

  it('blocks duplicate timestamp prefixes', () => {
    const { root } = repo();
    writeMigration(root, '20260101010000_add_widgets.sql', 'create table public.widgets (id uuid primary key);\n');
    writeMigration(root, '20260101010000_add_gadgets.sql', 'create table public.gadgets (id uuid primary key);\n');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('BLOCKED');
    const duplicateFindings = report.findings.filter((finding) => finding.kind === 'DUPLICATE_TIMESTAMP_PREFIX');
    expect(duplicateFindings).toHaveLength(2);
    expect(duplicateFindings.map((finding) => finding.file).sort()).toEqual([
      '20260101010000_add_gadgets.sql',
      '20260101010000_add_widgets.sql',
    ]);
  });

  it('blocks a new migration whose timestamp sorts before the latest base-ref migration', () => {
    const { root } = repo();
    writeMigration(root, '20251231235959_before_base.sql', 'create table public.widgets (id uuid primary key);\n');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(
      expect.objectContaining({ kind: 'NONMONOTONIC_TIMESTAMP', severity: 'BLOCKED', file: '20251231235959_before_base.sql' }),
    );
  });

  it('blocks modification of a migration already present at the base ref', () => {
    const { root } = repo();
    writeMigration(root, '20260101000000_initial_setup.sql', 'create table public.example (id uuid primary key, extra text);\n');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('BLOCKED');
    expect(report.modifiedFiles).toEqual(['20260101000000_initial_setup.sql']);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ kind: 'MODIFIED_SHIPPED_MIGRATION', severity: 'BLOCKED', file: '20260101000000_initial_setup.sql' }),
    );
  });

  it('blocks removal of a migration already present at the base ref', () => {
    const { root } = repo();
    removeMigration(root, '20260101000000_initial_setup.sql');
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.status).toBe('BLOCKED');
    expect(report.removedFiles).toEqual(['20260101000000_initial_setup.sql']);
    expect(report.findings).toContainEqual(
      expect.objectContaining({ kind: 'REMOVED_SHIPPED_MIGRATION', severity: 'BLOCKED', file: '20260101000000_initial_setup.sql' }),
    );
  });
});

describe('Grid migration safety destructive SQL evidence', () => {
  const file = '20260101010000_destructive.sql';

  function reportFor(sql: string) {
    const { root } = repo();
    writeMigration(root, file, sql);
    return evaluateGridMigrationSafety({ cwd: root });
  }

  it('blocks DROP TABLE', () => {
    const report = reportFor('drop table public.widgets;\n');
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'DESTRUCTIVE_SQL_STRUCTURAL', severity: 'BLOCKED', file }));
  });

  it('blocks DROP COLUMN via ALTER TABLE', () => {
    const report = reportFor('alter table public.widgets drop column name;\n');
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'DESTRUCTIVE_SQL_STRUCTURAL', severity: 'BLOCKED', file }));
  });

  it('blocks TRUNCATE', () => {
    const report = reportFor('truncate public.widgets;\n');
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'DESTRUCTIVE_SQL_STRUCTURAL', severity: 'BLOCKED', file }));
  });

  it('blocks an unbounded DELETE', () => {
    const report = reportFor('delete from public.widgets;\n');
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'DESTRUCTIVE_SQL_UNBOUNDED', severity: 'BLOCKED', file }));
  });

  it('blocks an unbounded UPDATE', () => {
    const report = reportFor('update public.widgets set active = false;\n');
    expect(report.status).toBe('BLOCKED');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'DESTRUCTIVE_SQL_UNBOUNDED', severity: 'BLOCKED', file }));
  });

  it('flags a predicated DELETE as REVIEW rather than SAFE or BLOCKED', () => {
    const report = reportFor("delete from public.widgets where id = '00000000-0000-0000-0000-000000000000';\n");
    expect(report.status).toBe('REVIEW');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'DESTRUCTIVE_SQL_PREDICATED', severity: 'REVIEW', file }));
  });

  it('flags a predicated UPDATE as REVIEW rather than SAFE or BLOCKED', () => {
    const report = reportFor("update public.widgets set active = false where id = '00000000-0000-0000-0000-000000000000';\n");
    expect(report.status).toBe('REVIEW');
    expect(report.findings).toContainEqual(expect.objectContaining({ kind: 'DESTRUCTIVE_SQL_PREDICATED', severity: 'REVIEW', file }));
  });

  it('does not flag an additive migration with no destructive statements', () => {
    const report = reportFor('create table public.widgets (id uuid primary key);\ncreate index on public.widgets (id);\n');
    expect(report.status).toBe('SAFE');
    expect(report.findings).toEqual([]);
  });

  it('ignores destructive keywords that only appear in SQL comments', () => {
    const report = reportFor('-- do not drop table public.widgets here\ncreate table public.widgets (id uuid primary key);\n');
    expect(report.status).toBe('SAFE');
    expect(report.findings).toEqual([]);
  });
});

describe('Grid migration safety evidence', () => {
  it('binds SAFE evidence to the exact verified commit', () => {
    const { root } = repo();
    const report = evaluateGridMigrationSafety({ cwd: root });
    const evidence = buildMigrationSafetyEvidenceRecord(report, {
      integrationRef: 'grid-canonical-integration-20260918',
      integrationCommit: 'abc123def456',
    });

    expect(evidence).toMatchObject({
      version: 1,
      kind: 'migration-safety',
      status: 'PASS',
      integrationRef: 'grid-canonical-integration-20260918',
      integrationCommit: 'abc123def456',
      sourceStatus: 'SAFE',
    });
    expect(evidence.summary).toMatch(/Migration safety SAFE/);
  });

  it('writes evidence as git-common bookkeeping bound to the current commit, never to the tracked worktree', () => {
    const { root } = repo();
    const report = evaluateGridMigrationSafety({ cwd: root });
    const evidence = writeMigrationSafetyEvidence(report, root);

    const expectedPath = path.join(coordinationRoot(root), 'evidence', 'migration-safety.json');
    expect(fs.existsSync(expectedPath)).toBe(true);
    expect(expectedPath.startsWith(path.join(root, '.git'))).toBe(true);

    const onDisk = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    expect(onDisk).toMatchObject({
      kind: 'migration-safety',
      status: 'PASS',
      sourceStatus: 'SAFE',
      integrationRef: 'main',
    });
    expect(onDisk.integrationCommit).toBe(evidence.integrationCommit);
    expect(evidence.integrationCommit).toMatch(/^[0-9a-f]{40}$/);
  });
});

describe('Grid migration safety text rendering', () => {
  it('renders a clean report with no findings section collapsed to "No findings."', () => {
    const { root } = repo();
    const report = evaluateGridMigrationSafety({ cwd: root });
    const text = renderMigrationSafetyReportText(report);
    expect(text).toContain('GRID MIGRATION SAFETY: SAFE');
    expect(text).toContain('No findings.');
    expect(text).not.toContain('Findings:');
  });

  it('renders each finding with its severity and detail, and always includes limitations', () => {
    const { root } = repo();
    writeMigration(root, 'not-a-valid-migration-name.sql', 'create table public.widgets (id uuid primary key);\n');
    const report = evaluateGridMigrationSafety({ cwd: root });
    const text = renderMigrationSafetyReportText(report);
    expect(text).toContain('GRID MIGRATION SAFETY: BLOCKED');
    expect(text).toContain('[BLOCKED] MALFORMED_MIGRATION_FILENAME not-a-valid-migration-name.sql');
    expect(text).toContain('Limitations:');
    expect(text).toMatch(/not a SQL parser|supabase db push/i);
  });
});

describe('Grid migration safety report shape', () => {
  it('always includes documented limitations so SAFE is never read as a production guarantee', () => {
    const { root } = repo();
    const report = evaluateGridMigrationSafety({ cwd: root });
    expect(report.limitations.length).toBeGreaterThan(0);
    expect(report.limitations.join(' ')).toMatch(/not a SQL parser|supabase db push/i);
  });
});
