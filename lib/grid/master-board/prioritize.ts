import { GRID_MILESTONES } from './milestones';
import type {
  GridMasterBoard,
  GridMilestoneDefinition,
  GridMilestoneState,
  GridMilestoneStatus,
} from './types';

export interface GridGraphValidation {
  definitions: GridMilestoneDefinition[];
  byId: Map<string, GridMilestoneDefinition>;
}

export interface GridPriorityBreakdown {
  playerImpact: number;
  dependencyUnlock: number;
  launchValue: number;
  urgency: number;
  coordinationRiskPenalty: number;
  phaseWeight: number;
}

export interface GridPriorityScore {
  total: number;
  breakdown: GridPriorityBreakdown;
}

export interface GridPriorityRecommendation {
  id: string;
  title: string;
  phase: string;
  status: GridMilestoneStatus;
  score: GridPriorityScore;
  dependencies: string[];
  dependencyStatuses: Record<string, GridMilestoneStatus | 'UNKNOWN'>;
  downstreamUnlocks: string[];
  whyNow: string;
  detail: string;
  owner?: string;
  branch?: string;
}

export interface GridPrioritizationResult {
  generatedAt: string;
  integrationRef: string | null;
  limit: number;
  actionableStatuses: GridMilestoneStatus[];
  recommendations: GridPriorityRecommendation[];
}

export interface PrioritizeGridMasterBoardOptions {
  limit?: number;
  actionableStatuses?: GridMilestoneStatus[];
  phaseWeights?: Partial<Record<string, number>>;
}

const DEFAULT_ACTIONABLE_STATUSES: GridMilestoneStatus[] = ['SAFE_NEXT_WORK', 'READY_TO_INTEGRATE'];
const DEFAULT_PHASE_WEIGHTS: Record<string, number> = {
  foundation: 3,
  gameplay: 4,
  player: 4,
  world: 3,
  economy: 3,
  operations: 5,
  launch: 6,
  season: 4,
  strategy: 3,
  multiplayer: 3,
  platform: 3,
  identity: 2,
};

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function validateMilestoneGraph(
  definitions: GridMilestoneDefinition[] = GRID_MILESTONES,
): GridGraphValidation {
  const errors: string[] = [];
  const byId = new Map<string, GridMilestoneDefinition>();

  for (const item of definitions) {
    if (byId.has(item.id)) errors.push(`Duplicate milestone id: ${item.id}`);
    else byId.set(item.id, item);
  }

  for (const item of definitions) {
    for (const dependency of item.dependsOn) {
      if (!byId.has(dependency)) errors.push(`Unknown dependency: ${item.id} -> ${dependency}`);
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycleKeys = new Set<string>();
  const path: string[] = [];

  const visit = (id: string): void => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start), id];
      const key = cycle.join('->');
      if (!cycleKeys.has(key)) errors.push(`Dependency cycle: ${cycle.join(' -> ')}`);
      cycleKeys.add(key);
      return;
    }
    if (visited.has(id)) return;
    const item = byId.get(id);
    if (!item) return;
    visiting.add(id);
    path.push(id);
    for (const dependency of item.dependsOn) visit(dependency);
    path.pop();
    visiting.delete(id);
    visited.add(id);
  };

  for (const item of definitions) visit(item.id);
  if (errors.length > 0) throw new Error(`Invalid Grid milestone dependency graph: ${errors.join('; ')}`);
  return { definitions: [...definitions], byId };
}

export function calculateDownstreamUnlocks(
  definitions: GridMilestoneDefinition[],
  milestoneId: string,
): string[] {
  const graph = validateMilestoneGraph(definitions);
  if (!graph.byId.has(milestoneId)) throw new Error(`Unknown milestone id: ${milestoneId}`);
  const downstream = new Set<string>();
  const queue = [milestoneId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    for (const item of graph.definitions) {
      if (item.dependsOn.includes(current) && !downstream.has(item.id)) {
        downstream.add(item.id);
        queue.push(item.id);
      }
    }
  }
  return sortedUnique([...downstream]);
}

function scorePlayerImpact(definition: GridMilestoneDefinition): number {
  const phaseImpact: Record<string, number> = {
    player: 9,
    gameplay: 8,
    world: 7,
    multiplayer: 6,
    economy: 6,
    season: 6,
    strategy: 5,
    operations: 5,
    platform: 5,
    foundation: 4,
    identity: 4,
    launch: 4,
  };
  const text = `${definition.id} ${definition.title}`.toLowerCase();
  const loopBonus = ['play', 'player', 'contest', 'onboard', 'map', 'quest', 'economy'].some((term) => text.includes(term)) ? 2 : 0;
  return (phaseImpact[definition.phase] ?? 4) + loopBonus;
}

function scoreLaunchValue(definition: GridMilestoneDefinition): number {
  const phaseValue: Record<string, number> = { launch: 12, operations: 9, season: 8, gameplay: 6, player: 6, world: 5 };
  const text = `${definition.id} ${definition.title}`.toLowerCase();
  const launchBonus = ['launch', 'production', 'activation', 'readiness', 'qa', 'safety'].some((term) => text.includes(term)) ? 3 : 0;
  return (phaseValue[definition.phase] ?? 3) + launchBonus;
}

function scoreUrgency(state: GridMilestoneState): number {
  if (state.status === 'READY_TO_INTEGRATE') return 14;
  if (state.status === 'SAFE_NEXT_WORK') return 9;
  if (state.status === 'IN_PROGRESS') return 7;
  return 0;
}

function scoreRiskPenalty(state: GridMilestoneState): number {
  return state.warnings.length * 3 + (state.owner ? 2 : 0) + (state.branch ? 1 : 0);
}

function recommendationWhyNow(
  state: GridMilestoneState,
  breakdown: GridPriorityBreakdown,
  dependencies: string[],
  downstream: string[],
): string {
  const reasons: string[] = [];
  if (state.status === 'READY_TO_INTEGRATE') reasons.push('ready to integrate');
  if (state.status === 'SAFE_NEXT_WORK') reasons.push('all prerequisites are integrated');
  if (downstream.length > 0) reasons.push(`unlocks ${downstream.length} downstream milestone${downstream.length === 1 ? '' : 's'}`);
  if (breakdown.launchValue >= 10) reasons.push('high launch value');
  if (dependencies.length > 0 && state.status === 'SAFE_NEXT_WORK') reasons.push(`builds on ${dependencies.join(', ')}`);
  if (breakdown.coordinationRiskPenalty > 0) reasons.push(`risk penalty ${breakdown.coordinationRiskPenalty}`);
  return reasons.length > 0 ? `Now: ${reasons.join('; ')}.` : 'Now: highest available deterministic leverage.';
}

export function prioritizeGridMasterBoard(
  board: GridMasterBoard,
  definitions: GridMilestoneDefinition[] = GRID_MILESTONES,
  options: PrioritizeGridMasterBoardOptions = {},
): GridPrioritizationResult {
  const graph = validateMilestoneGraph(definitions);
  const limit = options.limit ?? 5;
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit requires a positive integer');
  const actionableStatuses = options.actionableStatuses ?? DEFAULT_ACTIONABLE_STATUSES;
  const statesById = new Map(board.milestones.map((item) => [item.id, item]));
  const weights = { ...DEFAULT_PHASE_WEIGHTS, ...options.phaseWeights };

  const recommendations = graph.definitions
    .map((definition) => ({ definition, state: statesById.get(definition.id) }))
    .filter((item): item is { definition: GridMilestoneDefinition; state: GridMilestoneState } => Boolean(item.state && actionableStatuses.includes(item.state.status)))
    .map(({ definition, state }) => {
      const downstreamUnlocks = calculateDownstreamUnlocks(graph.definitions, definition.id);
      const breakdown: GridPriorityBreakdown = {
        playerImpact: scorePlayerImpact(definition),
        dependencyUnlock: downstreamUnlocks.length * 5,
        launchValue: scoreLaunchValue(definition),
        urgency: scoreUrgency(state),
        coordinationRiskPenalty: scoreRiskPenalty(state),
        phaseWeight: weights[definition.phase] ?? 0,
      };
      const dependencies = [...definition.dependsOn].sort((a, b) => a.localeCompare(b));
      const dependencyStatuses = Object.fromEntries(dependencies.map((id) => [id, statesById.get(id)?.status ?? 'UNKNOWN'])) as Record<string, GridMilestoneStatus | 'UNKNOWN'>;
      return {
        id: definition.id,
        title: definition.title,
        phase: definition.phase,
        status: state.status,
        score: { total: breakdown.playerImpact + breakdown.dependencyUnlock + breakdown.launchValue + breakdown.urgency + breakdown.phaseWeight - breakdown.coordinationRiskPenalty, breakdown },
        dependencies,
        dependencyStatuses,
        downstreamUnlocks,
        whyNow: recommendationWhyNow(state, breakdown, dependencies, downstreamUnlocks),
        detail: state.detail,
        ...(state.owner ? { owner: state.owner } : {}),
        ...(state.branch ? { branch: state.branch } : {}),
      } satisfies GridPriorityRecommendation;
    })
    .sort((a, b) => b.score.total - a.score.total || a.id.localeCompare(b.id))
    .slice(0, limit);

  return {
    generatedAt: board.health.generatedAt,
    integrationRef: board.health.integrationRef,
    limit,
    actionableStatuses: [...actionableStatuses],
    recommendations,
  };
}
