import fs from 'node:fs';
import path from 'node:path';

export type GridMigrationReviewCode =
  | 'invalid-grid-migration-name'
  | 'duplicate-migration-version'
  | 'foundation-order'
  | 'security-definer-missing-search-path'
  | 'security-definer-browser-executable'
  | 'security-definer-missing-service-role'
  | 'ledger-direct-mutation'
  | 'ledger-append-only-protection-weakened';

export interface GridMigrationReviewIssue {
  code: GridMigrationReviewCode;
  file: string;
  message: string;
}

export interface GridMigrationReviewReport {
  ok: boolean;
  gridMigrationCount: number;
  issues: GridMigrationReviewIssue[];
}

interface MigrationFile {
  file: string;
  version: string;
  sql: string;
}

const GRID_NAME = /^(\d{14})_grid_[a-z0-9_]+\.sql$/;
const ANY_VERSION = /^(\d{14})_.+\.sql$/;

function normalizedSql(sql: string): string {
  return sql.replace(/--[^\n]*/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function precedingFunctionName(sql: string, securityDefinerIndex: number): string | null {
  const prefix = sql.slice(0, securityDefinerIndex);
  const matches = [...prefix.matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)/gi)];
  return matches.at(-1)?.[1] ?? null;
}

function functionHeader(sql: string, functionName: string): string | null {
  const pattern = new RegExp(
    `create\\s+(?:or\\s+replace\\s+)?function\\s+public\\.${functionName}\\b([\\s\\S]*?)\\bas\\s+\\$\\$`,
    'i',
  );
  return sql.match(pattern)?.[0] ?? null;
}

function reviewSecurityDefiners(migration: MigrationFile): GridMigrationReviewIssue[] {
  const issues: GridMigrationReviewIssue[] = [];
  const lower = migration.sql.toLowerCase();
  const securityDefiners = [...lower.matchAll(/\bsecurity\s+definer\b/g)];
  const checked = new Set<string>();

  for (const match of securityDefiners) {
    const functionName = precedingFunctionName(migration.sql, match.index ?? 0);
    if (!functionName || checked.has(functionName)) continue;
    checked.add(functionName);

    const header = functionHeader(migration.sql, functionName);
    if (!header || !/\bset\s+search_path\s*=/.test(normalizedSql(header))) {
      issues.push({
        code: 'security-definer-missing-search-path',
        file: migration.file,
        message: `SECURITY DEFINER function public.${functionName} must pin search_path.`,
      });
    }

    const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const revokePattern = new RegExp(
      `revoke\\s+all\\s+on\\s+function\\s+public\\.${escaped}\\s*\\([^;]*?\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated\\s*;`,
      'i',
    );
    if (!revokePattern.test(migration.sql)) {
      issues.push({
        code: 'security-definer-browser-executable',
        file: migration.file,
        message: `SECURITY DEFINER function public.${functionName} must revoke PUBLIC, anon, and authenticated before granting execution.`,
      });
    }

    const serviceGrantPattern = new RegExp(
      `grant\\s+execute\\s+on\\s+function\\s+public\\.${escaped}\\s*\\([^;]*?\\)\\s+to\\s+service_role\\s*;`,
      'i',
    );
    if (!serviceGrantPattern.test(migration.sql)) {
      issues.push({
        code: 'security-definer-missing-service-role',
        file: migration.file,
        message: `SECURITY DEFINER function public.${functionName} must grant execution to service_role only.`,
      });
    }

    const unsafeGrantPattern = new RegExp(
      `grant\\s+execute\\s+on\\s+function\\s+public\\.${escaped}\\s*\\([^;]*?\\)\\s+to\\s+(?:public|anon|authenticated)\\b`,
      'i',
    );
    if (unsafeGrantPattern.test(migration.sql)) {
      issues.push({
        code: 'security-definer-browser-executable',
        file: migration.file,
        message: `SECURITY DEFINER function public.${functionName} grants execution to a browser/public role.`,
      });
    }
  }

  return issues;
}

function reviewLedgerProtection(migration: MigrationFile): GridMigrationReviewIssue[] {
  const sql = normalizedSql(migration.sql);
  const issues: GridMigrationReviewIssue[] = [];
  const directMutation = [
    /\bupdate\s+(?:public\.)?grid_game_events\b/,
    /\bdelete\s+from\s+(?:public\.)?grid_game_events\b/,
    /\btruncate(?:\s+table)?\s+(?:public\.)?grid_game_events\b/,
  ].some((pattern) => pattern.test(sql));
  if (directMutation) {
    issues.push({
      code: 'ledger-direct-mutation',
      file: migration.file,
      message: 'Grid migrations must append compensating events instead of mutating grid_game_events history.',
    });
  }

  const weakensProtection = [
    /\bdrop\s+trigger\b[^;]*\bon\s+(?:public\.)?grid_game_events\b/,
    /\balter\s+table\s+(?:public\.)?grid_game_events\s+disable\s+trigger\b/,
    /\bdrop\s+function\s+(?:if\s+exists\s+)?(?:public\.)?grid_reject_game_event_mutation\b/,
  ].some((pattern) => pattern.test(sql));
  if (weakensProtection) {
    issues.push({
      code: 'ledger-append-only-protection-weakened',
      file: migration.file,
      message: 'Grid migration weakens the append-only grid_game_events protection.',
    });
  }
  return issues;
}

export function reviewGridMigrations(migrationsDir: string): GridMigrationReviewReport {
  const names = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  const allByVersion = new Map<string, string[]>();
  for (const name of names) {
    const match = name.match(ANY_VERSION);
    if (!match) continue;
    allByVersion.set(match[1], [...(allByVersion.get(match[1]) ?? []), name]);
  }

  const issues: GridMigrationReviewIssue[] = [];
  const gridMigrations: MigrationFile[] = [];
  for (const name of names.filter((value) => value.includes('_grid_'))) {
    const match = name.match(GRID_NAME);
    if (!match) {
      issues.push({
        code: 'invalid-grid-migration-name',
        file: name,
        message: 'Grid migrations must use a unique 14-digit UTC-style version prefix and snake_case name.',
      });
      continue;
    }
    gridMigrations.push({
      file: name,
      version: match[1],
      sql: fs.readFileSync(path.join(migrationsDir, name), 'utf8'),
    });
  }

  for (const migration of gridMigrations) {
    const sameVersion = allByVersion.get(migration.version) ?? [];
    if (sameVersion.length > 1) {
      issues.push({
        code: 'duplicate-migration-version',
        file: migration.file,
        message: `Migration version ${migration.version} is shared by: ${sameVersion.join(', ')}`,
      });
    }
  }

  const foundation = gridMigrations.find((migration) => migration.file.endsWith('_grid_foundation.sql'));
  if (!foundation || gridMigrations.some((migration) => migration.version < foundation.version)) {
    issues.push({
      code: 'foundation-order',
      file: foundation?.file ?? '(missing)',
      message: 'Grid foundation must exist and be the earliest Grid migration.',
    });
  }

  for (const migration of gridMigrations) {
    issues.push(...reviewSecurityDefiners(migration));
    issues.push(...reviewLedgerProtection(migration));
  }

  return {
    ok: issues.length === 0,
    gridMigrationCount: gridMigrations.length,
    issues,
  };
}

function main(): void {
  const migrationsDir = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.resolve(process.cwd(), 'supabase/migrations');
  const report = reviewGridMigrations(migrationsDir);
  console.log(`Grid migration review: ${report.gridMigrationCount} migrations checked`);
  if (report.ok) {
    console.log('GRID MIGRATION REVIEW OK');
    return;
  }
  for (const issue of report.issues) {
    console.error(`${issue.code}: ${issue.file}: ${issue.message}`);
  }
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) main();
