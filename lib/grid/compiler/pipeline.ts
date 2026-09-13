import type { GridCityPackage } from '../core/types';
import type { GridCompiledPackageResult, GridCompilerOptions, GridRawGeography } from './types';
import { normalizeRawGeography } from './normalize';
import { computeAdjacencyMismatchIssues, mapToCityPackage } from './map-to-city-package';
import { runCityValidation } from './validate-package';

/**
 * Orchestrates normalize -> map -> validate over raw geography.
 *
 * Never mutates a database and never sets status: 'ready' -- that transition
 * is a deliberate, separate, human-reviewed step performed outside this
 * function. Given the same raw geography and the same options (including a
 * fixed generatedAt), this function is a pure, deterministic function of its
 * inputs: no wall-clock reads, no randomness, no unordered iteration leaks
 * into the returned package.
 */
export function compileCityPackage(
  raw: GridRawGeography,
  seasonTemplate: GridCityPackage['seasonTemplate'],
  cityMeta: GridCityPackage['city'],
  options: GridCompilerOptions,
): GridCompiledPackageResult {
  const normalized = normalizeRawGeography(raw);
  const compiledPackage = mapToCityPackage(normalized, seasonTemplate, cityMeta, options);

  const validation = runCityValidation(compiledPackage, raw);
  const mismatchIssues = computeAdjacencyMismatchIssues(normalized, options.adjacencyToleranceMeters);

  const issues = [...validation.issues, ...normalized.droppedFeatures, ...mismatchIssues];

  return {
    package: compiledPackage,
    validation: {
      ok: issues.every((issue) => issue.severity !== 'ERROR'),
      issues,
    },
  };
}
