import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AgentClaim } from '../lib/agent-control';
import type { GridMasterBoard } from '../lib/grid/master-board/types';
import {
  collectGridReleaseCandidate,
  evaluateReleaseCandidateStatus,
  getReleaseGatePlan,
  renderReleaseCandidateText,
  type CanonicalCommitSummary,
  type VerificationEvidenceItem,
} from '../lib/grid/ops/release-candidate';
import type { PlayableLoopScore } from '../lib/grid/ops/playable-loop-score';
import type { GridProductionActivationReport } from '../lib/grid/operations/production-activation';

function mockBoard(overrides: Partial<GridMasterBoard> = {}): GridMasterBoard {
  return {
    version: 1,
    health: {
      generatedAt: '2026-09-19T15:00:00.000Z',
      integrationRef: 'grid-canonical-integration-20260918',
      integrationCommit: 'bf9da7de5e4bf55784308602226c39601af6d9d7',
      localMainAvailable: true,
      originMainAvailable: true,
      boardroomAutonomousRunActive: false,
      liveClaimCount: 0,
      staleClaimCount: 0,
      coordinationWarnings: [],
    },
    milestones: [
      {
        id: 'city-compiler',
        title: 'City Compiler',
        phase: 'compiler',
        status: 'INTEGRATED',
        promotion: 'GRID_INTEGRATION',
        detail: 'Integrated in canonical.',
        warnings: [],
      },
      {
        id: 'economy-core',
        title: 'Economy Core',
        phase: 'economy',
        status: 'INTEGRATED',
        promotion: 'GRID_INTEGRATION',
        detail: 'Integrated in canonical.',
        warnings: [],
      },
    ],
    ...overrides,
  };
}

function mockPlayableLoop(overrides: Partial<PlayableLoopScore> = {}): PlayableLoopScore {
  return {
    version: 1,
    score: 100,
    status: 'GREEN',
    stages: [
      {
        id: 'entry',
        title: 'Grid entry',
        weight: 16,
        status: 'GREEN',
        contribution: 16,
        evidence: ['Entry implemented.'],
        source: 'repo-probe',
        verification: 'browser/runtime not yet verified',
      },
    ],
    highestValueBrokenLink: null,
    integrationRef: 'grid-canonical-integration-20260918',
    ...overrides,
  };
}

function mockActivationReport(
  overrides: Partial<GridProductionActivationReport> = {},
): GridProductionActivationReport {
  return {
    status: 'READY_FOR_RELEASE_GATE',
    readyForReleaseGate: true,
    integrationRef: 'grid-canonical-integration-20260918',
    integrationCommit: 'bf9da7de5e4bf55784308602226c39601af6d9d7',
    blockers: [],
    requiredOnFlags: ['GRID_FOUNDATION_ENABLED'],
    requiredOffFlags: ['GRID_PROGRESSION_REBUILD_ENABLED'],
    requiredSecrets: ['GRID_LOCATION_ATTESTATION_SECRET'],
    releaseGateCommand: 'npm run grid:release-gate',
    ...overrides,
  };
}

describe('Grid Release Candidate Manifest', () => {
  describe('Status semantics and transitions', () => {
    it('reports NOT_READY when the worktree is dirty', () => {
      const manifest = collectGridReleaseCandidate({
        cleanWorktree: false,
        dirtyFiles: ['lib/grid/ops/release-candidate.ts'],
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
      });

      expect(manifest.status).toBe('NOT_READY');
      expect(manifest.git.clean).toBe(false);
      expect(manifest.git.dirtyFilesCount).toBe(1);
      expect(manifest.statusSummary).toContain('uncommitted modification');
      expect(manifest.operatorNextAction).toContain('reconcile uncommitted changes');
    });

    it('reports NOT_READY when active Control Tower claims exist', () => {
      const liveClaim: AgentClaim = {
        lane: 'feature-work',
        owner: 'active-coder',
        branch: 'grid-feature-branch',
        goal: 'In progress feature work',
        scope: ['lib/feature/**'],
        worktree: '/tmp/worktree-feature',
        version: 1,
        claimedAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
      };

      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [liveClaim],
      });

      expect(manifest.status).toBe('NOT_READY');
      expect(manifest.coordination.liveClaimsCount).toBe(1);
      expect(manifest.statusSummary).toContain('active Control Tower claim(s) remain open');
      expect(manifest.operatorNextAction).toContain('Wait for active coding streams to complete');
    });

    it('reports NOT_READY when milestones are not integrated', () => {
      const unintegratedBoard = mockBoard({
        milestones: [
          {
            id: 'city-compiler',
            title: 'City Compiler',
            phase: 'compiler',
            status: 'INTEGRATED',
            promotion: 'GRID_INTEGRATION',
            detail: 'Integrated.',
            warnings: [],
          },
          {
            id: 'takeover',
            title: 'Takeover Persistence',
            phase: 'gameplay',
            status: 'IN_PROGRESS',
            promotion: 'SIDE_BRANCH_ONLY',
            detail: 'In progress on side branch.',
            warnings: [],
          },
        ],
      });

      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: unintegratedBoard,
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
      });

      expect(manifest.status).toBe('NOT_READY');
      expect(manifest.milestones.integrated).toBe(1);
      expect(manifest.milestones.total).toBe(2);
      expect(manifest.milestones.percentIntegrated).toBe(50);
      expect(manifest.milestones.unintegrated).toHaveLength(1);
      expect(manifest.milestones.unintegrated[0].id).toBe('takeover');
      expect(manifest.statusSummary).toContain('milestone(s) are not integrated');
      expect(manifest.operatorNextAction).toContain('Merge and integrate remaining milestone branches');
    });

    it('reports NOT_READY when playable loop has a broken link or score < 100', () => {
      const brokenLoop = mockPlayableLoop({
        score: 84,
        status: 'YELLOW',
        highestValueBrokenLink: {
          stageId: 'action',
          title: 'Meaningful action',
          status: 'YELLOW',
          lostPoints: 16,
          recommendation: 'Connect one meaningful action end to end.',
        },
      });

      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: mockBoard(),
        playableLoopScore: brokenLoop,
        productionActivation: mockActivationReport(),
        claims: [],
      });

      expect(manifest.status).toBe('NOT_READY');
      expect(manifest.playableLoop.score).toBe(84);
      expect(manifest.playableLoop.highestValueBrokenLink?.stageId).toBe('action');
      expect(manifest.statusSummary).toContain('Playable loop is YELLOW');
      expect(manifest.operatorNextAction).toContain('Repair the playable loop bottleneck');
    });

    it('reports NOT_READY when production activation preflight is blocked', () => {
      const blockedActivation = mockActivationReport({
        status: 'BLOCKED',
        readyForReleaseGate: false,
        blockers: [
          {
            kind: 'flag-not-enabled',
            key: 'GRID_FOUNDATION_ENABLED',
            detail: 'GRID_FOUNDATION_ENABLED must be explicitly set to 1.',
          },
        ],
      });

      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: blockedActivation,
        claims: [],
      });

      expect(manifest.status).toBe('NOT_READY');
      expect(manifest.activationPreflight.status).toBe('BLOCKED');
      expect(manifest.activationPreflight.blockersCount).toBe(1);
      expect(manifest.statusSummary).toContain('Production activation preflight is BLOCKED');
      expect(manifest.operatorNextAction).toContain('Resolve production activation preflight blockers');
    });

    it('reports NOT_READY when a verification gate has failed', () => {
      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
        verificationEvidence: [
          {
            id: 'release-gate',
            name: 'Full Grid Release Gate',
            status: 'FAILED',
            detail: 'TypeScript compilation failed with 2 errors.',
          },
        ],
      });

      expect(manifest.status).toBe('NOT_READY');
      expect(manifest.statusSummary).toContain('Verification gate(s) failed: Full Grid Release Gate');
      expect(manifest.operatorNextAction).toContain('Investigate and resolve failed verification gate(s)');
    });

    it('reports READY_FOR_VERIFICATION when code is clean and preflights pass but verification is missing or pending', () => {
      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        integrationCommit: 'bf9da7de5e4bf55784308602226c39601af6d9d7',
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
        verificationEvidence: [
          {
            id: 'browser-runtime',
            name: 'Browser Runtime Verification',
            status: 'MISSING',
            detail: 'No canonical browser runtime verification evidence found.',
          },
          {
            id: 'release-gate',
            name: 'Full Grid Release Gate',
            status: 'PENDING',
            detail: 'Release gate has not yet been executed for this candidate commit.',
          },
        ],
      });

      expect(manifest.status).toBe('READY_FOR_VERIFICATION');
      expect(manifest.statusSummary).toContain('Mandatory verification evidence is pending or missing');
      expect(manifest.operatorNextAction).toContain("Run 'npm run grid:release-gate'");
    });

    it('reports READY_FOR_HUMAN_RELEASE_DECISION when all prerequisites and verification gates pass', () => {
      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        integrationCommit: 'bf9da7de5e4bf55784308602226c39601af6d9d7',
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
        verificationEvidence: [
          {
            id: 'browser-runtime',
            name: 'Browser Runtime Verification',
            status: 'VERIFIED',
            detail: 'All 9 player journey stages passed headless browser validation.',
          },
          {
            id: 'migration-safety',
            name: 'Database Migration Safety Gate',
            status: 'VERIFIED',
            detail: 'Migration sequence is continuous with zero dangerous mutations.',
          },
          {
            id: 'release-gate',
            name: 'Full Grid Release Gate',
            status: 'VERIFIED',
            detail: 'Full release gate passed (tests, types, lint, build).',
          },
        ],
      });

      expect(manifest.status).toBe('READY_FOR_HUMAN_RELEASE_DECISION');
      expect(manifest.statusSummary).toContain('All canonical milestones, activation preflights, and verification evidence gates are satisfied');
      expect(manifest.operatorNextAction).toContain('Submit candidate commit (bf9da7de) to human release authority for sign-off. Never auto-deploy.');
    });

    it('never claims production-ready merely because code is integrated', () => {
      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
        verificationEvidence: [
          {
            id: 'browser-runtime',
            name: 'Browser Runtime Verification',
            status: 'MISSING',
            detail: 'No browser runtime evidence for this candidate.',
          },
          {
            id: 'migration-safety',
            name: 'Database Migration Safety Gate',
            status: 'MISSING',
            detail: 'No migration safety evidence for this candidate.',
          },
          {
            id: 'release-gate',
            name: 'Full Grid Release Gate',
            status: 'PENDING',
            detail: 'Release gate has not run for this candidate.',
          },
        ],
      });

      // Even with 100% integrated milestones, status is not PRODUCTION_READY
      expect((manifest.status as string)).not.toBe('PRODUCTION_READY');
      expect(manifest.status).toBe('READY_FOR_VERIFICATION');
    });
  });

  describe('Missing evidence handling & extensibility', () => {
    it('honestly represents missing browser runtime and migration safety evidence in canonical', () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), 'grid-rc-missing-evidence-'));
      try {
        execFileSync('git', ['init', '-b', 'grid-canonical-integration-20260918'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.name', 'Test Operator'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.email', 'operator@test.local'], { cwd: tempDir });
        writeFileSync(path.join(tempDir, 'README.md'), '# Test Grid\n');
        execFileSync('git', ['add', 'README.md'], { cwd: tempDir });
        execFileSync('git', ['commit', '-m', 'GRID Canonical: no evidence yet'], { cwd: tempDir });

        const manifest = collectGridReleaseCandidate({
          cwd: tempDir,
          cleanWorktree: true,
          masterBoard: mockBoard(),
          playableLoopScore: mockPlayableLoop(),
          productionActivation: mockActivationReport(),
          claims: [],
        });

        const browserEvidence = manifest.verificationEvidence.find((e) => e.id === 'browser-runtime');
        const migrationEvidence = manifest.verificationEvidence.find((e) => e.id === 'migration-safety');
        const releaseGateEvidence = manifest.verificationEvidence.find((e) => e.id === 'release-gate');

        expect(browserEvidence?.status).toBe('MISSING');
        expect(migrationEvidence?.status).toBe('MISSING');
        expect(releaseGateEvidence?.status).toBe('PENDING');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('reads commit-bound full release-gate evidence from git-common bookkeeping', () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), 'grid-rc-release-gate-evidence-'));
      try {
        execFileSync('git', ['init', '-b', 'grid-canonical-integration-20260918'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.name', 'Test Operator'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.email', 'operator@test.local'], { cwd: tempDir });
        writeFileSync(path.join(tempDir, 'README.md'), '# Test Grid\n');
        execFileSync('git', ['add', 'README.md'], { cwd: tempDir });
        execFileSync('git', ['commit', '-m', 'GRID Canonical: release gate proof'], { cwd: tempDir });
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).trim();
        const evidenceDir = path.join(tempDir, '.git', 'grid-agent-control', 'evidence');
        mkdirSync(evidenceDir, { recursive: true });
        writeFileSync(path.join(evidenceDir, 'release-gate.json'), JSON.stringify({
          version: 1,
          kind: 'release-gate',
          status: 'PASS',
          integrationCommit: head,
          recordedAt: '2026-09-20T03:10:00.000Z',
          summary: 'Full release gate PASS: all verification steps passed, including the production build.',
          buildIncluded: true,
        }));

        const manifest = collectGridReleaseCandidate({
          cwd: tempDir,
          cleanWorktree: true,
          masterBoard: mockBoard(),
          playableLoopScore: mockPlayableLoop(),
          productionActivation: mockActivationReport(),
          claims: [],
        });
        const releaseGateEvidence = manifest.verificationEvidence.find((e) => e.id === 'release-gate');
        expect(releaseGateEvidence?.status).toBe('VERIFIED');
        expect(releaseGateEvidence?.metadata?.integrationCommit).toBe(head);
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('rejects forged release-gate PASS evidence that did not include a production build', () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), 'grid-rc-release-gate-no-build-'));
      try {
        execFileSync('git', ['init', '-b', 'grid-canonical-integration-20260918'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.name', 'Test Operator'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.email', 'operator@test.local'], { cwd: tempDir });
        writeFileSync(path.join(tempDir, 'README.md'), '# Test Grid\n');
        execFileSync('git', ['add', 'README.md'], { cwd: tempDir });
        execFileSync('git', ['commit', '-m', 'GRID Canonical: invalid gate proof'], { cwd: tempDir });
        const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: tempDir, encoding: 'utf8' }).trim();
        const evidenceDir = path.join(tempDir, '.git', 'grid-agent-control', 'evidence');
        mkdirSync(evidenceDir, { recursive: true });
        writeFileSync(path.join(evidenceDir, 'release-gate.json'), JSON.stringify({
          version: 1,
          kind: 'release-gate',
          status: 'PASS',
          integrationCommit: head,
          recordedAt: '2026-09-20T03:10:00.000Z',
          summary: 'PASS without a build.',
          buildIncluded: false,
        }));

        const manifest = collectGridReleaseCandidate({
          cwd: tempDir,
          cleanWorktree: true,
          masterBoard: mockBoard(),
          playableLoopScore: mockPlayableLoop(),
          productionActivation: mockActivationReport(),
          claims: [],
        });
        const releaseGateEvidence = manifest.verificationEvidence.find((e) => e.id === 'release-gate');
        expect(releaseGateEvidence?.status).toBe('FAILED');
        expect(releaseGateEvidence?.detail).toContain('production build was not included');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('accepts pluggable evidence providers without breaking the output schema', () => {
      const customProvider = () => ({
        id: 'external-security-audit',
        name: 'Third-Party Security Audit',
        status: 'VERIFIED' as const,
        detail: 'Automated cryptographic token check passed.',
      });

      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
        evidenceProviders: [customProvider],
      });

      const customEvidence = manifest.verificationEvidence.find((e) => e.id === 'external-security-audit');
      expect(customEvidence).toBeDefined();
      expect(customEvidence?.status).toBe('VERIFIED');
      expect(customEvidence?.name).toBe('Third-Party Security Audit');
    });
  });

  describe('Release gate plan inspection', () => {
    it('includes all standard release gate steps with build by default', () => {
      const plan = getReleaseGatePlan({ skipBuild: false });
      expect(plan.cleanWorktreeRequired).toBe(true);
      expect(plan.skipBuild).toBe(false);
      expect(plan.steps).toHaveLength(8);
      expect(plan.steps.map((s) => s.id)).toEqual([
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

    it('omits production build step when skipBuild is true', () => {
      const plan = getReleaseGatePlan({ skipBuild: true });
      expect(plan.skipBuild).toBe(true);
      expect(plan.steps).toHaveLength(7);
      expect(plan.steps.some((s) => s.id === 'build')).toBe(false);
    });
  });

  describe('Privacy, safety & secret redaction', () => {
    it('never prints or serializes secret values in manifest output', () => {
      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
        env: {
          GRID_LOCATION_ATTESTATION_SECRET: 'super_secret_production_key_12345678901234567890',
          SUPABASE_SERVICE_ROLE_KEY: 'secret_service_key_do_not_leak',
        },
      });

      const jsonOutput = JSON.stringify(manifest);
      const textOutput = renderReleaseCandidateText(manifest);

      expect(jsonOutput).not.toContain('super_secret_production_key');
      expect(jsonOutput).not.toContain('secret_service_key_do_not_leak');
      expect(textOutput).not.toContain('super_secret_production_key');
      expect(textOutput).not.toContain('secret_service_key_do_not_leak');
    });
  });

  describe('Text and JSON rendering', () => {
    it('renders human-readable text with all required sections', () => {
      const recentCommits: CanonicalCommitSummary[] = [
        {
          commit: 'bf9da7d',
          at: '2026-09-19T10:17:19-04:00',
          summary: 'Merge canonical integration branch',
        },
      ];

      const manifest = collectGridReleaseCandidate({
        cleanWorktree: true,
        integrationCommit: 'bf9da7de5e4bf55784308602226c39601af6d9d7',
        commitSubject: 'Merge canonical integration branch',
        recentCommits,
        masterBoard: mockBoard(),
        playableLoopScore: mockPlayableLoop(),
        productionActivation: mockActivationReport(),
        claims: [],
      });

      const text = renderReleaseCandidateText(manifest);

      expect(text).toContain('# THE GRID — RELEASE CANDIDATE MANIFEST');
      expect(text).toContain('Candidate Status:');
      expect(text).toContain('Conservative Operator Next Action:');
      expect(text).toContain('## 1. Canonical Integration & Git State');
      expect(text).toContain('## 2. Control Tower Coordination');
      expect(text).toContain('## 3. Master Board Milestones');
      expect(text).toContain('## 4. Playable Loop Readiness');
      expect(text).toContain('## 5. Product Director');
      expect(text).toContain('## 6. Production Activation Preflight');
      expect(text).toContain('## 7. Verification Evidence Gates');
      expect(text).toContain('## 8. Planned Release Gate Steps');
      expect(text).toContain('## 9. Recent Canonical Commits');
    });
  });

  describe('Temp Git repository integration', () => {
    it('accurately detects clean and dirty status and parses commits in a real git repository', () => {
      const tempDir = mkdtempSync(path.join(tmpdir(), 'grid-rc-test-'));

      try {
        execFileSync('git', ['init', '-b', 'grid-canonical-integration-20260918'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.name', 'Test Operator'], { cwd: tempDir });
        execFileSync('git', ['config', 'user.email', 'operator@test.local'], { cwd: tempDir });

        writeFileSync(path.join(tempDir, 'README.md'), '# Test Grid\n');
        execFileSync('git', ['add', 'README.md'], { cwd: tempDir });
        execFileSync('git', ['commit', '-m', 'GRID Canonical: initial commit'], { cwd: tempDir });

        const cleanManifest = collectGridReleaseCandidate({
          cwd: tempDir,
          masterBoard: mockBoard(),
          playableLoopScore: mockPlayableLoop(),
          productionActivation: mockActivationReport(),
          claims: [],
        });

        expect(cleanManifest.git.clean).toBe(true);
        expect(cleanManifest.git.dirtyFilesCount).toBe(0);
        expect(cleanManifest.git.commitSubject).toBe('GRID Canonical: initial commit');

        // Dirty the worktree
        writeFileSync(path.join(tempDir, 'scratch.txt'), 'uncommitted work\n');

        const dirtyManifest = collectGridReleaseCandidate({
          cwd: tempDir,
          masterBoard: mockBoard(),
          playableLoopScore: mockPlayableLoop(),
          productionActivation: mockActivationReport(),
          claims: [],
        });

        expect(dirtyManifest.git.clean).toBe(false);
        expect(dirtyManifest.git.dirtyFilesCount).toBe(1);
        expect(dirtyManifest.git.dirtyFiles[0]).toContain('scratch.txt');
        expect(dirtyManifest.status).toBe('NOT_READY');
      } finally {
        rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
