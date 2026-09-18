import { validateGridAllianceRules } from './alliance';
import { GRID_DEVELOPMENT_BRANCHES } from './economy-types';
import type { GridContestConfig, GridContestSideConfig } from './contest-types';
import type {
  GridDevelopmentBonuses,
  GridEconomyConfig,
  GridEconomyCost,
  GridIncomeRate,
} from './economy-types';
import type {
  GridCityPackage,
  GridPackageValidation,
} from './types';

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) dupes.add(value);
    seen.add(value);
  }

  return [...dupes].sort();
}


function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validateEconomyCost(
  cost: GridEconomyCost,
  path: string,
  errors: string[]
): void {
  if (!isNonNegativeInteger(cost.credits)) {
    errors.push(`${path}.credits must be a non-negative integer`);
  }
  if (!isNonNegativeInteger(cost.commandPoints)) {
    errors.push(`${path}.commandPoints must be a non-negative integer`);
  }
}

function validateIncomeRate(
  rate: GridIncomeRate,
  path: string,
  errors: string[]
): void {
  if (!isNonNegativeInteger(rate.creditsPerHour)) {
    errors.push(`${path}.creditsPerHour must be a non-negative integer`);
  }
  if (!isNonNegativeInteger(rate.influencePerHour)) {
    errors.push(`${path}.influencePerHour must be a non-negative integer`);
  }
}

function validateDevelopmentBonuses(
  bonuses: GridDevelopmentBonuses,
  path: string,
  errors: string[]
): void {
  const values: Array<[keyof GridDevelopmentBonuses, number | undefined]> = [
    ['creditsPerHour', bonuses.creditsPerHour],
    ['influencePerHour', bonuses.influencePerHour],
    ['defenseBps', bonuses.defenseBps],
    ['intelBps', bonuses.intelBps],
    ['prestigeBps', bonuses.prestigeBps],
  ];

  for (const [key, value] of values) {
    if (value !== undefined && !isNonNegativeInteger(value)) {
      errors.push(`${path}.${key} must be a non-negative integer`);
    }
  }
}

function validateGridEconomyConfig(
  economy: GridEconomyConfig,
  pkg: GridCityPackage,
  errors: string[]
): void {
  if (!isPositiveInteger(economy.offlineAccrualCapMinutes)) {
    errors.push('economy.offlineAccrualCapMinutes must be a positive integer');
  }

  const territorySlugs = new Set(pkg.territories.map((row) => row.slug));
  const propertySlugs = new Set(pkg.properties.map((row) => row.slug));

  validateEconomyCost(
    economy.neutralClaims.defaultCost,
    'economy.neutralClaims.defaultCost',
    errors
  );

  if (economy.neutralClaims.starterTerritorySlugs.length === 0) {
    errors.push('economy.neutralClaims.starterTerritorySlugs requires at least one territory');
  }
  for (const slug of duplicates(economy.neutralClaims.starterTerritorySlugs)) {
    errors.push(`economy.neutralClaims.starterTerritorySlugs contains duplicate slug: ${slug}`);
  }
  for (const slug of economy.neutralClaims.starterTerritorySlugs) {
    if (!territorySlugs.has(slug)) {
      errors.push(`economy.neutralClaims.starterTerritorySlugs references unknown territory ${slug}`);
    }
  }
  for (const [slug, cost] of Object.entries(economy.neutralClaims.costByTerritorySlug ?? {})) {
    if (!territorySlugs.has(slug)) {
      errors.push(`economy.neutralClaims.costByTerritorySlug references unknown territory ${slug}`);
    }
    validateEconomyCost(cost, `economy.neutralClaims.costByTerritorySlug.${slug}`, errors);
  }

  validateIncomeRate(
    economy.income.territories.defaultRate,
    'economy.income.territories.defaultRate',
    errors
  );
  for (const [slug, rate] of Object.entries(economy.income.territories.rateBySlug ?? {})) {
    if (!territorySlugs.has(slug)) {
      errors.push(`economy.income.territories.rateBySlug references unknown territory ${slug}`);
    }
    validateIncomeRate(rate, `economy.income.territories.rateBySlug.${slug}`, errors);
  }

  validateIncomeRate(
    economy.income.properties.defaultRate,
    'economy.income.properties.defaultRate',
    errors
  );
  for (const [slug, rate] of Object.entries(economy.income.properties.rateBySlug ?? {})) {
    if (!propertySlugs.has(slug)) {
      errors.push(`economy.income.properties.rateBySlug references unknown property ${slug}`);
    }
    validateIncomeRate(rate, `economy.income.properties.rateBySlug.${slug}`, errors);
  }

  if (typeof economy.propertyAcquisition.requireTerritoryControl !== 'boolean') {
    errors.push('economy.propertyAcquisition.requireTerritoryControl must be a boolean');
  }
  validateEconomyCost(
    economy.propertyAcquisition.defaultCost,
    'economy.propertyAcquisition.defaultCost',
    errors
  );
  for (const [slug, cost] of Object.entries(economy.propertyAcquisition.costByPropertySlug ?? {})) {
    if (!propertySlugs.has(slug)) {
      errors.push(`economy.propertyAcquisition.costByPropertySlug references unknown property ${slug}`);
    }
    validateEconomyCost(cost, `economy.propertyAcquisition.costByPropertySlug.${slug}`, errors);
  }

  for (const branch of GRID_DEVELOPMENT_BRANCHES) {
    const branchConfig = economy.development[branch];
    if (!branchConfig || !Array.isArray(branchConfig.levels) || branchConfig.levels.length === 0) {
      errors.push(`economy.development.${branch} requires at least one level`);
      continue;
    }

    const consecutive = branchConfig.levels.every((level, index) => level.level === index + 1);
    if (!consecutive) {
      errors.push(`economy.development.${branch} levels must be consecutive starting at 1`);
    }

    branchConfig.levels.forEach((level, index) => {
      const path = `economy.development.${branch}.levels[${index}]`;
      if (!isPositiveInteger(level.level)) {
        errors.push(`${path}.level must be a positive integer`);
      }
      validateEconomyCost(level.cost, `${path}.cost`, errors);
      validateDevelopmentBonuses(level.bonuses, `${path}.bonuses`, errors);
    });
  }

  const skylineIds = new Set<string>();
  for (const [index, rule] of economy.skyline.rules.entries()) {
    const path = `economy.skyline.rules[${index}]`;
    if (!rule.id.trim()) errors.push(`${path}.id must be non-empty`);
    if (skylineIds.has(rule.id)) errors.push(`duplicate economy.skyline rule id: ${rule.id}`);
    skylineIds.add(rule.id);

    if (!isPositiveInteger(rule.minDevelopedProperties)) {
      errors.push(`${path}.minDevelopedProperties must be a positive integer`);
    }
    if (!['any', 'single-branch', 'mixed'].includes(rule.branchMode)) {
      errors.push(`${path}.branchMode is invalid`);
    }
    validateDevelopmentBonuses(rule.bonuses, `${path}.bonuses`, errors);
  }
}


function validateContestSide(
  side: GridContestSideConfig,
  path: string,
  errors: string[]
): void {
  if (!isPositiveInteger(side.maxDice)) {
    errors.push(`${path}.maxDice must be a positive integer`);
  }
  if (!Array.isArray(side.bands) || side.bands.length === 0) {
    errors.push(`${path}.bands requires at least one band`);
    return;
  }

  let previousMin = 0;
  let previousDice = 0;
  side.bands.forEach((band, index) => {
    const bandPath = `${path}.bands[${index}]`;
    if (!isPositiveInteger(band.minCommittedInfluence)) {
      errors.push(`${bandPath}.minCommittedInfluence must be a positive integer`);
    }
    if (band.minCommittedInfluence <= previousMin) {
      errors.push(`${path}.bands thresholds must be strictly increasing`);
    }
    if (!isPositiveInteger(band.dice) || band.dice > side.maxDice) {
      errors.push(`${bandPath}.dice must be between 1 and maxDice`);
    }
    if (band.dice < previousDice) {
      errors.push(`${path}.bands dice must not decrease as Influence increases`);
    }
    previousMin = band.minCommittedInfluence;
    previousDice = band.dice;
  });
}

function validateGridContestConfig(
  contest: GridContestConfig,
  errors: string[]
): void {
  if (!Number.isInteger(contest.dieSides) || contest.dieSides < 2) {
    errors.push('contest.dieSides must be an integer >= 2');
  }
  if (!isPositiveInteger(contest.influenceLossPerComparison)) {
    errors.push('contest.influenceLossPerComparison must be a positive integer');
  }
  if (contest.tiesFavorDefender !== true) {
    errors.push('contest.tiesFavorDefender must be true');
  }
  validateContestSide(contest.attacker, 'contest.attacker', errors);
  validateContestSide(contest.defender, 'contest.defender', errors);
}

export function validateGridCityPackage(
  pkg: GridCityPackage
): GridPackageValidation {
  const errors: string[] = [];

  for (const slug of duplicates(pkg.districts.map((row) => row.slug))) {
    errors.push(`duplicate district slug: ${slug}`);
  }

  for (const slug of duplicates(pkg.territories.map((row) => row.slug))) {
    errors.push(`duplicate territory slug: ${slug}`);
  }

  for (const slug of duplicates(pkg.properties.map((row) => row.slug))) {
    errors.push(`duplicate property slug: ${slug}`);
  }

  for (const slug of duplicates(pkg.landmarks.map((row) => row.slug))) {
    errors.push(`duplicate landmark slug: ${slug}`);
  }

  const districtSlugs = new Set(pkg.districts.map((row) => row.slug));
  const territorySlugs = new Set(pkg.territories.map((row) => row.slug));

  for (const territory of pkg.territories) {
    if (!districtSlugs.has(territory.districtSlug)) {
      errors.push(
        `territory ${territory.slug} references unknown district ${territory.districtSlug}`
      );
    }
    if (!Number.isFinite(territory.baseValue) || territory.baseValue < 0) {
      errors.push(`territory ${territory.slug} has invalid baseValue`);
    }
  }

  const edgeKeys = new Set<string>();
  for (const edge of pkg.edges) {
    if (edge.a === edge.b) {
      errors.push(`territory edge cannot connect ${edge.a} to itself`);
      continue;
    }

    if (!territorySlugs.has(edge.a) || !territorySlugs.has(edge.b)) {
      errors.push(
        `territory edge ${edge.a} -> ${edge.b} references unknown territory`
      );
      continue;
    }

    const key = [edge.a, edge.b].sort().join('::');
    if (edgeKeys.has(key)) {
      errors.push(`duplicate territory edge: ${key}`);
    }
    edgeKeys.add(key);
  }

  for (const property of pkg.properties) {
    if (!territorySlugs.has(property.territorySlug)) {
      errors.push(
        `property ${property.slug} references unknown territory ${property.territorySlug}`
      );
    }
  }

  for (const landmark of pkg.landmarks) {
    if (!territorySlugs.has(landmark.territorySlug)) {
      errors.push(
        `landmark ${landmark.slug} references unknown territory ${landmark.territorySlug}`
      );
    }
  }

  if (pkg.status === 'ready' && pkg.districts.length === 0) {
    errors.push('ready package requires at least one district');
  }

  if (pkg.status === 'ready' && pkg.territories.length === 0) {
    errors.push('ready package requires at least one territory');
  }

  const balance = pkg.seasonTemplate.balance;
  if (balance.startingCredits < 0) errors.push('startingCredits must be >= 0');
  if (balance.startingInfluence < 0) errors.push('startingInfluence must be >= 0');
  if (balance.maxCommandPoints <= 0) errors.push('maxCommandPoints must be > 0');
  if (balance.commandPointRegenMinutes <= 0) {
    errors.push('commandPointRegenMinutes must be > 0');
  }

  if (
    pkg.seasonTemplate.surgeHours <= 0 ||
    pkg.seasonTemplate.surgeHours >= pkg.seasonTemplate.durationDays * 24
  ) {
    errors.push('surgeHours must fit inside the season duration');
  }

  if (pkg.seasonTemplate.economy) {
    validateGridEconomyConfig(pkg.seasonTemplate.economy, pkg, errors);
  }

  if (pkg.seasonTemplate.contest) {
    validateGridContestConfig(pkg.seasonTemplate.contest, errors);
  }

  if (pkg.seasonTemplate.alliance) {
    try {
      validateGridAllianceRules(pkg.seasonTemplate.alliance);
    } catch (error) {
      errors.push(
        `alliance.${
          error instanceof Error ? error.message : 'configuration is invalid'
        }`,
      );
    }
  }

  return { ok: errors.length === 0, errors };
}
