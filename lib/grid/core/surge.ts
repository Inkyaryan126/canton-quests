import type {
  GridSurgeConfig,
  GridSurgeEffects,
  GridSurgeHotspotCandidate,
  GridSurgeHotspotProjection,
  GridSurgePhase,
  GridSurgeProjection,
  GridSurgeSeasonWindow,
} from './surge-types';

const BASIS_POINTS = 10_000;
const MAX_SURGE_MULTIPLIER_BPS = 50_000;

const INACTIVE_EFFECTS: GridSurgeEffects = {
  districtControlValueMultiplierBps: BASIS_POINTS,
  landmarkValueMultiplierBps: BASIS_POINTS,
  hotspotValueMultiplierBps: BASIS_POINTS,
  dominanceExposureMultiplierBps: BASIS_POINTS,
  specialObjectiveSlots: 0,
  npcStrongholdSlots: 0,
  emphasizeFinalRankings: false,
};

function requireSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be a safe integer`);
  }
}

function requireNonNegativeSafeInteger(value: number, label: string): void {
  requireSafeInteger(value, label);
  if (value < 0) {
    throw new Error(`${label} must be non-negative`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  requireSafeInteger(value, label);
  if (value <= 0) {
    throw new Error(`${label} must be positive`);
  }
}

function requireBps(value: number, label: string): void {
  requireNonNegativeSafeInteger(value, label);
  if (value > BASIS_POINTS) {
    throw new Error(`${label} cannot exceed 10000 basis points`);
  }
}

function requireSurgeMultiplier(value: number, label: string): void {
  requireSafeInteger(value, label);
  if (value < BASIS_POINTS || value > MAX_SURGE_MULTIPLIER_BPS) {
    throw new Error(
      `${label} must be between 10000 and ${MAX_SURGE_MULTIPLIER_BPS} basis points`,
    );
  }
}

function parseTimestamp(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    throw new Error(`Grid Surge requires a valid ${label} timestamp`);
  }
  return timestamp;
}

export function validateGridSurgeConfig(config: GridSurgeConfig): void {
  requirePositiveSafeInteger(config.durationMinutes, 'Grid Surge durationMinutes');
  if (!Number.isSafeInteger(config.durationMinutes * 60_000)) {
    throw new Error('Grid Surge durationMinutes is too large');
  }
  requireSurgeMultiplier(
    config.districtControlValueMultiplierBps,
    'Grid Surge districtControlValueMultiplierBps',
  );
  requireSurgeMultiplier(
    config.landmarkValueMultiplierBps,
    'Grid Surge landmarkValueMultiplierBps',
  );
  requireSurgeMultiplier(
    config.hotspotValueMultiplierBps,
    'Grid Surge hotspotValueMultiplierBps',
  );
  requireSurgeMultiplier(
    config.dominanceExposureMultiplierBps,
    'Grid Surge dominanceExposureMultiplierBps',
  );

  requireNonNegativeSafeInteger(config.hotspotCount, 'Grid Surge hotspotCount');
  requireNonNegativeSafeInteger(
    config.maxHotspotsPerDistrict,
    'Grid Surge maxHotspotsPerDistrict',
  );
  requireNonNegativeSafeInteger(
    config.specialObjectiveSlots,
    'Grid Surge specialObjectiveSlots',
  );
  requireNonNegativeSafeInteger(
    config.npcStrongholdSlots,
    'Grid Surge npcStrongholdSlots',
  );

  if (config.hotspotCount === 0 && config.maxHotspotsPerDistrict !== 0) {
    throw new Error(
      'Grid Surge maxHotspotsPerDistrict must be zero when hotspotCount is zero',
    );
  }
  if (
    config.hotspotCount > 0 &&
    (config.maxHotspotsPerDistrict < 1 ||
      config.maxHotspotsPerDistrict > config.hotspotCount)
  ) {
    throw new Error(
      'Grid Surge maxHotspotsPerDistrict must be between 1 and hotspotCount',
    );
  }

  const weights = config.hotspotWeights;
  requireBps(weights.strategicValueBps, 'Grid Surge strategicValueBps weight');
  requireBps(weights.contestPressureBps, 'Grid Surge contestPressureBps weight');
  requireBps(
    weights.underdogOpportunityBps,
    'Grid Surge underdogOpportunityBps weight',
  );

  const totalWeight =
    weights.strategicValueBps +
    weights.contestPressureBps +
    weights.underdogOpportunityBps;
  if (totalWeight !== BASIS_POINTS) {
    throw new Error('Grid Surge hotspot weights must total exactly 10000');
  }
}

function validateSeasonWindow(seasonWindow: GridSurgeSeasonWindow): {
  startsAtMs: number;
  endsAtMs: number;
  explicitSurgeStartsAtMs: number | null;
} {
  const startsAtMs = parseTimestamp(seasonWindow.startsAt, 'startsAt');
  const endsAtMs = parseTimestamp(seasonWindow.endsAt, 'endsAt');
  if (startsAtMs >= endsAtMs) {
    throw new Error('Grid Surge season startsAt must be before endsAt');
  }

  let explicitSurgeStartsAtMs: number | null = null;
  if (seasonWindow.surgeStartsAt) {
    explicitSurgeStartsAtMs = parseTimestamp(
      seasonWindow.surgeStartsAt,
      'surgeStartsAt',
    );
    if (
      explicitSurgeStartsAtMs < startsAtMs ||
      explicitSurgeStartsAtMs >= endsAtMs
    ) {
      throw new Error(
        'Grid Surge surgeStartsAt must fall within the playable season window',
      );
    }
  }

  return { startsAtMs, endsAtMs, explicitSurgeStartsAtMs };
}

export function resolveGridSurgeStartAt(
  seasonWindow: GridSurgeSeasonWindow,
  config: GridSurgeConfig,
): string {
  validateGridSurgeConfig(config);
  const { startsAtMs, endsAtMs, explicitSurgeStartsAtMs } =
    validateSeasonWindow(seasonWindow);
  const durationMs = config.durationMinutes * 60_000;
  const derivedStartAtMs = Math.max(startsAtMs, endsAtMs - durationMs);
  return new Date(explicitSurgeStartsAtMs ?? derivedStartAtMs).toISOString();
}

function scoreHotspot(
  candidate: GridSurgeHotspotCandidate,
  config: GridSurgeConfig,
): number {
  const weights = config.hotspotWeights;
  return Number(
    (
      BigInt(candidate.strategicValueBps) * BigInt(weights.strategicValueBps) +
      BigInt(candidate.contestPressureBps) *
        BigInt(weights.contestPressureBps) +
      BigInt(candidate.underdogOpportunityBps) *
        BigInt(weights.underdogOpportunityBps)
    ) / BigInt(BASIS_POINTS),
  );
}

function validateHotspotCandidates(
  candidates: readonly GridSurgeHotspotCandidate[],
): void {
  const territorySlugs = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.territorySlug.trim()) {
      throw new Error('Grid Surge hotspot territorySlug cannot be blank');
    }
    if (!candidate.districtSlug.trim()) {
      throw new Error('Grid Surge hotspot districtSlug cannot be blank');
    }
    if (territorySlugs.has(candidate.territorySlug)) {
      throw new Error(
        `Duplicate Grid Surge hotspot territory: ${candidate.territorySlug}`,
      );
    }
    territorySlugs.add(candidate.territorySlug);

    requireBps(
      candidate.strategicValueBps,
      `Grid Surge ${candidate.territorySlug} strategicValueBps`,
    );
    requireBps(
      candidate.contestPressureBps,
      `Grid Surge ${candidate.territorySlug} contestPressureBps`,
    );
    requireBps(
      candidate.underdogOpportunityBps,
      `Grid Surge ${candidate.territorySlug} underdogOpportunityBps`,
    );
  }
}

export function selectGridSurgeHotspots(
  candidates: readonly GridSurgeHotspotCandidate[],
  config: GridSurgeConfig,
): GridSurgeHotspotProjection[] {
  validateGridSurgeConfig(config);
  validateHotspotCandidates(candidates);
  if (config.hotspotCount === 0 || candidates.length === 0) return [];

  const sorted = candidates
    .map((candidate) => ({
      ...candidate,
      scoreBps: scoreHotspot(candidate, config),
    }))
    .sort(
      (a, b) =>
        b.scoreBps - a.scoreBps ||
        a.districtSlug.localeCompare(b.districtSlug) ||
        a.territorySlug.localeCompare(b.territorySlug),
    );

  const districtCounts = new Map<string, number>();
  const selected: GridSurgeHotspotProjection[] = [];

  for (const candidate of sorted) {
    if (selected.length >= config.hotspotCount) break;
    const currentDistrictCount = districtCounts.get(candidate.districtSlug) ?? 0;
    if (currentDistrictCount >= config.maxHotspotsPerDistrict) continue;

    districtCounts.set(candidate.districtSlug, currentDistrictCount + 1);
    selected.push({
      territorySlug: candidate.territorySlug,
      districtSlug: candidate.districtSlug,
      scoreBps: candidate.scoreBps,
      rank: selected.length + 1,
    });
  }

  return selected;
}

function resolvePhase(
  nowMs: number,
  startsAtMs: number,
  surgeStartsAtMs: number,
  endsAtMs: number,
): GridSurgePhase {
  if (nowMs < startsAtMs) return 'pre-season';
  if (nowMs < surgeStartsAtMs) return 'regular';
  if (nowMs < endsAtMs) return 'surge';
  return 'ended';
}

function surgeProgressBps(
  phase: GridSurgePhase,
  nowMs: number,
  surgeStartsAtMs: number,
  endsAtMs: number,
): number {
  if (phase === 'ended') return BASIS_POINTS;
  if (phase !== 'surge') return 0;

  const elapsed = nowMs - surgeStartsAtMs;
  const duration = endsAtMs - surgeStartsAtMs;
  return Math.min(
    BASIS_POINTS,
    Number((BigInt(elapsed) * BigInt(BASIS_POINTS)) / BigInt(duration)),
  );
}

function activeEffects(config: GridSurgeConfig): GridSurgeEffects {
  return {
    districtControlValueMultiplierBps:
      config.districtControlValueMultiplierBps,
    landmarkValueMultiplierBps: config.landmarkValueMultiplierBps,
    hotspotValueMultiplierBps: config.hotspotValueMultiplierBps,
    dominanceExposureMultiplierBps: config.dominanceExposureMultiplierBps,
    specialObjectiveSlots: config.specialObjectiveSlots,
    npcStrongholdSlots: config.npcStrongholdSlots,
    emphasizeFinalRankings: config.emphasizeFinalRankings,
  };
}

export function projectGridSurge(
  now: string,
  seasonWindow: GridSurgeSeasonWindow,
  config: GridSurgeConfig,
  hotspotCandidates: readonly GridSurgeHotspotCandidate[] = [],
): GridSurgeProjection {
  validateGridSurgeConfig(config);
  const nowMs = parseTimestamp(now, 'now');
  const { startsAtMs, endsAtMs, explicitSurgeStartsAtMs } =
    validateSeasonWindow(seasonWindow);
  const durationMs = config.durationMinutes * 60_000;
  const surgeStartsAtMs =
    explicitSurgeStartsAtMs ?? Math.max(startsAtMs, endsAtMs - durationMs);
  const phase = resolvePhase(nowMs, startsAtMs, surgeStartsAtMs, endsAtMs);
  const active = phase === 'surge';

  return {
    phase,
    active,
    startsAt: new Date(startsAtMs).toISOString(),
    surgeStartsAt: new Date(surgeStartsAtMs).toISOString(),
    endsAt: new Date(endsAtMs).toISOString(),
    millisecondsUntilSurge:
      phase === 'pre-season' || phase === 'regular'
        ? Math.max(0, surgeStartsAtMs - nowMs)
        : null,
    millisecondsRemaining:
      phase === 'surge' ? Math.max(0, endsAtMs - nowMs) : null,
    progressBps: surgeProgressBps(
      phase,
      nowMs,
      surgeStartsAtMs,
      endsAtMs,
    ),
    effects: active ? activeEffects(config) : { ...INACTIVE_EFFECTS },
    hotspots: active
      ? selectGridSurgeHotspots(hotspotCandidates, config)
      : [],
  };
}
