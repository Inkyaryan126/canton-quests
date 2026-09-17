import type {
  GridNpcFactionConfig,
  GridNpcFactionContext,
  GridNpcFactionObjective,
  GridNpcFactionPlan,
  GridNpcFactionPressureProjection,
  GridNpcObjectiveKind,
  GridNpcTerritoryCandidate,
} from './npc-faction-types';

const BASIS_POINTS = 10_000;

function requireNonBlank(value: string, label: string): void {
  if (!value.trim()) throw new Error(`${label} cannot be blank`);
}

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requireBps(value: number, label: string): void {
  requireNonNegativeSafeInteger(value, label);
  if (value > BASIS_POINTS) {
    throw new Error(`${label} cannot exceed 10000 basis points`);
  }
}

function mulDivFloor(left: number, right: number, denominator: number): number {
  return Number((BigInt(left) * BigInt(right)) / BigInt(denominator));
}
export function validateGridNpcFactionConfig(
  config: GridNpcFactionConfig,
): void {
  requireNonBlank(config.factionId, 'NPC faction id');
  requireBps(config.basePressureBps, 'basePressureBps');
  requireBps(config.maxPressureBps, 'maxPressureBps');
  requireBps(config.dominanceHeatResponseBps, 'dominanceHeatResponseBps');
  requireBps(config.eventPressureResponseBps, 'eventPressureResponseBps');

  if (config.maxPressureBps < config.basePressureBps) {
    throw new Error('maxPressureBps cannot be below basePressureBps');
  }

  requireNonNegativeSafeInteger(
    config.baseObjectiveSlots,
    'baseObjectiveSlots',
  );
  requireNonNegativeSafeInteger(
    config.maxObjectiveSlots,
    'maxObjectiveSlots',
  );
  if (config.maxObjectiveSlots < config.baseObjectiveSlots) {
    throw new Error('maxObjectiveSlots cannot be below baseObjectiveSlots');
  }

  const weights = Object.values(config.objectiveWeights);
  for (const [key, value] of Object.entries(config.objectiveWeights)) {
    requireBps(value, `objectiveWeights.${key}`);
  }
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  if (weightTotal !== BASIS_POINTS) {
    throw new Error('NPC objective weights must total exactly 10000');
  }
}

function validateContext(context: GridNpcFactionContext): void {
  requireBps(context.dominanceHeatBps, 'dominanceHeatBps');
  requireBps(context.eventPressureBps, 'eventPressureBps');

  const slugs = new Set<string>();
  for (const territory of context.territories) {
    requireNonBlank(territory.territorySlug, 'NPC territory slug');
    if (slugs.has(territory.territorySlug)) {
      throw new Error(
        `duplicate NPC territory candidate: ${territory.territorySlug}`,
      );
    }
    slugs.add(territory.territorySlug);

    requireNonNegativeSafeInteger(
      territory.strategicValue,
      `${territory.territorySlug}.strategicValue`,
    );
    if (territory.ownerDominanceBps !== undefined) {
      requireBps(
        territory.ownerDominanceBps,
        `${territory.territorySlug}.ownerDominanceBps`,
      );
      if (
        territory.control !== 'player' &&
        territory.control !== 'alliance'
      ) {
        throw new Error(
          `${territory.territorySlug}.ownerDominanceBps requires player or alliance control`,
        );
      }
    }
    if (territory.eventPriorityBps !== undefined) {
      requireBps(
        territory.eventPriorityBps,
        `${territory.territorySlug}.eventPriorityBps`,
      );
    }
  }
}

export function projectGridNpcFactionPressure(
  config: GridNpcFactionConfig,
  context: Pick<
    GridNpcFactionContext,
    'dominanceHeatBps' | 'eventPressureBps'
  >,
): GridNpcFactionPressureProjection {
  validateGridNpcFactionConfig(config);
  requireBps(context.dominanceHeatBps, 'dominanceHeatBps');
  requireBps(context.eventPressureBps, 'eventPressureBps');

  const dominanceResponse = mulDivFloor(
    context.dominanceHeatBps,
    config.dominanceHeatResponseBps,
    BASIS_POINTS,
  );
  const eventResponse = mulDivFloor(
    context.eventPressureBps,
    config.eventPressureResponseBps,
    BASIS_POINTS,
  );
  const uncapped = config.basePressureBps + dominanceResponse + eventResponse;
  const pressureBps = Math.min(config.maxPressureBps, uncapped);
  const slotRange = config.maxObjectiveSlots - config.baseObjectiveSlots;
  const objectiveSlots =
    config.maxPressureBps === 0
      ? config.baseObjectiveSlots
      : config.baseObjectiveSlots +
        mulDivFloor(slotRange, pressureBps, config.maxPressureBps);

  return {
    factionId: config.factionId,
    pressureBps,
    objectiveSlots,
    capped: pressureBps < uncapped,
  };
}

function strategicValueBps(
  candidate: GridNpcTerritoryCandidate,
  maxStrategicValue: number,
): number {
  if (maxStrategicValue === 0) return 0;
  return mulDivFloor(
    candidate.strategicValue,
    BASIS_POINTS,
    maxStrategicValue,
  );
}
function objectiveSignals(
  candidate: GridNpcTerritoryCandidate,
  strategicBps: number,
): Array<{
  kind: GridNpcObjectiveKind;
  signalBps: number;
  weightKey: keyof GridNpcFactionConfig['objectiveWeights'];
}> {
  return [
    {
      kind: 'event-response',
      signalBps: candidate.eventPriorityBps ?? 0,
      weightKey: 'eventResponseBps',
    },
    {
      kind: 'defend-landmark',
      signalBps:
        candidate.control === 'npc' && candidate.containsLandmark
          ? BASIS_POINTS
          : 0,
      weightKey: 'landmarkDefenseBps',
    },
    {
      kind: 'pressure-dominant-owner',
      signalBps:
        candidate.control === 'player' || candidate.control === 'alliance'
          ? candidate.ownerDominanceBps ?? 0
          : 0,
      weightKey: 'dominantOwnerPressureBps',
    },
    {
      kind: 'occupy-neutral',
      signalBps:
        candidate.control === 'neutral' ? strategicBps : 0,
      weightKey: 'neutralExpansionBps',
    },
    {
      kind: 'tutorial-opponent',
      signalBps: candidate.tutorialOpponentEligible
        ? BASIS_POINTS
        : 0,
      weightKey: 'tutorialOpponentBps',
    },
  ];
}

function projectCandidateObjective(
  candidate: GridNpcTerritoryCandidate,
  config: GridNpcFactionConfig,
  maxStrategicValue: number,
): GridNpcFactionObjective | null {
  const strategicBps = strategicValueBps(candidate, maxStrategicValue);
  const scored = objectiveSignals(candidate, strategicBps).map((signal) => ({
    ...signal,
    contributionBps: mulDivFloor(
      signal.signalBps,
      config.objectiveWeights[signal.weightKey],
      BASIS_POINTS,
    ),
  }));
  const scoreBps = scored.reduce(
    (sum, signal) => sum + signal.contributionBps,
    0,
  );
  if (scoreBps === 0) return null;

  const kind = scored.reduce((best, current) =>
    current.contributionBps > best.contributionBps ? current : best,
  ).kind;

  return {
    territorySlug: candidate.territorySlug,
    kind,
    scoreBps,
    strategicValueBps: strategicBps,
  };
}

export function planGridNpcFaction(
  config: GridNpcFactionConfig,
  context: GridNpcFactionContext,
): GridNpcFactionPlan {
  validateGridNpcFactionConfig(config);
  validateContext(context);

  for (const territory of context.territories) {
    if (
      territory.tutorialOpponentEligible &&
      territory.control !== 'npc'
    ) {
      throw new Error(
        `${territory.territorySlug} tutorial opponent must be NPC controlled`,
      );
    }
  }

  const maxStrategicValue = context.territories.reduce(
    (max, territory) => Math.max(max, territory.strategicValue),
    0,
  );
  const pressure = projectGridNpcFactionPressure(config, context);
  const objectives = context.territories
    .map((territory) =>
      projectCandidateObjective(
        territory,
        config,
        maxStrategicValue,
      ),
    )
    .filter(
      (objective): objective is GridNpcFactionObjective =>
        objective !== null,
    )
    .sort(
      (left, right) =>
        right.scoreBps - left.scoreBps ||
        left.territorySlug.localeCompare(right.territorySlug),
    )
    .slice(0, pressure.objectiveSlots);

  return {
    pressure,
    objectives,
  };
}
