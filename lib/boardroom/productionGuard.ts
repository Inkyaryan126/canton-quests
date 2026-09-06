/**
 * Canton Quests Boardroom V2 — production safety (Section 13).
 *
 * Boardroom may edit locally, test, build, commit (to the overnight
 * branch), and inspect. It must never push to main, run a production DB
 * migration, or deploy — those are Dustin's morning decisions. This is the
 * explicit denylist the supervisor consults before executing any git/deploy
 * action an agent proposes, backing Scenario J (an agent attempts a
 * production deployment).
 */

export type GuardedActionKind = 'git-push' | 'db-migrate' | 'deploy' | 'other';

export interface GuardedAction {
  kind: GuardedActionKind;
  /** For git-push: the target ref/branch; for deploy: environment name; free text otherwise. */
  target?: string;
  remote?: string;
}

export interface GuardResult {
  allowed: boolean;
  reason: string;
}

const PROTECTED_BRANCHES = new Set(['main', 'master']);

export function evaluateGuardedAction(action: GuardedAction): GuardResult {
  switch (action.kind) {
    case 'git-push': {
      const target = (action.target || '').replace(/^refs\/heads\//, '');
      const remote = action.remote || 'origin';
      if (remote === 'origin' && PROTECTED_BRANCHES.has(target)) {
        return { allowed: false, reason: `BLOCKED: push to ${remote}/${target} is a production action reserved for Dustin's morning review.` };
      }
      return { allowed: true, reason: `Push to ${remote}/${target} is not a protected branch.` };
    }
    case 'db-migrate':
      return { allowed: false, reason: 'BLOCKED: production database migrations are never run autonomously.' };
    case 'deploy':
      return { allowed: false, reason: 'BLOCKED: Boardroom never deploys to production automatically. Preview deployments are the only permitted exception, and only if the existing workflow safely supports them.' };
    default:
      return { allowed: true, reason: 'No specific guard rule for this action kind.' };
  }
}

export function isProtectedBranch(branch: string): boolean {
  return PROTECTED_BRANCHES.has(branch);
}

/**
 * Pure mirror of .githooks/pre-push's shell logic, kept here so the
 * decision itself is unit-testable without invoking a real git push. The
 * actual hook (.githooks/pre-push) is the one git really runs; this
 * function documents/verifies the exact same rule.
 */
export function evaluatePrePush(params: { remote: string; remoteRef: string; markerPresent: boolean }): GuardResult {
  const branch = params.remoteRef.replace(/^refs\/heads\//, '');
  if (params.markerPresent && params.remote === 'origin' && PROTECTED_BRANCHES.has(branch)) {
    return { allowed: false, reason: `BLOCKED: autonomous run active, refusing push to ${params.remote}/${branch}.` };
  }
  return { allowed: true, reason: 'No autonomous-run push restriction applies.' };
}
