/**
 * Canton Quests Boardroom V2 — role hierarchy & failover (Sections 2 & 5).
 *
 * Encoded as data (not just prose in BOARDROOM.md) so routing decisions are
 * testable and Claude can literally reject an Astra implementation via
 * rejectImplementation() when a materially cheaper approach exists.
 */
import { recommendRouting, type RoutingGuidance } from './budget';
import type { AgentName, AstraBudgetTier } from './types';

/** Categories of work, matching the Section 2 "reserve Astra for..." / "do not waste Astra on..." lists. */
export type WorkCategory =
  | 'EXPERIENTIAL_ARCHITECTURE'
  | 'CINEMATIC_UX_SYSTEM'
  | 'MAJOR_CROSS_COMPONENT'
  | 'DIFFICULT_BUG'
  | 'FLAGSHIP_MOMENT'
  | 'FINAL_INTEGRATION'
  | 'FINAL_POLISH'
  | 'HARD_ARCHITECTURAL_DECISION'
  | 'ROUTINE_IMPLEMENTATION'
  | 'REPETITIVE_EDIT'
  | 'BASIC_TEST_WRITING'
  | 'CSS_CLEANUP'
  | 'MUNDANE_BUILD_FIX'
  | 'SCREENSHOT_OR_INVENTORY'
  | 'COPY_CHANGE'
  | 'REPO_RECON'
  | 'PERFORMANCE_AUDIT'
  | 'CODE_REVIEW'
  | 'BACKEND_DATABASE'
  | 'ACCESSIBILITY_VALIDATION';

const ASTRA_WORTHY: ReadonlySet<WorkCategory> = new Set([
  'EXPERIENTIAL_ARCHITECTURE',
  'CINEMATIC_UX_SYSTEM',
  'MAJOR_CROSS_COMPONENT',
  'DIFFICULT_BUG',
  'FLAGSHIP_MOMENT',
  'FINAL_INTEGRATION',
  'FINAL_POLISH',
  'HARD_ARCHITECTURAL_DECISION',
]);

const CLAUDE_PRIMARY: ReadonlySet<WorkCategory> = new Set([
  'REPO_RECON',
  'PERFORMANCE_AUDIT',
  'CODE_REVIEW',
  'BACKEND_DATABASE',
  'ACCESSIBILITY_VALIDATION',
  'MUNDANE_BUILD_FIX',
]);

const AGY_PRIMARY: ReadonlySet<WorkCategory> = new Set([
  'ROUTINE_IMPLEMENTATION',
  'REPETITIVE_EDIT',
  'BASIC_TEST_WRITING',
  'CSS_CLEANUP',
  'SCREENSHOT_OR_INVENTORY',
  'COPY_CHANGE',
]);

export function isAstraWorthy(category: WorkCategory): boolean {
  return ASTRA_WORTHY.has(category);
}

export interface RoutingAssignment {
  primary: AgentName;
  fallback1: AgentName;
  fallback2: AgentName;
  reason: string;
}

/**
 * Section 2 default assignment for a work category, before budget
 * conservation is applied. Astra-worthy work defaults to Astra; everything
 * else defaults to whichever of Claude/Agy is the natural owner.
 */
export function defaultAssignment(category: WorkCategory): RoutingAssignment {
  if (isAstraWorthy(category)) {
    return { primary: 'ASTRA', fallback1: 'CLAUDE', fallback2: 'AGY', reason: `${category} is Astra-worthy (Section 2).` };
  }
  if (CLAUDE_PRIMARY.has(category)) {
    return { primary: 'CLAUDE', fallback1: 'AGY', fallback2: 'ASTRA', reason: `${category} is Claude's senior-engineer lane.` };
  }
  if (AGY_PRIMARY.has(category)) {
    return { primary: 'AGY', fallback1: 'CLAUDE', fallback2: 'ASTRA', reason: `${category} is contained/repetitive — Agy's lane.` };
  }
  return { primary: 'CLAUDE', fallback1: 'AGY', fallback2: 'ASTRA', reason: `${category} has no specific rule; defaulting to Claude.` };
}

/**
 * Applies Astra budget conservation on top of the default assignment:
 * even Astra-worthy work gets delegated once the tier says so, UNLESS the
 * task is explicitly flagged as needing Astra's judgment regardless
 * (e.g. final integration, which Section 6 says to protect regardless of
 * tier by holding back ~25-30% of the allowance for exactly this).
 */
export function applyBudgetConservation(
  assignment: RoutingAssignment,
  category: WorkCategory,
  tier: AstraBudgetTier,
  opts: { protectedFinalIntegration?: boolean } = {}
): RoutingAssignment {
  if (assignment.primary !== 'ASTRA') return assignment;
  const guidance: RoutingGuidance = recommendRouting(tier);

  if (opts.protectedFinalIntegration) return assignment; // Section 6: protect the final ~25-30% for integration regardless.

  const isRoutineForAstra = !isAstraWorthy(category);
  if (isRoutineForAstra && guidance.delegateRoutineWorkAway) {
    return { primary: assignment.fallback1, fallback1: 'AGY', fallback2: 'ASTRA', reason: `${assignment.reason} Delegated: tier=${tier}.` };
  }
  if (tier === 'CRITICAL' && !['DIFFICULT_BUG', 'FINAL_INTEGRATION', 'FINAL_POLISH', 'HARD_ARCHITECTURAL_DECISION'].includes(category)) {
    return { primary: assignment.fallback1, fallback1: assignment.fallback2, fallback2: 'ASTRA', reason: `${assignment.reason} CRITICAL tier: Astra restricted to architect/reviewer/integrator/difficult-bug roles.` };
  }
  return assignment;
}

/**
 * Section 5 failover: given an unavailable agent, who inherits their
 * queued/in-flight work. Distinct from applyBudgetConservation (which is
 * about *routine conservation*), this is about genuine unavailability
 * (crashed, errored, exhausted).
 */
export function failoverFor(unavailable: AgentName, category: WorkCategory, remaining: AgentName[]): AgentName | null {
  if (unavailable === 'ASTRA') {
    // Routine work -> Claude/Agy; Astra-worthy work waits (queued/blocked) rather than being done poorly by a fallback,
    // unless no other option exists and priority forces it.
    if (!isAstraWorthy(category)) {
      return remaining.find((a) => a === 'CLAUDE') ?? remaining.find((a) => a === 'AGY') ?? null;
    }
    return remaining.length > 0 ? remaining[0] : null; // last resort: whoever's left inherits high-value work.
  }
  if (unavailable === 'CLAUDE') {
    // Engineering -> Astra; routine verification -> Agy.
    if (CLAUDE_PRIMARY.has(category)) return remaining.find((a) => a === 'ASTRA') ?? remaining.find((a) => a === 'AGY') ?? null;
    return remaining.find((a) => a === 'AGY') ?? remaining.find((a) => a === 'ASTRA') ?? null;
  }
  // unavailable === 'AGY'
  if (AGY_PRIMARY.has(category)) return remaining.find((a) => a === 'CLAUDE') ?? remaining.find((a) => a === 'ASTRA') ?? null;
  return remaining.find((a) => a === 'CLAUDE') ?? remaining.find((a) => a === 'ASTRA') ?? null;
}

export interface RejectedImplementation {
  rejectedBy: 'CLAUDE';
  reason: string;
  cheaperAlternative: string;
}

/**
 * The literal mechanism behind Section 2's "Claude is allowed to tell the
 * Boardroom: ASTRA IMPLEMENTATION REJECTED". Returns a structured
 * rejection the supervisor can attach to the task instead of committing.
 */
export function rejectAstraImplementation(reason: string, cheaperAlternative: string): RejectedImplementation {
  return { rejectedBy: 'CLAUDE', reason, cheaperAlternative };
}
