/**
 * Canton Quests — Phase 3 Flagship Moment Tests
 * Founder's Cipher Finale Sequence: Qualification + Master Convergence
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  getConvergenceStage,
  getConvergenceTelemetry,
  checkFinaleEligibility,
  evaluateFinaleSubmission,
  FinaleConfig,
} from '../lib/finale';
import { proofDigest } from '../lib/quest-proof-secrets';

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');
}

const finalePageSource = read('app/events/[slug]/finale/page.tsx');
const qualificationEffectSource = read('components/game-effects/FinaleQualificationEffect.tsx');
const verifierPanelSource = read('components/drawing/FinalQuestVerifierPanel.tsx');

function makeConfig(overrides: Partial<FinaleConfig> = {}): FinaleConfig {
  return {
    eventId: '11111111-1111-4111-8111-111111111111',
    requiredSigilCount: 3,
    requiresWatcherEligibility: false,
    masterCipherCluePieces: ['First fragment of the cipher.', 'Second fragment of the cipher.'],
    finalAnswerHash: `sha256:${proofDigest('CONVERGENCE')}`,
    finalDestinationReveal: 'Meet at Monument Park at dawn.',
    opensAt: null,
    closesAt: null,
    falseFinaleEnabled: false,
    falseFinaleAnswerHash: null,
    falseFinaleRevealText: null,
    ...overrides,
  };
}

describe('Checkpoint 1: Finale Qualification Moment — Both Outcomes & Reduced Motion', () => {
  it('FinaleQualificationEffect uses SystemStatusBadge with confirmed for qualified players and denied/standby for non-qualified players', () => {
    expect(qualificationEffectSource).toMatch(/import SystemStatusBadge from '\.\/SystemStatusBadge'/);
    expect(qualificationEffectSource).toMatch(/status=\{isQualified \? 'confirmed' : 'denied'\}/);
    expect(qualificationEffectSource).toMatch(/label=\{isQualified \? 'OFFICIAL FINALE DRAWING: QUALIFIED' : 'OFFICIAL FINALE DRAWING: STANDBY'\}/);
  });

  it('FinaleQualificationEffect triggers tactical audio and haptic feedback on qualification, and neutral scan audio without haptics on standby', () => {
    expect(qualificationEffectSource).toMatch(/cqSoundManager\.play\('finale_qualified'\)/);
    expect(qualificationEffectSource).toMatch(/confirmHaptic\(\{ enabled: true \}\)/);
    expect(qualificationEffectSource).toMatch(/cqSoundManager\.play\('scan'\)/);
  });

  it('FinaleQualificationEffect presents qualified state with distinct high-polish details: tickets, callsign, ticket range, and ledger proof', () => {
    expect(qualificationEffectSource).toMatch(/QUALIFIED FOR FINALE/);
    expect(qualificationEffectSource).toMatch(/QUALIFIED TICKETS:/);
    expect(qualificationEffectSource).toMatch(/moment\.qualifiedEntries/);
    expect(qualificationEffectSource).toMatch(/moment\.playerLabel/);
    expect(qualificationEffectSource).toMatch(/moment\.ticketRange/);
    expect(qualificationEffectSource).toMatch(/moment\.snapshotHash/);
    expect(qualificationEffectSource).toMatch(/VIEW DRAWING PROJECTION/);
  });

  it('FinaleQualificationEffect presents non-qualifying standby state clearly and constructively without a broken or confusing state', () => {
    expect(qualificationEffectSource).toMatch(/NOT YET QUALIFIED/);
    expect(qualificationEffectSource).toMatch(/DRAWING ENTRIES:/);
    expect(qualificationEffectSource).toMatch(/Complete at least 1 verified quest in Canton to earn drawing tickets/);
    expect(qualificationEffectSource).toMatch(/CLOSE STATUS/);
  });

  it('FinaleQualificationEffect respects reduced motion via prop and useReducedMotion hook, suppressing motion animations and reducing particle load', () => {
    expect(qualificationEffectSource).toMatch(/useReducedMotion/);
    expect(qualificationEffectSource).toMatch(/const systemReduced = useReducedMotion\(\);/);
    expect(qualificationEffectSource).toMatch(/const isReduced = reducedMotion \|\| systemReduced;/);
    // Ping animation guarded behind !isReduced
    expect(qualificationEffectSource).toMatch(/\{!isReduced && \(/);
    // Reduced particle counts
    expect(qualificationEffectSource).toContain('count={isQualified ? (isReduced ? 16 : 55) : (isReduced ? 8 : 24)}');
  });
});

describe('Checkpoint 2: Master Convergence Telemetry & Logic', () => {
  it('getConvergenceTelemetry derives accurate progress and labels for each stage without modifying qualification rules', () => {
    const t0 = getConvergenceTelemetry(0);
    expect(t0.stage).toBe('no_sigils');
    expect(t0.percent).toBe(0);
    expect(t0.sigilsNeeded).toBe(3);
    expect(t0.isConvergenceReady).toBe(false);
    expect(t0.label).toBe('CIPHER DORMANT');

    const t1 = getConvergenceTelemetry(1);
    expect(t1.stage).toBe('one_sigil');
    expect(t1.percent).toBe(33);
    expect(t1.sigilsNeeded).toBe(2);
    expect(t1.isConvergenceReady).toBe(false);
    expect(t1.label).toBe('INITIAL RESONANCE');

    const t2 = getConvergenceTelemetry(2);
    expect(t2.stage).toBe('two_sigils');
    expect(t2.percent).toBe(67);
    expect(t2.sigilsNeeded).toBe(1);
    expect(t2.isConvergenceReady).toBe(false);
    expect(t2.label).toBe('HARMONIC ALIGNMENT');

    const t3 = getConvergenceTelemetry(3);
    expect(t3.stage).toBe('convergence_ready');
    expect(t3.percent).toBe(100);
    expect(t3.sigilsNeeded).toBe(0);
    expect(t3.isConvergenceReady).toBe(true);
    expect(t3.label).toBe('CONVERGENCE READY');

    // Handles counts above 3 gracefully
    const t4 = getConvergenceTelemetry(5);
    expect(t4.stage).toBe('convergence_ready');
    expect(t4.percent).toBe(100);
    expect(t4.sigilsNeeded).toBe(0);
    expect(t4.isConvergenceReady).toBe(true);
  });

  it('existing qualification rules remain strictly intact and authoritative', () => {
    // Missing locks
    expect(checkFinaleEligibility(makeConfig(), 3, false, false, false).ok).toBe(false);
    // Insufficient sigils
    expect(checkFinaleEligibility(makeConfig(), 2, true, false, false).ok).toBe(false);
    // Unconfigured
    expect(checkFinaleEligibility(makeConfig({ finalAnswerHash: null }), 3, true, false, false).ok).toBe(false);
    // Closed
    expect(checkFinaleEligibility(makeConfig({ closesAt: new Date(Date.now() - 1000).toISOString() }), 3, true, false, false).ok).toBe(false);
    // Fully eligible
    expect(checkFinaleEligibility(makeConfig(), 3, true, false, false).ok).toBe(true);
  });

  it('evaluateFinaleSubmission evaluates answers accurately and idempotently', () => {
    const config = makeConfig();
    expect(evaluateFinaleSubmission(config, { falseFinaleSolvedAt: null, completedAt: null }, 'WRONG').stage).toBe('incorrect');
    expect(evaluateFinaleSubmission(config, { falseFinaleSolvedAt: null, completedAt: null }, 'CONVERGENCE').stage).toBe('completed');
    expect(evaluateFinaleSubmission(config, { falseFinaleSolvedAt: null, completedAt: '2026-09-07T00:00:00Z' }, 'CONVERGENCE').stage).toBe('already_completed');
  });
});

describe('Checkpoint 3: Master Convergence Presentation & Page Wiring', () => {
  it('finale page uses TransmissionLoader for covert-ops loading moments instead of bare spinning divs', () => {
    expect(finalePageSource).toMatch(/import TransmissionLoader from '@\/components\/game-effects\/TransmissionLoader'/);
    expect(finalePageSource).toMatch(/TransmissionLoader label="Establishing Cipher Link\.\.\."/);
    expect(finalePageSource).toMatch(/TransmissionLoader label="Entering Mission\.\.\."/);
    expect(finalePageSource).toMatch(/TransmissionLoader label="Reading Convergence Signal\.\.\."/);
  });

  it('locked state presents diagnostic breakdown of 3 Founder Locks and District Sigils with clear recovery path', () => {
    expect(finalePageSource).toMatch(/3 Founder Locks/);
    expect(finalePageSource).toMatch(/THE MARK • THE CODE • THE WORD/);
    expect(finalePageSource).toMatch(/District Sigils Decoded/);
    expect(finalePageSource).toMatch(/CONTINUE OPERATION →/);
  });

  it('ready state presents Recovered Intel clue pieces and armed Master Cipher solution console', () => {
    expect(finalePageSource).toMatch(/Recovered Intel/);
    expect(finalePageSource).toMatch(/Clue Pieces/);
    expect(finalePageSource).toMatch(/CONVERGENCE READY/);
    expect(finalePageSource).toMatch(/Submit Your Solution/);
    expect(finalePageSource).toMatch(/Enter the final decode/);
  });

  it('solution submission provides tactical audio feedback and chains completion messages into durable solved reveal', () => {
    expect(finalePageSource).toMatch(/cqSoundManager\.play\('ui_confirm'\)/);
    expect(finalePageSource).toMatch(/cqSoundManager\.play\('secret_reveal'\)/);
    expect(finalePageSource).toMatch(/confirmHaptic\(\{ enabled: true \}\)/);
    expect(finalePageSource).toMatch(/messageId: 'FINAL_SOLUTION_CORRECT'/);
    expect(finalePageSource).toMatch(/messageId: 'MISSION_COMPLETE'/);
  });

  it('solved state persistently presents the celebratory outcome and final destination reveal', () => {
    expect(finalePageSource).toMatch(/MASTER CIPHER SOLVED/);
    expect(finalePageSource).toMatch(/CIPHER_SOLVED/);
    expect(finalePageSource).toMatch(/Final Reveal/);
    expect(finalePageSource).toMatch(/finaleStatus\.destinationReveal/);
    expect(finalePageSource).toMatch(/VIEW TRANSMISSIONS/);
    expect(finalePageSource).toMatch(/RETURN TO MISSION/);
  });
});

describe('Checkpoint 4: FinalQuestVerifierPanel Sound and Haptic Integration', () => {
  it('FinalQuestVerifierPanel connects cqSoundManager and confirmHaptic to copy, calculate, and reset actions', () => {
    expect(verifierPanelSource).toMatch(/import \{ cqSoundManager \} from '@\/lib\/audio'/);
    expect(verifierPanelSource).toMatch(/import \{ confirmHaptic \} from '@\/lib\/motion'/);
    expect(verifierPanelSource).toMatch(/cqSoundManager\.play\('ui_confirm'\)/);
    expect(verifierPanelSource).toMatch(/confirmHaptic\(\{ enabled: true \}\)/);
    expect(verifierPanelSource).toMatch(/cqSoundManager\.play\('ui_error'\)/);
    expect(verifierPanelSource).toMatch(/cqSoundManager\.play\('ui_click'\)/);
  });
});
