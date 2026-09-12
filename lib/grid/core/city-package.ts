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

  return { ok: errors.length === 0, errors };
}
