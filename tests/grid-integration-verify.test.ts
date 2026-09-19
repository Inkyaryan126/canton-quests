import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import type { GridCityPackage } from '../lib/grid/core/types';
import {
  executeGridLaunchVerification,
  runGridContractDiagnostics,
} from '../scripts/grid-integration-verify';

describe('grid-integration-verify launch diagnostics truth', () => {
  it('truthfully derives PASS for all canonical integrated evidence without stale/not-integrated mislabeling', async () => {
    const report = await executeGridLaunchVerification(process.cwd());

    // In canonical base d659450, no stale baseline failures exist
    expect(report.summary.KNOWN_PREEXISTING_FAILURE).toBe(0);

    // Only genuine future backlog features (matchmaking, tournaments, push, fiat) remain unintegrated
    expect(report.summary.FEATURE_NOT_INTEGRATED_YET).toBe(4);

    // No regressions on merged canonical base
    expect(report.summary.REAL_REGRESSION).toBe(0);

    // At least 16 verified passing subsystems
    expect(report.summary.PASS).toBeGreaterThanOrEqual(16);
    expect(report.readyForIntegration).toBe(true);

    const checkMap = new Map(report.checks.map((c) => [c.id, c]));

    // 1. Database sandbox safety is verified PASS (not mislabeled KNOWN_PREEXISTING_FAILURE)
    const dbCheck = checkMap.get('legacy:live-db-integration');
    expect(dbCheck).toBeDefined();
    expect(dbCheck?.status).toBe('PASS');
    expect(dbCheck?.evidence).toContain('safely mocks database integration');

    // 2. Passport is verified PASS (not omitted or mislabeled)
    const passportCheck = checkMap.get('verify:passport:boundary');
    expect(passportCheck).toBeDefined();
    expect(passportCheck?.status).toBe('PASS');
    expect(passportCheck?.subsystem).toBe('Passport / Multi-City');

    // 3. Alliances is verified PASS (not omitted or mislabeled)
    const allianceCheck = checkMap.get('verify:alliances:membership-boundary');
    expect(allianceCheck).toBeDefined();
    expect(allianceCheck?.status).toBe('PASS');
    expect(allianceCheck?.subsystem).toBe('Alliances');

    // 4. Location Attestation is verified PASS (not mislabeled FEATURE_NOT_INTEGRATED_YET)
    const locationCheck = checkMap.get('verify:location:attestation-boundary');
    expect(locationCheck).toBeDefined();
    expect(locationCheck?.status).toBe('PASS');
    expect(locationCheck?.subsystem).toBe('Location Safety');

    // 5. World Revision is verified PASS (not mislabeled FEATURE_NOT_INTEGRATED_YET)
    const revisionCheck = checkMap.get('verify:world:revision-sync');
    expect(revisionCheck).toBeDefined();
    expect(revisionCheck?.status).toBe('PASS');
    expect(revisionCheck?.subsystem).toBe('Realtime World');

    // 6. Existing canonical journeys and invariants remain PASS
    expect(checkMap.get('verify:geography:canton-package')?.status).toBe('PASS');
    expect(checkMap.get('verify:economy:settlement')?.status).toBe('PASS');
    expect(checkMap.get('verify:contest:signal-dice')?.status).toBe('PASS');
    expect(checkMap.get('verify:market:fixed-price-settlement')?.status).toBe('PASS');
    expect(checkMap.get('verify:security:city-isolation')?.status).toBe('PASS');
    expect(checkMap.get('verify:simulation:deterministic-season')?.status).toBe('PASS');
    expect(checkMap.get('verify:return:briefing')?.status).toBe('PASS');
    expect(checkMap.get('verify:progression:public-ranking')?.status).toBe('PASS');
    expect(checkMap.get('verify:communications:scope')?.status).toBe('PASS');
    expect(checkMap.get('verify:scrimmage:lifecycle')?.status).toBe('PASS');
    expect(checkMap.get('verify:world:projection-boundary')?.status).toBe('PASS');
  });

  it('truthfully reports FEATURE_NOT_INTEGRATED_YET when canonical contracts are absent from disk', async () => {
    // Create an empty temporary directory with no lib/grid modules
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'grid-test-empty-workspace-'));
    try {
      const checks = await runGridContractDiagnostics(cantonFoundingSeasonPackage, tempDir);
      const unintegrated = checks.filter((c) => c.status === 'FEATURE_NOT_INTEGRATED_YET');

      const unintegratedIds = unintegrated.map((c) => c.id);
      expect(unintegratedIds).toContain('feature:passport');
      expect(unintegratedIds).toContain('feature:alliances');
      expect(unintegratedIds).toContain('feature:location-attestation');
      expect(unintegratedIds).toContain('feature:world-revision');

      for (const check of unintegrated) {
        expect(check.evidence).toContain('No');
        expect(check.evidence).toContain('public contract is present on this base');
      }
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('keeps real database safety regressions classified as REAL_REGRESSION without weakening safety', async () => {
    // Inject a forbidden production Supabase URL into the verification environment
    const unsafeEnv = {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: 'https://hdavnmvlnfhcaqjqwrwo.supabase.co',
    };

    const report = await executeGridLaunchVerification(process.cwd(), unsafeEnv);

    expect(report.readyForIntegration).toBe(false);
    expect(report.summary.REAL_REGRESSION).toBeGreaterThanOrEqual(1);

    const checkMap = new Map(report.checks.map((c) => [c.id, c]));
    const dbCheck = checkMap.get('legacy:live-db-integration');
    expect(dbCheck).toBeDefined();
    expect(dbCheck?.status).toBe('REAL_REGRESSION');
    expect(dbCheck?.evidence).toMatch(/TEST SAFETY ABORT|Refusing to run automated tests against Canton Quests production Supabase/);
  });

  it('keeps contract probe exceptions classified as REAL_REGRESSION without hiding regressions', async () => {
    // Pass a package with invalid alliance rules that fail contract validation
    const brokenPackage: GridCityPackage = {
      ...cantonFoundingSeasonPackage,
      seasonTemplate: {
        ...cantonFoundingSeasonPackage.seasonTemplate,
        alliance: {
          ...cantonFoundingSeasonPackage.seasonTemplate.alliance!,
          largeAllianceThreshold: 999, // exceeds maxMembers (6), which violates validateGridAllianceRules
        },
      },
    };

    const checks = await runGridContractDiagnostics(brokenPackage, process.cwd());
    const allianceCheck = checks.find((c) => c.id === 'verify:alliances:membership-boundary');

    expect(allianceCheck).toBeDefined();
    expect(allianceCheck?.status).toBe('REAL_REGRESSION');
    expect(allianceCheck?.evidence).toContain('largeAllianceThreshold cannot exceed maxMembers');
  });

  it('preserves active claims as BLOCKED_BY_ACTIVE_WORK', async () => {
    const report = await executeGridLaunchVerification(process.cwd());
    const blockedChecks = report.checks.filter((c) => c.status === 'BLOCKED_BY_ACTIVE_WORK');

    // Active claims from Control Tower must be tracked as BLOCKED_BY_ACTIVE_WORK
    expect(report.summary.BLOCKED_BY_ACTIVE_WORK).toBe(report.activeClaimsCount);
    expect(blockedChecks.length).toBe(report.activeClaimsCount);
  });
});
