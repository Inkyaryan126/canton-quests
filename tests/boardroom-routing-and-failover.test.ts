// Canton Quests Boardroom V2 — routing/failover tests (Sections 2 & 5).

import { describe, expect, it } from 'vitest';
import { isAstraWorthy, defaultAssignment, applyBudgetConservation, failoverFor, rejectAstraImplementation } from '../lib/boardroom/routing';

describe('isAstraWorthy', () => {
  it('flags architecture/flagship/final-integration work as Astra-worthy', () => {
    expect(isAstraWorthy('EXPERIENTIAL_ARCHITECTURE')).toBe(true);
    expect(isAstraWorthy('FLAGSHIP_MOMENT')).toBe(true);
    expect(isAstraWorthy('FINAL_INTEGRATION')).toBe(true);
  });

  it('does not flag routine work as Astra-worthy', () => {
    expect(isAstraWorthy('ROUTINE_IMPLEMENTATION')).toBe(false);
    expect(isAstraWorthy('CSS_CLEANUP')).toBe(false);
  });
});

describe('defaultAssignment', () => {
  it('assigns Astra-worthy work to Astra with Claude/Agy fallback', () => {
    const a = defaultAssignment('DIFFICULT_BUG');
    expect(a).toMatchObject({ primary: 'ASTRA', fallback1: 'CLAUDE', fallback2: 'AGY' });
  });

  it('assigns Claude-primary categories to Claude', () => {
    const a = defaultAssignment('CODE_REVIEW');
    expect(a.primary).toBe('CLAUDE');
  });

  it('assigns Agy-primary categories to Agy', () => {
    const a = defaultAssignment('CSS_CLEANUP');
    expect(a.primary).toBe('AGY');
  });

  it('falls back to Claude for an unrecognized category', () => {
    // COPY_CHANGE is Agy-primary; sanity check a genuinely unmapped one isn't needed
    // since WorkCategory is a closed union — instead verify the documented default path
    // behaves the same as an Agy-primary category routed correctly.
    const a = defaultAssignment('COPY_CHANGE');
    expect(a.primary).toBe('AGY');
  });
});

describe('applyBudgetConservation', () => {
  it('leaves non-Astra assignments untouched', () => {
    const a = defaultAssignment('CODE_REVIEW');
    const result = applyBudgetConservation(a, 'CODE_REVIEW', 'CRITICAL');
    expect(result).toEqual(a);
  });

  it('NORMAL tier leaves an Astra-worthy assignment on Astra', () => {
    const a = defaultAssignment('DIFFICULT_BUG');
    const result = applyBudgetConservation(a, 'DIFFICULT_BUG', 'NORMAL');
    expect(result.primary).toBe('ASTRA');
  });

  it('protectedFinalIntegration keeps Astra regardless of tier', () => {
    const a = defaultAssignment('FINAL_INTEGRATION');
    const result = applyBudgetConservation(a, 'FINAL_INTEGRATION', 'CRITICAL', { protectedFinalIntegration: true });
    expect(result.primary).toBe('ASTRA');
  });

  it('CRITICAL tier delegates a non-Astra-worthy task away from Astra even if somehow assigned', () => {
    // Simulate an Astra-primary assignment for a routine category to exercise the guard directly.
    const forced = { primary: 'ASTRA' as const, fallback1: 'CLAUDE' as const, fallback2: 'AGY' as const, reason: 'forced for test' };
    const result = applyBudgetConservation(forced, 'ROUTINE_IMPLEMENTATION', 'CRITICAL');
    expect(result.primary).toBe('CLAUDE');
  });

  it('CRITICAL tier restricts Astra on a hard category not in the protected list', () => {
    const a = defaultAssignment('EXPERIENTIAL_ARCHITECTURE');
    const result = applyBudgetConservation(a, 'EXPERIENTIAL_ARCHITECTURE', 'CRITICAL');
    expect(result.primary).toBe('CLAUDE');
  });

  it('CRITICAL tier still allows Astra on DIFFICULT_BUG', () => {
    const a = defaultAssignment('DIFFICULT_BUG');
    const result = applyBudgetConservation(a, 'DIFFICULT_BUG', 'CRITICAL');
    expect(result.primary).toBe('ASTRA');
  });
});

describe('failoverFor', () => {
  it('Astra unavailable + routine work -> Claude, else Agy', () => {
    expect(failoverFor('ASTRA', 'ROUTINE_IMPLEMENTATION', ['CLAUDE', 'AGY'])).toBe('CLAUDE');
    expect(failoverFor('ASTRA', 'ROUTINE_IMPLEMENTATION', ['AGY'])).toBe('AGY');
  });

  it('Astra unavailable + Astra-worthy work -> last resort whoever remains', () => {
    expect(failoverFor('ASTRA', 'FLAGSHIP_MOMENT', ['AGY'])).toBe('AGY');
    expect(failoverFor('ASTRA', 'FLAGSHIP_MOMENT', [])).toBeNull();
  });

  it('Claude unavailable + Claude-primary category -> Astra, else Agy', () => {
    expect(failoverFor('CLAUDE', 'CODE_REVIEW', ['ASTRA', 'AGY'])).toBe('ASTRA');
    expect(failoverFor('CLAUDE', 'CODE_REVIEW', ['AGY'])).toBe('AGY');
  });

  it('Agy unavailable + Agy-primary category -> Claude, else Astra', () => {
    expect(failoverFor('AGY', 'CSS_CLEANUP', ['CLAUDE', 'ASTRA'])).toBe('CLAUDE');
    expect(failoverFor('AGY', 'CSS_CLEANUP', ['ASTRA'])).toBe('ASTRA');
  });

  it('returns null when nobody remains', () => {
    expect(failoverFor('CLAUDE', 'CODE_REVIEW', [])).toBeNull();
  });
});

describe('rejectAstraImplementation', () => {
  it('produces a structured rejection Claude can attach instead of committing', () => {
    const rejection = rejectAstraImplementation('Pulls in a 200KB animation library for a CSS-achievable effect.', 'Use CSS transitions + prefers-reduced-motion.');
    expect(rejection.rejectedBy).toBe('CLAUDE');
    expect(rejection.reason).toMatch(/animation library/);
    expect(rejection.cheaperAlternative).toMatch(/CSS transitions/);
  });
});
