import fs from 'node:fs';
import path from 'node:path';
import { getGridCityPackage } from '../lib/grid/cities/registry';
import { cantonRawGeography } from '../lib/grid/cities/canton/geography/raw-geography';
import { compileCityPackage } from '../lib/grid/compiler/pipeline';

const citySlug = process.argv[2];
const write = process.argv.includes('--write');

if (!citySlug) {
  console.error('Usage: npm run grid:compile-city -- <city-slug> [--write]');
  process.exit(2);
}
if (citySlug !== 'canton-oh') {
  console.error(`Unknown compilable Grid city: ${citySlug}`);
  process.exit(2);
}

const registered = getGridCityPackage(citySlug);
if (!registered) {
  console.error(`Unknown Grid city package: ${citySlug}`);
  process.exit(2);
}

const result = compileCityPackage(
  cantonRawGeography,
  registered.seasonTemplate,
  registered.city,
  {
    compilerVersion: registered.compilerVersion ?? '1.0.0',
    sourceSnapshotVersion: registered.sourceSnapshotVersion ?? 'canton-downtown-slice-v1',
    generatedAt: registered.generatedAt,
  },
);

const counts = {
  districts: result.package.districts.length,
  territories: result.package.territories.length,
  edges: result.package.edges.length,
  properties: result.package.properties.length,
  landmarks: result.package.landmarks.length,
};

console.log(`GRID compile: ${citySlug}`);
console.log(`validation: ${result.validation.ok ? 'OK' : 'FAILED'}`);
console.log(`counts: ${Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`checksum: ${result.package.checksum}`);
for (const issue of result.validation.issues) {
  console.log(`[${issue.severity}] ${issue.code}: ${issue.message}`);
}

if (write) {
  const outDir = path.resolve(process.cwd(), '.grid-output');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${citySlug}.compiled.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`wrote: ${path.relative(process.cwd(), outPath)}`);
}

if (!result.validation.ok) process.exit(1);
