import { GRID_CONTRACT_KINDS } from './contract-types';
import type {
  GridContractCreateInput,
  GridContractDefinition,
  GridContractInstance,
  GridContractProgressInput,
  GridContractProgressResult,
  GridContractReward,
} from './contract-types';

function assertSafeInteger(value: number, name: string, minimum = 0): void {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new Error(`${name} must be a safe integer >= ${minimum}`);
  }
}

function assertNonEmpty(value: string, name: string): void {
  if (!value.trim()) throw new Error(`${name} must not be empty`);
}

function assertReward(reward: GridContractReward, name: string): void {
  assertSafeInteger(reward.credits, `${name} credits`);
  assertSafeInteger(reward.influence, `${name} influence`);
  assertSafeInteger(reward.commandPoints, `${name} command points`);
}

function cloneReward(reward: GridContractReward): GridContractReward {
  return { ...reward };
}
export function assertGridContractDefinition(definition: GridContractDefinition): void {
  assertNonEmpty(definition.id, 'contract id');
  if (!GRID_CONTRACT_KINDS.includes(definition.kind)) {
    throw new Error(`unsupported contract kind: ${definition.kind}`);
  }
  if (definition.objectives.length === 0) {
    throw new Error('contract must define at least one objective');
  }

  const objectiveIds = new Set<string>();
  for (const objective of definition.objectives) {
    assertNonEmpty(objective.id, 'objective id');
    if (objectiveIds.has(objective.id)) {
      throw new Error(`duplicate objective id: ${objective.id}`);
    }
    objectiveIds.add(objective.id);
    assertSafeInteger(objective.target, `objective ${objective.id} target`, 1);
  }

  assertReward(definition.reward, 'contract reward');
  if (definition.locationEnhancement) {
    assertReward(definition.locationEnhancement.bonusReward, 'location bonus reward');
  }
}
function assertInstanceMatches(
  definition: GridContractDefinition,
  instance: GridContractInstance,
): void {
  if (instance.contractId !== definition.id) {
    throw new Error('contract instance does not match definition');
  }
}

export function createGridContractInstance(
  definition: GridContractDefinition,
  input: GridContractCreateInput,
): GridContractInstance {
  assertGridContractDefinition(definition);
  assertNonEmpty(input.playerId, 'player id');
  assertSafeInteger(input.acceptedAtMs, 'acceptedAtMs');
  if (input.expiresAtMs !== null) {
    assertSafeInteger(input.expiresAtMs, 'expiresAtMs');
    if (input.expiresAtMs <= input.acceptedAtMs) {
      throw new Error('expiresAtMs must be greater than acceptedAtMs');
    }
  }

  return {
    contractId: definition.id,
    playerId: input.playerId,
    status: 'active',
    acceptedAtMs: input.acceptedAtMs,    expiresAtMs: input.expiresAtMs,
    completedAtMs: null,
    locationEnhanced: false,
    progress: Object.fromEntries(
      definition.objectives.map((objective) => [objective.id, 0]),
    ),
  };
}

export function expireGridContractInstance(
  definition: GridContractDefinition,
  instance: GridContractInstance,
  nowMs: number,
): GridContractInstance {
  assertGridContractDefinition(definition);
  assertInstanceMatches(definition, instance);
  assertSafeInteger(nowMs, 'contract nowMs');
  if (nowMs < instance.acceptedAtMs) {
    throw new Error('contract time cannot move before acceptance');
  }
  if (instance.status !== 'active') return { ...instance, progress: { ...instance.progress } };
  if (instance.expiresAtMs === null || nowMs < instance.expiresAtMs) {
    return { ...instance, progress: { ...instance.progress } };
  }
  return {
    ...instance,
    status: 'expired',
    progress: { ...instance.progress },
  };
}
export function applyGridContractProgress(
  definition: GridContractDefinition,
  instance: GridContractInstance,
  input: GridContractProgressInput,
): GridContractProgressResult {
  assertGridContractDefinition(definition);
  assertInstanceMatches(definition, instance);
  assertSafeInteger(input.nowMs, 'contract progress nowMs');
  assertSafeInteger(input.amount, 'contract progress amount', 1);

  const objective = definition.objectives.find((item) => item.id === input.objectiveId);
  if (!objective) throw new Error(`unknown objective: ${input.objectiveId}`);

  const current = expireGridContractInstance(definition, instance, input.nowMs);
  if (current.status !== 'active') {
    return {
      instance: current,
      completedNow: false,
      rewardIntent: null,
      locationBonusIntent: null,
    };
  }

  const progress = { ...current.progress };
  const previous = progress[objective.id] ?? 0;
  progress[objective.id] = Math.min(objective.target, previous + input.amount);
  const locationEnhanced = current.locationEnhanced || input.locationEnhanced === true;  const completed = definition.objectives.every(
    (item) => (progress[item.id] ?? 0) >= item.target,
  );
  const next: GridContractInstance = {
    ...current,
    progress,
    locationEnhanced,
    status: completed ? 'completed' : 'active',
    completedAtMs: completed ? input.nowMs : null,
  };

  return {
    instance: next,
    completedNow: completed,
    rewardIntent: completed ? cloneReward(definition.reward) : null,
    locationBonusIntent:
      completed && locationEnhanced && definition.locationEnhancement
        ? cloneReward(definition.locationEnhancement.bonusReward)
        : null,
  };
}