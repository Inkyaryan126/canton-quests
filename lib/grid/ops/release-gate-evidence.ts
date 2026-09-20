import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { coordinationRoot } from '../../agent-control';

export interface GridReleaseGateEvidenceInput {
  passed: boolean;
  buildIncluded: boolean;
  completedSteps: string[];
  failedStep?: string;
  recordedAt?: string;
}

export interface GridReleaseGateEvidenceRecord {
  version: 1;
  kind: 'release-gate';
  status: 'PASS' | 'FAIL';
  integrationRef: string | null;
  integrationCommit: string;
  recordedAt: string;
  summary: string;
  sourceStatus: 'PASS' | 'FAIL';
  buildIncluded: boolean;
  completedSteps: string[];
  failedStep?: string;
}
export function buildGridReleaseGateEvidenceRecord(
  input: GridReleaseGateEvidenceInput,
  identity: { integrationRef: string | null; integrationCommit: string },
): GridReleaseGateEvidenceRecord {
  const fullPass = input.passed && input.buildIncluded;
  const failedStep = input.failedStep?.trim() || undefined;
  let summary: string;

  if (fullPass) {
    summary = `Full release gate PASS: ${input.completedSteps.length} verification steps passed, including the production build.`;
  } else if (!input.buildIncluded) {
    summary = 'Full release gate incomplete: production build was skipped; evidence is not release-verifying.';
  } else if (failedStep) {
    summary = `Full release gate FAIL at ${failedStep}: verification did not complete successfully.`;
  } else {
    summary = 'Full release gate FAIL: verification did not complete successfully.';
  }

  return {
    version: 1,
    kind: 'release-gate',
    status: fullPass ? 'PASS' : 'FAIL',
    integrationRef: identity.integrationRef,
    integrationCommit: identity.integrationCommit,
    recordedAt: input.recordedAt ?? new Date().toISOString(),
    summary,
    sourceStatus: fullPass ? 'PASS' : 'FAIL',    buildIncluded: input.buildIncluded,
    completedSteps: [...input.completedSteps],
    ...(failedStep ? { failedStep } : {}),
  };
}

export function writeGridReleaseGateEvidence(
  input: GridReleaseGateEvidenceInput,
  cwd = process.cwd(),
): GridReleaseGateEvidenceRecord {
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

  const record = buildGridReleaseGateEvidenceRecord(input, {
    integrationRef,
    integrationCommit,
  });
  const evidenceDir = path.join(coordinationRoot(cwd), 'evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });  const target = path.join(evidenceDir, 'release-gate.json');
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(record, null, 2)}\n`);
  fs.renameSync(temporary, target);
  return record;
}
