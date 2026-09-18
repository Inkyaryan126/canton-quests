import type {
  GridMilestoneDefinition,
  GridMilestoneEvidence,
  GridMilestoneState,
  GridPromotionStatus,
} from './types';

function integratedPromotion(evidence: GridMilestoneEvidence): GridPromotionStatus {
  const matches = evidence.integrationMatches;
  if (matches.some((item) => item.onOriginMain)) return 'ORIGIN_MAIN';
  if (matches.some((item) => item.onLocalMain)) return 'LOCAL_MAIN';
  return 'GRID_INTEGRATION';
}

export function classifyMilestone(
  definition: GridMilestoneDefinition,
  evidence: GridMilestoneEvidence,
): GridMilestoneState {
  const base = {
    id: definition.id,
    title: definition.title,
    phase: definition.phase,
    warnings: [...evidence.warnings],
  };

  if (evidence.contradictions.length > 0) {
    return {
      ...base,
      status: 'UNKNOWN',
      promotion: 'DEPLOYMENT_UNKNOWN',
      detail: evidence.contradictions.join('; '),
    };
  }
  const integrated = evidence.integrationMatches[0];
  if (integrated) {
    return {
      ...base,
      status: 'INTEGRATED',
      promotion: integratedPromotion(evidence),
      detail: `Integrated via ${integrated.commit}: ${integrated.subject}`,
      evidenceCommit: integrated.commit,
      evidenceSubject: integrated.subject,
    };
  }

  const active = evidence.activeClaims.find((claim) => !claim.stale);
  if (active) {
    const staleCount = evidence.activeClaims.filter((claim) => claim.stale).length;
    return {
      ...base,
      status: 'IN_PROGRESS',
      promotion: 'SIDE_BRANCH_ONLY',
      detail: `Active lane ${active.lane} owned by ${active.owner}`,
      owner: active.owner,
      branch: active.branch,
      warnings: staleCount > 0 ? [...base.warnings, `${staleCount} stale claim(s) also matched`] : base.warnings,
    };
  }

  const staleClaims = evidence.activeClaims.filter((claim) => claim.stale);
  const completedBranches = evidence.branches.filter((branch) => branch.completionCommit && !branch.mergedIntoIntegration);
  const cleanCompleted = completedBranches.find((branch) => branch.clean);
  if (cleanCompleted) {
    const promotion: GridPromotionStatus = cleanCompleted.onOriginMain
      ? 'ORIGIN_MAIN'
      : cleanCompleted.onLocalMain
        ? 'LOCAL_MAIN'
        : 'SIDE_BRANCH_ONLY';
    return {
      ...base,
      status: 'READY_TO_INTEGRATE',
      promotion,
      detail: `Completed on clean branch ${cleanCompleted.branch}`,
      branch: cleanCompleted.branch,
      evidenceCommit: cleanCompleted.completionCommit,
      evidenceSubject: cleanCompleted.completionSubject,
      warnings: staleClaims.length > 0 ? [...base.warnings, `${staleClaims.length} stale claim(s) matched`] : base.warnings,
    };
  }

  if (completedBranches.length > 0) {
    return {
      ...base,
      status: 'DIRTY_DORMANT',
      promotion: 'SIDE_BRANCH_ONLY',
      detail: `Completion evidence exists only on dirty branch ${completedBranches[0].branch}`,
      branch: completedBranches[0].branch,
      warnings: [...base.warnings, 'Dirty completed branch is not safe to integrate'],
    };
  }

  if (evidence.rejected && evidence.rejected.length > 0) {
    return {
      ...base,
      status: 'REJECTED',
      promotion: 'DEPLOYMENT_UNKNOWN',
      detail: evidence.rejected.join('; '),
      warnings: staleClaims.length > 0 ? [...base.warnings, `${staleClaims.length} stale claim(s) matched`] : base.warnings,
    };
  }

  if (evidence.blockers.length > 0) {
    return {
      ...base,
      status: 'BLOCKED',
      promotion: 'DEPLOYMENT_UNKNOWN',
      detail: evidence.blockers.join('; '),
      warnings: staleClaims.length > 0 ? [...base.warnings, `${staleClaims.length} stale claim(s) matched`] : base.warnings,
    };
  }
  return {
    ...base,
    status: 'PLANNED',
    promotion: 'DEPLOYMENT_UNKNOWN',
    detail: 'No implementation evidence found',
    warnings: staleClaims.length > 0 ? [...base.warnings, `${staleClaims.length} stale claim(s) matched`] : base.warnings,
  };
}

export function applyDependencyBlockers(
  definitions: GridMilestoneDefinition[],
  states: GridMilestoneState[],
): GridMilestoneState[] {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  let next = states.map((state) => ({ ...state, warnings: [...state.warnings] }));

  for (let pass = 0; pass < definitions.length; pass += 1) {
    const statesById = new Map(next.map((state) => [state.id, state]));
    let changed = false;

    next = next.map((state) => {
      if (state.status !== 'PLANNED') return state;
      const definition = definitionsById.get(state.id);
      if (!definition) return state;

      const blockedDependencies = definition.dependsOn
        .map((id) => statesById.get(id))
        .filter((dependency): dependency is GridMilestoneState => dependency?.status === 'BLOCKED' || dependency?.status === 'REJECTED');

      if (blockedDependencies.length === 0) return state;
      changed = true;
      return {
        ...state,
        status: 'BLOCKED',
        promotion: 'DEPLOYMENT_UNKNOWN',
        detail: `Blocked by prerequisite: ${blockedDependencies.map((item) => item.title).join(', ')}`,
      };
    });

    if (!changed) break;
  }

  return next;
}

export function promoteSafeNextWork(
  definitions: GridMilestoneDefinition[],
  states: GridMilestoneState[],
): GridMilestoneState[] {
  const definitionsById = new Map(definitions.map((definition) => [definition.id, definition]));
  const statesById = new Map(states.map((state) => [state.id, state]));

  return states.map((state) => {
    if (state.status !== 'PLANNED') return state;
    const definition = definitionsById.get(state.id);
    if (!definition) return state;

    const allIntegrated = definition.dependsOn.every((id) => {
      const dep = statesById.get(id);
      return dep?.status === 'INTEGRATED';
    });

    if (!allIntegrated) return state;

    return {
      ...state,
      status: 'SAFE_NEXT_WORK',
      detail: definition.dependsOn.length > 0
        ? `Ready to claim; all prerequisites integrated (${definition.dependsOn.join(', ')})`
        : 'Ready to claim; no prerequisites required',
    };
  });
}
