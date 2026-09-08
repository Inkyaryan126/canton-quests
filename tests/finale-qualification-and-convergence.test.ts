/**
 * Phase 3 finale presentation regression coverage.
 *
 * The mechanics stay covered by founders-cipher-finale.test.ts; this file
 * protects the presentation layer that was recovered from Boardroom salvage.
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');
}

const finalePageSource = read('app/events/[slug]/finale/page.tsx');
const qualificationEffectSource = read('components/game-effects/FinaleQualificationEffect.tsx');

describe('finale qualification presentation', () => {
  it('distinguishes qualified and standby outcomes with the shared status primitive', () => {
    expect(qualificationEffectSource).toMatch(/import SystemStatusBadge from '\.\/SystemStatusBadge'/);
    expect(qualificationEffectSource).toMatch(/status=\{isQualified \? 'confirmed' : 'denied'\}/);
    expect(qualificationEffectSource).toContain('QUALIFIED FOR FINALE');
    expect(qualificationEffectSource).toContain('NOT YET QUALIFIED');
    expect(qualificationEffectSource).toContain('VIEW DRAWING PROJECTION');
    expect(qualificationEffectSource).toContain('CLOSE STATUS');
  });

  it('preserves authoritative drawing details in the qualified reveal', () => {
    expect(qualificationEffectSource).toContain('QUALIFIED TICKETS:');
    expect(qualificationEffectSource).toMatch(/moment\.qualifiedEntries/);
    expect(qualificationEffectSource).toMatch(/moment\.playerLabel/);
    expect(qualificationEffectSource).toMatch(/moment\.ticketRange/);
    expect(qualificationEffectSource).toMatch(/moment\.snapshotHash/);
  });

  it('honors both explicit and system reduced-motion preferences', () => {
    expect(qualificationEffectSource).toMatch(/const systemReduced = useReducedMotion\(\);/);
    expect(qualificationEffectSource).toMatch(/const isReduced = reducedMotion \|\| systemReduced;/);
    expect(qualificationEffectSource).toContain('reducedMotion={isReduced}');
    expect(qualificationEffectSource).toMatch(/\{!isReduced && \(/);
  });
});

describe('master-cipher convergence presentation', () => {
  it('uses covert loading states and shows the complete lock and sigil requirements', () => {
    expect(finalePageSource).toMatch(/import TransmissionLoader from '@\/components\/game-effects\/TransmissionLoader'/);
    expect(finalePageSource).toContain('Establishing Cipher Link...');
    expect(finalePageSource).toContain('Reading Convergence Signal...');
    expect(finalePageSource).toContain('3 Founder Locks');
    expect(finalePageSource).toContain('THE MARK • THE CODE • THE WORD');
    expect(finalePageSource).toContain('District Sigils Decoded');
  });

  it('communicates convergence, solution feedback, and the durable solved outcome', () => {
    expect(finalePageSource).toContain('CONVERGENCE READY');
    expect(finalePageSource).toContain('Submit Your Solution');
    expect(finalePageSource).toMatch(/cqSoundManager\.play\('secret_reveal'\)/);
    expect(finalePageSource).toMatch(/messageId: 'FINAL_SOLUTION_CORRECT'/);
    expect(finalePageSource).toMatch(/messageId: 'MISSION_COMPLETE'/);
    expect(finalePageSource).toContain('MASTER CIPHER SOLVED');
    expect(finalePageSource).toMatch(/finaleStatus\.destinationReveal/);
  });
});
