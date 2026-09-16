import type {
  GridCityPowerComponentConfig,
  GridCityPowerConfig,
  GridCityPowerMetrics,
  GridCityPowerProjection,
} from './city-power-types';

const BASIS_POINTS = 10_000;

function requireNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

function requirePositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function requireBps(value: number, label: string): void {
  requireNonNegativeSafeInteger(value, label);
  if (value > BASIS_POINTS) {
    throw new Error(`${label} cannot exceed 10000 basis points`);
  }
}
function validateComponent(
  component: GridCityPowerComponentConfig,
  maxSingleComponentWeightBps: number,
): void {
  if (!component.id.trim()) {
    throw new Error('City Power component id cannot be blank');
  }
  requirePositiveSafeInteger(component.weightBps, `${component.id}.weightBps`);
  if (component.weightBps > maxSingleComponentWeightBps) {
    throw new Error(
      `${component.id}.weightBps exceeds maxSingleComponentWeightBps`,
    );
  }
  requirePositiveSafeInteger(component.rawCap, `${component.id}.rawCap`);

  if (component.curve.length === 0) {
    throw new Error(`${component.id}.curve cannot be empty`);
  }

  let previousRaw = 0;
  let previousAttainment = 0;
  for (const point of component.curve) {
    requirePositiveSafeInteger(
      point.rawValue,
      `${component.id}.curve.rawValue`,
    );
    requireBps(
      point.attainmentBps,
      `${component.id}.curve.attainmentBps`,
    );

    if (point.rawValue <= previousRaw) {
      throw new Error(`${component.id}.curve rawValue must increase`);
    }
    if (point.attainmentBps <= previousAttainment) {
      throw new Error(`${component.id}.curve attainmentBps must increase`);
    }

    previousRaw = point.rawValue;
    previousAttainment = point.attainmentBps;
  }

  const last = component.curve.at(-1)!;
  if (last.rawValue !== component.rawCap) {
    throw new Error(`${component.id}.curve must end at rawCap`);
  }
  if (last.attainmentBps !== BASIS_POINTS) {
    throw new Error(`${component.id}.curve must end at 10000 attainmentBps`);
  }
}

export function validateGridCityPowerConfig(
  config: GridCityPowerConfig,
): void {
  requirePositiveSafeInteger(
    config.maxSingleComponentWeightBps,
    'maxSingleComponentWeightBps',
  );
  if (config.maxSingleComponentWeightBps > BASIS_POINTS) {
    throw new Error(
      'maxSingleComponentWeightBps cannot exceed 10000 basis points',
    );
  }
  if (config.components.length === 0) {
    throw new Error('City Power requires at least one component');
  }

  const ids = new Set<string>();
  let totalWeightBps = 0;
  for (const component of config.components) {
    validateComponent(component, config.maxSingleComponentWeightBps);
    if (ids.has(component.id)) {
      throw new Error(`Duplicate City Power component id: ${component.id}`);
    }
    ids.add(component.id);
    totalWeightBps += component.weightBps;
    if (!Number.isSafeInteger(totalWeightBps)) {
      throw new Error('City Power component weights exceed safe integer range');
    }
  }

  if (totalWeightBps !== BASIS_POINTS) {
    throw new Error('City Power component weightBps must total exactly 10000');
  }
}

function mulDivFloor(
  left: number,
  right: number,
  denominator: number,
): number {
  return Number(
    (BigInt(left) * BigInt(right)) / BigInt(denominator),
  );
}
function attainmentForRaw(
  rawValue: number,
  component: GridCityPowerComponentConfig,
): number {
  if (rawValue <= 0) return 0;
  const capped = Math.min(rawValue, component.rawCap);

  let previousRaw = 0;
  let previousAttainment = 0;
  for (const point of component.curve) {
    if (capped <= point.rawValue) {
      const rawSpan = point.rawValue - previousRaw;
      const progress = capped - previousRaw;
      const attainmentSpan = point.attainmentBps - previousAttainment;
      return previousAttainment +
        mulDivFloor(progress, attainmentSpan, rawSpan);
    }

    previousRaw = point.rawValue;
    previousAttainment = point.attainmentBps;
  }

  return BASIS_POINTS;
}
export function projectGridCityPower(
  metrics: GridCityPowerMetrics,
  config: GridCityPowerConfig,
): GridCityPowerProjection {
  validateGridCityPowerConfig(config);

  for (const [id, value] of Object.entries(metrics)) {
    requireNonNegativeSafeInteger(value, `City Power metric ${id}`);
  }

  const configuredIds = new Set(
    config.components.map((component) => component.id),
  );
  const breakdown = config.components.map((component) => {
    const rawValue = metrics[component.id] ?? 0;
    const cappedRawValue = Math.min(rawValue, component.rawCap);
    const attainmentBps = attainmentForRaw(rawValue, component);
    const contributedPowerBps = mulDivFloor(
      attainmentBps,
      component.weightBps,
      BASIS_POINTS,
    );

    return {
      id: component.id,
      rawValue,
      cappedRawValue,
      capped: rawValue > component.rawCap,
      attainmentBps,
      weightBps: component.weightBps,
      contributedPowerBps,
    };
  });

  const cityPowerBps = breakdown.reduce(
    (sum, component) => sum + component.contributedPowerBps,
    0,
  );
  const ignoredMetricIds = Object.keys(metrics)
    .filter((id) => !configuredIds.has(id))
    .sort();

  return {
    cityPowerBps,
    breakdown,
    ignoredMetricIds,
  };
}
