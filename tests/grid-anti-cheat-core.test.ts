import { describe, expect, it } from 'vitest';
import {
  assessGridAntiCheatRisk,
  deriveGridActionIntegritySignals,
  validateGridAntiCheatPolicy,
} from '../lib/grid/core/anti-cheat';
import type {
  GridAntiCheatPolicy,
  GridAntiCheatSignal,
} from '../lib/grid/core/anti-cheat-types';

const POLICY: GridAntiCheatPolicy = {
  severityWeightBps: { low: 750, medium: 2_000, high: 4_000, critical: 7_000 },
  monitorThresholdBps: 1_000,
  reviewThresholdBps: 3_500,
  hardRejectKinds: [
    'session-actor-mismatch',
    'city-scope-mismatch',
    'season-scope-mismatch',
    'idempotency-collision',
    'impossible-state-transition',
    'resource-conservation-failure',
  ],
};

function signal(overrides: Partial<GridAntiCheatSignal> = {}): GridAntiCheatSignal {
  return {
    id: 'signal-1',
    kind: 'velocity-anomaly',
    severity: 'medium',
    confidenceBps: 8_000,
    source: 'behavior-analysis',
    reasonCode: 'action-velocity',
    ...overrides,
  };
}

describe('Grid anti-cheat foundation', () => {
  it('allows a clean assessment with zero risk', () => {
    expect(assessGridAntiCheatRisk([], POLICY)).toEqual({
      riskScoreBps: 0,
      disposition: 'allow',
      signalIds: [],
      hardRejectSignalIds: [],
    });
  });

  it('derives stable hard signals only for failed authoritative facts', () => {
    const signals = deriveGridActionIntegritySignals({
      actionId: 'attack-42',
      actorMatchesSession: false,
      cityScopeValid: true,
      seasonScopeValid: false,
      idempotencyCollision: true,
      stateTransitionValid: true,
      resourceConservationValid: false,
    });
    expect(signals.map((entry) => entry.kind)).toEqual([
      'idempotency-collision',
      'resource-conservation-failure',
      'season-scope-mismatch',
      'session-actor-mismatch',
    ]);
    expect(signals.every((entry) => entry.source !== 'behavior-analysis')).toBe(true);
  });

  it('rejects the current command when authoritative hard evidence exists', () => {
    const result = assessGridAntiCheatRisk([
      signal({
        id: 'hard-1',
        kind: 'idempotency-collision',
        severity: 'high',
        confidenceBps: 10_000,
        source: 'event-ledger',
      }),
    ], POLICY);
    expect(result.disposition).toBe('reject-command');
    expect(result.hardRejectSignalIds).toEqual(['hard-1']);
  });

  it('never auto-rejects from soft behavioral evidence alone', () => {
    const result = assessGridAntiCheatRisk([
      signal({ id: 'soft-a', severity: 'critical', confidenceBps: 10_000 }),
      signal({ id: 'soft-b', kind: 'collusion-pattern', severity: 'critical', confidenceBps: 10_000 }),
    ], POLICY);
    expect(result.riskScoreBps).toBe(10_000);
    expect(result.disposition).toBe('review');
    expect(result.hardRejectSignalIds).toEqual([]);
  });

  it('moves soft evidence through monitor and review thresholds', () => {
    expect(assessGridAntiCheatRisk([
      signal({ severity: 'medium', confidenceBps: 5_000 }),
    ], POLICY).disposition).toBe('monitor');
    expect(assessGridAntiCheatRisk([
      signal({ id: 'a', severity: 'high', confidenceBps: 10_000 }),
    ], POLICY).disposition).toBe('review');
  });

  it('deduplicates exact repeated evidence without inflating risk', () => {
    const evidence = signal({ id: 'same', severity: 'high', confidenceBps: 10_000 });
    const result = assessGridAntiCheatRisk([evidence, { ...evidence }], POLICY);
    expect(result.riskScoreBps).toBe(4_000);
    expect(result.signalIds).toEqual(['same']);
  });

  it('fails closed when the same evidence id has conflicting content', () => {
    expect(() => assessGridAntiCheatRisk([
      signal({ id: 'same' }),
      signal({ id: 'same', severity: 'critical' }),
    ], POLICY)).toThrow(/conflicting anti-cheat evidence/i);
  });

  it('is deterministic across reordered inputs and does not mutate them', () => {
    const first = signal({ id: 'z', severity: 'low', confidenceBps: 10_000 });
    const second = signal({ id: 'a', severity: 'high', confidenceBps: 5_000 });
    const input = [first, second];
    const before = JSON.stringify(input);
    const forward = assessGridAntiCheatRisk(input, POLICY);
    const reverse = assessGridAntiCheatRisk([second, first], POLICY);
    expect(forward).toEqual(reverse);
    expect(forward.signalIds).toEqual(['a', 'z']);
    expect(JSON.stringify(input)).toBe(before);
  });

  it('validates policy thresholds, weights, and signal confidence', () => {
    expect(() => validateGridAntiCheatPolicy({
      ...POLICY,
      reviewThresholdBps: 500,
    })).toThrow(/threshold/i);
    expect(() => validateGridAntiCheatPolicy({
      ...POLICY,
      severityWeightBps: { ...POLICY.severityWeightBps, critical: 10_001 },
    })).toThrow(/basis points/i);
    expect(() => assessGridAntiCheatRisk([
      signal({ confidenceBps: 0 }),
    ], POLICY)).toThrow(/confidence/i);
  });

  it('refuses to configure behavioral heuristics as hard-reject evidence', () => {
    expect(() => validateGridAntiCheatPolicy({
      ...POLICY,
      hardRejectKinds: ['velocity-anomaly'],
    })).toThrow(/behavioral.*hard reject/i);
  });

  it('returns no integrity signals when all authoritative facts pass', () => {
    expect(deriveGridActionIntegritySignals({
      actionId: 'clean-action',
      actorMatchesSession: true,
      cityScopeValid: true,
      seasonScopeValid: true,
      idempotencyCollision: false,
      stateTransitionValid: true,
      resourceConservationValid: true,
    })).toEqual([]);
  });

  it('caps risk score at 10000 bps when multiple signals saturate the scale', () => {
    // Three critical signals at full confidence each contribute 7000 bps (21000 total) but must cap at 10000
    const result = assessGridAntiCheatRisk([
      signal({ id: 'cap-1', severity: 'critical', confidenceBps: 10_000 }),
      signal({ id: 'cap-2', severity: 'critical', confidenceBps: 10_000 }),
      signal({ id: 'cap-3', severity: 'critical', confidenceBps: 10_000 }),
    ], POLICY);
    expect(result.riskScoreBps).toBe(10_000);
    expect(result.disposition).toBe('review');
    expect(result.signalIds).toEqual(['cap-1', 'cap-2', 'cap-3']);
  });

  it('policy with empty hard-reject list produces at most review for any signals', () => {
    const noHardRejectPolicy: GridAntiCheatPolicy = { ...POLICY, hardRejectKinds: [] };
    validateGridAntiCheatPolicy(noHardRejectPolicy);
    // Authoritative idempotency collision can't auto-reject without policy configuration
    const result = assessGridAntiCheatRisk([
      signal({ id: 'idem', kind: 'idempotency-collision', severity: 'high', source: 'event-ledger', confidenceBps: 10_000 }),
    ], noHardRejectPolicy);
    expect(result.hardRejectSignalIds).toEqual([]);
    expect(result.disposition).toBe('review');
  });

  it('derived integrity signals carry maximum authoritative confidence', () => {
    const signals = deriveGridActionIntegritySignals({
      actionId: 'conf-check',
      actorMatchesSession: false,
      cityScopeValid: false,
      seasonScopeValid: true,
      idempotencyCollision: false,
      stateTransitionValid: true,
      resourceConservationValid: true,
    });
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.confidenceBps === 10_000)).toBe(true);
    expect(signals.every((s) => s.source !== 'behavior-analysis')).toBe(true);
  });

  it('rejects a hard-integrity signal submitted with a non-authoritative source', () => {
    expect(() => assessGridAntiCheatRisk([
      signal({ id: 'bad-src', kind: 'session-actor-mismatch', source: 'behavior-analysis', confidenceBps: 5_000 }),
    ], POLICY)).toThrow(/authoritative source/i);
  });

  it('throws when deriveGridActionIntegritySignals receives a blank actionId', () => {
    expect(() => deriveGridActionIntegritySignals({
      actionId: '   ',
      actorMatchesSession: false,
      cityScopeValid: true,
      seasonScopeValid: true,
      idempotencyCollision: false,
      stateTransitionValid: true,
      resourceConservationValid: true,
    })).toThrow(/actionId/i);
  });

});
