import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { coordinationRoot } from '../../agent-control';

export const GRID_MIGRATIONS_DIR = 'supabase/migrations';

const MIGRATION_FILENAME_PATTERN = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const CANONICAL_INTEGRATION_BRANCH_PATTERN = /^grid-canonical-integration-\d{8}$/;

export type MigrationSafetyStatus = 'SAFE' | 'REVIEW' | 'BLOCKED';
type FindingSeverity = Exclude<MigrationSafetyStatus, 'SAFE'>;

export type MigrationSafetyFindingKind =
  | 'REMOVED_SHIPPED_MIGRATION'
  | 'MODIFIED_SHIPPED_MIGRATION'
  | 'MALFORMED_MIGRATION_FILENAME'
  | 'DUPLICATE_TIMESTAMP_PREFIX'
  | 'NONMONOTONIC_TIMESTAMP'
  | 'DESTRUCTIVE_SQL_STRUCTURAL'
  | 'DESTRUCTIVE_SQL_UNBOUNDED'
  | 'DESTRUCTIVE_SQL_PREDICATED';

export interface MigrationSafetyFinding {
  kind: MigrationSafetyFindingKind;
  severity: FindingSeverity;
  file: string;
  detail: string;
}

export interface MigrationSafetyOptions {
  cwd?: string;
  baseRef?: string;
}

export interface MigrationSafetyReport {
  status: MigrationSafetyStatus;
  baseRef: string;
  baseCommit: string;
  migrationsDir: string;
  addedFiles: string[];
  modifiedFiles: string[];
  removedFiles: string[];
  unchangedFileCount: number;
  findings: MigrationSafetyFinding[];
  generatedAt: string;
  limitations: string[];
}

export interface MigrationSafetyEvidenceRecord {
  version: 1;
  kind: 'migration-safety';
  status: 'PASS' | 'FAIL';
  integrationRef: string | null;
  integrationCommit: string;
  recordedAt: string;
  summary: string;
  sourceStatus: MigrationSafetyStatus;
}

export function buildMigrationSafetyEvidenceRecord(
  report: MigrationSafetyReport,
  identity: { integrationRef: string | null; integrationCommit: string },
): MigrationSafetyEvidenceRecord {
  return {
    version: 1,
    kind: 'migration-safety',
    status: report.status === 'SAFE' ? 'PASS' : 'FAIL',
    integrationRef: identity.integrationRef,
    integrationCommit: identity.integrationCommit,
    recordedAt: report.generatedAt,
    summary: report.status === 'SAFE'
      ? `Migration safety SAFE: ${report.addedFiles.length} added, ${report.modifiedFiles.length} modified, ${report.removedFiles.length} removed; no release-risk findings.`
      : `Migration safety ${report.status}: ${report.findings.length} finding(s) require attention.`,
    sourceStatus: report.status,
  };
}

export function writeMigrationSafetyEvidence(
  report: MigrationSafetyReport,
  cwd = process.cwd(),
): MigrationSafetyEvidenceRecord {
  const integrationCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
  const integrationRef = execFileSync('git', ['branch', '--show-current'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim() || null;
  const record = buildMigrationSafetyEvidenceRecord(report, { integrationRef, integrationCommit });
  const evidenceDir = path.join(coordinationRoot(cwd), 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const target = path.join(evidenceDir, 'migration-safety.json');
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`);
  fs.renameSync(temporary, target);
  return record;
}

export function renderMigrationSafetyReportText(report: MigrationSafetyReport): string {
  const lines = [
    `GRID MIGRATION SAFETY: ${report.status}`,
    `Base ref: ${report.baseRef} @ ${report.baseCommit}`,
    `Migrations dir: ${report.migrationsDir}`,
    `Added: ${report.addedFiles.length} | Modified: ${report.modifiedFiles.length} | Removed: ${report.removedFiles.length} | Unchanged: ${report.unchangedFileCount}`,
  ];

  if (report.findings.length === 0) {
    lines.push('', 'No findings.');
  } else {
    lines.push('', 'Findings:');
    for (const finding of report.findings) {
      lines.push(`- [${finding.severity}] ${finding.kind} ${finding.file}: ${finding.detail}`);
    }
  }

  lines.push('', 'Limitations:');
  for (const limitation of report.limitations) {
    lines.push(`- ${limitation}`);
  }

  return lines.join('\n') + '\n';
}

export const MIGRATION_SAFETY_LIMITATIONS: readonly string[] = [
  'This is static evidence from file names, Git history, and text pattern matching, not a SQL parser.',
  'A SAFE or REVIEW result is not proof a migration will apply cleanly against the real schema (missing dependent objects, lock contention, and RLS interaction are not evaluated).',
  'Destructive SQL detection is a conservative text scan; it can both over-flag safe statements and miss destructive statements written in an unrecognized form.',
  'This gate never runs supabase db push, migration up --linked, or any remote SQL. A local supabase db reset dry run remains required before any production push.',
];

function git(cwd: string, args: string[], allowFailure = false): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

function refExists(cwd: string, ref: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function resolveMigrationSafetyBaseRef(cwd: string, explicitRef?: string): string {
  if (explicitRef) {
    if (!refExists(cwd, explicitRef)) {
      throw new Error(`BASE_REF_UNRESOLVED: --base-ref does not exist: ${explicitRef}`);
    }
    return explicitRef;
  }

  const raw = git(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], true);
  const canonicalCandidates = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((name) => CANONICAL_INTEGRATION_BRANCH_PATTERN.test(name))
    .sort();
  if (canonicalCandidates.length > 0) return canonicalCandidates[canonicalCandidates.length - 1];

  if (refExists(cwd, 'origin/main')) return 'origin/main';
  if (refExists(cwd, 'main')) return 'main';

  throw new Error(
    'BASE_REF_UNRESOLVED: no --base-ref given, no grid-canonical-integration-YYYYMMDD branch, no origin/main, and no local main. Pass --base-ref explicitly.',
  );
}

function readBaseMigrationNames(cwd: string, baseRef: string, migrationsDir: string): string[] {
  let raw: string;
  try {
    raw = execFileSync('git', ['show', `${baseRef}:${migrationsDir}`], { cwd, encoding: 'utf8' });
  } catch {
    return [];
  }
  const lines = raw.split('\n');
  const blankIndex = lines.indexOf('');
  const body = blankIndex === -1 ? lines : lines.slice(blankIndex + 1);
  return body.map((line) => line.trim()).filter((line) => line.length > 0 && line.endsWith('.sql'));
}

function readBaseMigrationContent(cwd: string, baseRef: string, migrationsDir: string, file: string): string {
  return execFileSync('git', ['show', `${baseRef}:${migrationsDir}/${file}`], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function readWorkingMigrationNames(cwd: string, migrationsDir: string): string[] {
  const dir = path.join(cwd, migrationsDir);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name);
}

function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, '');
}

function scanDestructiveSql(file: string, content: string): MigrationSafetyFinding[] {
  const findings: MigrationSafetyFinding[] = [];
  const stripped = stripSqlComments(content);
  const statements = stripped.split(';').map((statement) => statement.trim()).filter(Boolean);

  const structuralPattern = /\bDROP\s+(TABLE|COLUMN|SCHEMA|DATABASE)\b|\bTRUNCATE\b/i;
  const deletePattern = /\bDELETE\s+FROM\b/i;
  const updatePattern = /\bUPDATE\b[\s\S]*\bSET\b/i;
  const wherePattern = /\bWHERE\b/i;

  for (const statement of statements) {
    const snippet = statement.replace(/\s+/g, ' ').slice(0, 140);

    const structuralMatch = statement.match(structuralPattern);
    if (structuralMatch) {
      findings.push({
        kind: 'DESTRUCTIVE_SQL_STRUCTURAL',
        severity: 'BLOCKED',
        file,
        detail: `Structural destructive statement (${structuralMatch[0].toUpperCase()}) requires explicit human review: "${snippet}"`,
      });
      continue;
    }

    const isDelete = deletePattern.test(statement);
    const isUpdate = updatePattern.test(statement);
    if (isDelete || isUpdate) {
      const kindLabel = isDelete ? 'DELETE' : 'UPDATE';
      if (wherePattern.test(statement)) {
        findings.push({
          kind: 'DESTRUCTIVE_SQL_PREDICATED',
          severity: 'REVIEW',
          file,
          detail: `${kindLabel} with a predicate that cannot be proven narrow; requires human review: "${snippet}"`,
        });
      } else {
        findings.push({
          kind: 'DESTRUCTIVE_SQL_UNBOUNDED',
          severity: 'BLOCKED',
          file,
          detail: `${kindLabel} with no WHERE clause (unbounded mutation): "${snippet}"`,
        });
      }
    }
  }

  return findings;
}

const severityRank: Record<MigrationSafetyStatus, number> = { SAFE: 0, REVIEW: 1, BLOCKED: 2 };

export function evaluateGridMigrationSafety(options: MigrationSafetyOptions = {}): MigrationSafetyReport {
  const cwd = options.cwd ?? process.cwd();
  const migrationsDir = GRID_MIGRATIONS_DIR;
  const baseRef = resolveMigrationSafetyBaseRef(cwd, options.baseRef);
  const baseCommit = git(cwd, ['rev-parse', baseRef]);

  const baseNames = new Set(readBaseMigrationNames(cwd, baseRef, migrationsDir));
  const workingNames = readWorkingMigrationNames(cwd, migrationsDir);
  const workingNameSet = new Set(workingNames);

  const removedFiles = [...baseNames].filter((name) => !workingNameSet.has(name)).sort();
  const addedFiles: string[] = [];
  const modifiedFiles: string[] = [];

  for (const name of workingNames) {
    if (!baseNames.has(name)) {
      addedFiles.push(name);
      continue;
    }
    const baseContent = readBaseMigrationContent(cwd, baseRef, migrationsDir, name);
    const workingContent = fs.readFileSync(path.join(cwd, migrationsDir, name), 'utf8');
    if (baseContent !== workingContent) {
      modifiedFiles.push(name);
    }
  }
  addedFiles.sort();
  modifiedFiles.sort();

  const findings: MigrationSafetyFinding[] = [];

  for (const file of removedFiles) {
    findings.push({
      kind: 'REMOVED_SHIPPED_MIGRATION',
      severity: 'BLOCKED',
      file,
      detail: `Migration is present at base ref ${baseRef} but missing from the working tree. Migration files must be append-only.`,
    });
  }

  for (const file of modifiedFiles) {
    findings.push({
      kind: 'MODIFIED_SHIPPED_MIGRATION',
      severity: 'BLOCKED',
      file,
      detail: `Migration content differs from base ref ${baseRef}. A migration already shipped there must not be edited in place; add a new additive migration instead.`,
    });
  }

  const duplicatesByPrefix = new Map<string, string[]>();
  for (const name of workingNames) {
    const match = name.match(MIGRATION_FILENAME_PATTERN);
    if (!match) continue;
    const prefix = match[1];
    const bucket = duplicatesByPrefix.get(prefix) ?? [];
    bucket.push(name);
    duplicatesByPrefix.set(prefix, bucket);
  }

  let baseMaxTimestamp: string | null = null;
  for (const name of baseNames) {
    const match = name.match(MIGRATION_FILENAME_PATTERN);
    if (!match) continue;
    if (baseMaxTimestamp === null || match[1] > baseMaxTimestamp) baseMaxTimestamp = match[1];
  }

  const addedFileSet = new Set(addedFiles);
  for (const name of addedFiles) {
    if (!MIGRATION_FILENAME_PATTERN.test(name)) {
      findings.push({
        kind: 'MALFORMED_MIGRATION_FILENAME',
        severity: 'BLOCKED',
        file: name,
        detail: `New migration filename does not match the required <14-digit timestamp>_<lowercase_snake_case>.sql convention.`,
      });
    }
  }

  for (const [prefix, names] of duplicatesByPrefix) {
    if (names.length < 2) continue;
    const introducedFiles = names.filter((name) => addedFileSet.has(name)).sort();
    if (introducedFiles.length === 0) continue;
    const sortedNames = [...names].sort();
    for (const name of introducedFiles) {
      findings.push({
        kind: 'DUPLICATE_TIMESTAMP_PREFIX',
        severity: 'BLOCKED',
        file: name,
        detail: `New migration timestamp prefix ${prefix} collides with ${sortedNames.length} files: ${sortedNames.join(', ')}.`,
      });
    }
  }

  if (baseMaxTimestamp !== null) {
    for (const file of addedFiles) {
      const match = file.match(MIGRATION_FILENAME_PATTERN);
      if (!match) continue;
      if (match[1] < baseMaxTimestamp) {
        findings.push({
          kind: 'NONMONOTONIC_TIMESTAMP',
          severity: 'BLOCKED',
          file,
          detail: `New migration timestamp ${match[1]} sorts before the latest migration already at base ref ${baseRef} (${baseMaxTimestamp}); it would execute out of order.`,
        });
      }
    }
  }

  for (const file of addedFiles) {
    const content = fs.readFileSync(path.join(cwd, migrationsDir, file), 'utf8');
    findings.push(...scanDestructiveSql(file, content));
  }

  let status: MigrationSafetyStatus = 'SAFE';
  for (const finding of findings) {
    if (severityRank[finding.severity] > severityRank[status]) status = finding.severity;
  }

  return {
    status,
    baseRef,
    baseCommit,
    migrationsDir,
    addedFiles,
    modifiedFiles,
    removedFiles,
    unchangedFileCount: workingNames.length - addedFiles.length - modifiedFiles.length,
    findings,
    generatedAt: new Date().toISOString(),
    limitations: [...MIGRATION_SAFETY_LIMITATIONS],
  };
}
