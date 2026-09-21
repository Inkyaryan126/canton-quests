import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { coordinationRoot, readClaims, scopesOverlap, staleClaim } from '../../agent-control';
import { resolveIntegrationRef } from '../master-board/collect';
import { GRID_V1_FEATURES } from './catalog';
import { readGridV1TestVerification } from './verify';
import type {
  GridV1CompletionBoard,
  GridV1CompletionSummary,
  GridV1FeatureDefinition,
  GridV1FeatureState,
  GridV1RuntimeEvidenceKind,
  GridV1RuntimeEvidenceState,
  GridV1TestEvidenceState,
  GridV1TestVerificationRecord,
} from './types';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function presentAtCommit(cwd: string, commit: string, filePath: string): boolean {
  try {
    execFileSync('git', ['cat-file', '-e', `${commit}:${filePath}`], { cwd, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

type SharedEvidence = {
  status?: string;
  sourceStatus?: string;
  integrationCommit?: string;
  summary?: string;
};

function readRuntimeEvidence(
  cwd: string,
  kind: GridV1RuntimeEvidenceKind,
  canonicalCommit: string,
  acceptedStatuses: string[],
): GridV1RuntimeEvidenceState {
  const filename = path.join(coordinationRoot(cwd), 'evidence', `${kind}.json`);
  let evidence: SharedEvidence | null = null;
  try {
    evidence = JSON.parse(fs.readFileSync(filename, 'utf8')) as SharedEvidence;
  } catch {
    evidence = null;
  }
  const status = evidence?.status ?? evidence?.sourceStatus ?? null;
  const current = evidence?.integrationCommit === canonicalCommit;
  const satisfied = Boolean(status && current && acceptedStatuses.includes(status));
  return {
    kind,
    status,
    current,
    integrationCommit: evidence?.integrationCommit ?? null,
    summary: evidence?.summary ?? `No ${kind} evidence recorded.`,
    satisfied,
  };
}

function testEvidenceFor(
  testPaths: string[],
  canonicalCommit: string,
  record: GridV1TestVerificationRecord | null,
): GridV1TestEvidenceState[] {
  const current = record?.integrationCommit === canonicalCommit;
  return testPaths.map((testPath) => {
    const result = record?.tests[testPath];
    const status: GridV1TestEvidenceState['status'] = result?.status ?? 'MISSING';
    return {
      path: testPath,
      status,
      current,
      satisfied: current && status === 'PASS',
      detail: result?.detail,
    };
  });
}

function activeClaimFor(definition: GridV1FeatureDefinition, cwd: string): string | undefined {
  for (const claim of readClaims(cwd)) {
    if (staleClaim(claim)) continue;
    if (claim.lane === 'grid-v1-completion-board') continue;
    const text = `${claim.lane} ${claim.branch} ${claim.goal}`.toLowerCase();
    if (text.includes(definition.id.toLowerCase())) return claim.lane;
    if (claim.scope.some((claimed) => definition.scopeHints.some((hint) => scopesOverlap(claimed, hint)))) {
      return claim.lane;
    }
  }
  return undefined;
}

function baseState(
  definition: GridV1FeatureDefinition,
  cwd: string,
  canonicalCommit: string,
  testRecord: GridV1TestVerificationRecord | null,
): GridV1FeatureState {
  const missingCode = definition.codePaths.filter((filePath) => !presentAtCommit(cwd, canonicalCommit, filePath));
  const missingTests = definition.testPaths.filter((filePath) => !presentAtCommit(cwd, canonicalCommit, filePath));
  const testEvidence = testEvidenceFor(definition.testPaths, canonicalCommit, testRecord);
  const runtime = (definition.runtimeEvidence ?? []).map((requirement) =>
    readRuntimeEvidence(cwd, requirement.kind, canonicalCommit, requirement.acceptedStatuses));
  const activeClaim = activeClaimFor(definition, cwd);
  const presentCode = definition.codePaths.length - missingCode.length;
  const presentTests = definition.testPaths.length - missingTests.length;
  let status: GridV1FeatureState['status'];

  if (activeClaim) status = 'IN_PROGRESS';
  else if (presentCode === 0 && presentTests === 0) status = 'MISSING';
  else if (missingCode.length > 0 || missingTests.length > 0) status = 'PARTIAL';
  else if (testEvidence.some((item) => !item.satisfied) || runtime.some((item) => !item.satisfied)) status = 'NEEDS_VERIFICATION';
  else status = 'COMPLETE';

  const evidence = [
    `code ${presentCode}/${definition.codePaths.length}`,
    `tests ${presentTests}/${definition.testPaths.length}`,
    `test-runs ${testEvidence.filter((item) => item.satisfied).length}/${testEvidence.length}`,
    ...(runtime.length ? runtime.map((item) => `${item.kind}=${item.satisfied ? 'current-pass' : item.status ?? 'missing'}${item.current ? '' : '-stale'}`) : ['runtime=not-required']),
  ];

  return {
    ...definition,
    status,
    missingCode,
    missingTests,
    testEvidence,
    runtime,
    activeClaim,
    blockedBy: [],
    evidence,
  };
}

export function summarizeGridV1Completion(features: GridV1FeatureState[]): GridV1CompletionSummary {
  const count = (status: GridV1FeatureState['status']) => features.filter((item) => item.status === status).length;
  const complete = count('COMPLETE');
  const total = features.length;
  return {
    complete,
    inProgress: count('IN_PROGRESS'),
    needsVerification: count('NEEDS_VERIFICATION'),
    partial: count('PARTIAL'),
    missing: count('MISSING'),
    blocked: count('BLOCKED'),
    remaining: total - complete,
    total,
    percent: total === 0 ? 0 : Math.round((complete / total) * 100),
  };
}

export function collectGridV1CompletionBoard(options: {
  cwd?: string;
  integrationRef?: string;
  definitions?: GridV1FeatureDefinition[];
} = {}): GridV1CompletionBoard {
  const cwd = options.cwd ?? process.cwd();
  const canonicalRef = resolveIntegrationRef(cwd, options.integrationRef);
  const warnings: string[] = [];
  if (!canonicalRef) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      canonicalRef: null,
      canonicalCommit: null,
      testEvidenceCommit: null,
      summary: summarizeGridV1Completion([]),
      features: [],
      warnings: ['No canonical Grid integration ref could be resolved.'],
    };
  }
  const canonicalCommit = git(cwd, ['rev-parse', canonicalRef]);
  const definitions = options.definitions ?? GRID_V1_FEATURES;
  const testRecord = readGridV1TestVerification(cwd);
  const states = definitions.map((definition) => baseState(definition, cwd, canonicalCommit, testRecord));
  const byId = new Map(states.map((item) => [item.id, item]));

  for (const state of states) {
    const blockedBy = state.dependsOn.filter((id) => byId.get(id)?.status !== 'COMPLETE');
    state.blockedBy = blockedBy;
    if (blockedBy.length > 0 && state.status === 'COMPLETE') {
      state.status = 'BLOCKED';
      state.evidence.push(`blocked by ${blockedBy.join(', ')}`);
    }
  }

  const unknownDependencies = states.flatMap((state) =>
    state.dependsOn.filter((id) => !byId.has(id)).map((id) => `${state.id} -> ${id}`));
  if (unknownDependencies.length) warnings.push(`Unknown completion-board dependencies: ${unknownDependencies.join(', ')}`);
  if (!testRecord) warnings.push('No Grid V1 focused test evidence has been recorded yet.');
  else if (testRecord.integrationCommit !== canonicalCommit) warnings.push(`Grid V1 focused test evidence is stale: ${testRecord.integrationCommit.slice(0, 8)} != ${canonicalCommit.slice(0, 8)}.`);

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    canonicalRef,
    canonicalCommit,
    testEvidenceCommit: testRecord?.integrationCommit ?? null,
    summary: summarizeGridV1Completion(states),
    features: states,
    warnings,
  };
}
