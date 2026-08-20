import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Canton Quests — QR Street Team Canonical Seed Repair Migration (20260814040000)', () => {
  const migrationPath = resolve(
    process.cwd(),
    'supabase/migrations/20260814040000_repair_qr_street_team_canonical_seed.sql'
  );
  const auditPath = resolve(process.cwd(), 'supabase/MIGRATION_AUDIT.sql');

  it('1. Migration file exists and is non-empty', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql.length).toBeGreaterThan(1000);
  });

  it('2. Enforces non-destructive idempotency (no DROP TABLE, no TRUNCATE, no destructive DELETE)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).not.toMatch(/^\s*TRUNCATE\b/im);
    expect(sql).not.toMatch(/^\s*DROP\s+TABLE\b/im);
    expect(sql).not.toMatch(/^\s*DELETE\s+FROM/im);
  });

  it('3. Restores canonical campaign: Canton Quests Street Team 2026', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("'camp-street-team-2026'");
    expect(sql).toContain("'Canton Quests Street Team 2026'");
    expect(sql).toContain("'canton-quests-street-team-2026'");
    expect(sql).toContain("'/quests'");
    expect(sql).toContain("'active'");
  });

  it('4. Restores all 3 canonical flyer variants (Family, Challenge, Secret)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("'flyer-family'");
    expect(sql).toContain("'Family'");
    expect(sql).toContain("'flyer-challenge'");
    expect(sql).toContain("'Challenge'");
    expect(sql).toContain("'flyer-secret'");
    expect(sql).toContain("'Secret'");
  });

  it('5. Restores all 3 canonical distributors (Dustin, Employee 1, Employee 2)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("'dist-dustin'");
    expect(sql).toContain("'Dustin'");
    expect(sql).toContain("'dist-emp-1'");
    expect(sql).toContain("'Employee 1'");
    expect(sql).toContain("'dist-emp-2'");
    expect(sql).toContain("'Employee 2'");
  });

  it('6. Restores all 9 canonical QR code assignments (f1..f3, c1..c3, s1..s3)', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const expectedTrackingSlugs = ['f1', 'f2', 'f3', 'c1', 'c2', 'c3', 's1', 's2', 's3'];
    const expectedQrIds = [
      'cqr-canonical-f1',
      'cqr-canonical-f2',
      'cqr-canonical-f3',
      'cqr-canonical-c1',
      'cqr-canonical-c2',
      'cqr-canonical-c3',
      'cqr-canonical-s1',
      'cqr-canonical-s2',
      'cqr-canonical-s3',
    ];

    for (const slug of expectedTrackingSlugs) {
      expect(sql).toContain(`'${slug}'`);
    }

    for (const qrId of expectedQrIds) {
      expect(sql).toContain(`'${qrId}'`);
    }
  });

  it('7. Handles natural-key conflict resilience and dynamic foreign key resolution', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('SELECT id INTO v_campaign_id FROM public.qr_campaigns');
    expect(sql).toContain('SELECT id INTO v_variant_family_id FROM public.campaign_flyer_variants');
    expect(sql).toContain('SELECT id INTO v_dist_dustin_id FROM public.campaign_distributors');
    expect(sql).toContain('ON CONFLICT (tracking_slug) DO UPDATE SET');
  });

  it('8. MIGRATION_AUDIT.sql contains forensic audit checks for all 13 migrations', () => {
    expect(existsSync(auditPath)).toBe(true);
    const auditSql = readFileSync(auditPath, 'utf8');

    for (let i = 2; i <= 13; i++) {
      expect(auditSql).toContain(`SELECT ${i},`);
    }

    expect(auditSql).toContain('20260814040000_repair_qr_street_team_canonical_seed.sql');
    expect(auditSql).toContain('seed_repair:campaign_street_team_2026');
    expect(auditSql).toContain('seed_repair:campaign_flyer_variants_3');
    expect(auditSql).toContain('seed_repair:campaign_distributors_3');
    expect(auditSql).toContain('seed_repair:campaign_qr_codes_9');
  });
});
