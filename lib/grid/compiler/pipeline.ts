import { normalizeRawGeography } from './normalize';
import { mapToCityPackage } from './map-to-city-package';
import { runCityValidation } from './validate-package';
import type {
  GridRawGeography,
  GridCompilerOptions,
  GridCompiledPackageResult,
  GridValidationIssue,
} from './types';
import type { GridCityPackage } from '../core/types';

/**
 * Compiles raw city geography into a validated draft GridCityPackage.
 *
 * Pipeline execution stages:
 * 1. Normalize raw geography: drop invalid geometries and record GEOMETRY_INVALID issues.
 * 2. Map normalized geography to package shape: compute or cross-check adjacency,
 *    stamp compilerVersion, sourceSnapshotVersion, generatedAt, and sha256 checksum.
 * 3. Validate compiled package using severity-graded validation rules.
 * 4. Assemble final package result with all issues (dropped features + edge mismatches + package validation).
 *
 * Safety invariant:
 * This pipeline NEVER marks a package as 'ready'. Packages always output as 'draft'.
 */
export function compileCityPackage(
  raw: GridRawGeography,
  seasonTemplate: GridCityPackage['seasonTemplate'],
  cityMeta: GridCityPackage['city'],
  options: GridCompilerOptions,
): GridCompiledPackageResult {
  const normalized = normalizeRawGeography(raw);

  const edgeIssues: GridValidationIssue[] = [];
  const pkg = mapToCityPackage(normalized, seasonTemplate, cityMeta, options, edgeIssues);

  // Invariant defense: compiler never marks a package as ready
  pkg.status = 'draft';

  const validationReport = runCityValidation(pkg, normalized);

  const allIssues: GridValidationIssue[] = [
    ...normalized.droppedFeatures,
    ...edgeIssues,
    ...validationReport.issues,
  ];

  const ok = allIssues.every((issue) => issue.severity !== 'ERROR');

  return {
    package: pkg,
    validation: {
      ok,
      issues: allIssues,
    },
  };
}
