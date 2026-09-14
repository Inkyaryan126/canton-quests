import { getGridCityPackage } from '../lib/grid/cities/registry';
import { runCityValidation } from '../lib/grid/compiler/validate-package';

const citySlug = process.argv[2];
if (!citySlug) {
  console.error('Usage: npm run grid:inspect-city -- <city-slug>');
  process.exit(2);
}

const pkg = getGridCityPackage(citySlug);
if (!pkg) {
  console.error(`Unknown Grid city package: ${citySlug}`);
  process.exit(2);
}

const report = runCityValidation(pkg);
const severities = ['ERROR', 'WARNING', 'INFO'] as const;

console.log(`GRID city inspection: ${pkg.city.name} (${pkg.city.slug})`);
console.log(
  `counts: districts=${pkg.districts.length} territories=${pkg.territories.length} ` +
    `edges=${pkg.edges.length} properties=${pkg.properties.length} landmarks=${pkg.landmarks.length}`,
);
console.log(`compiler=${pkg.compilerVersion ?? 'legacy'} snapshot=${pkg.sourceSnapshotVersion ?? 'n/a'}`);
console.log(`checksum=${pkg.checksum ?? 'n/a'}`);

console.log('\nValidation issues');
for (const severity of severities) {
  const issues = report.issues.filter((issue) => issue.severity === severity);
  console.log(`${severity}: ${issues.length}`);
  for (const issue of issues) {
    const asset = issue.assetSlug ? ` [${issue.assetType ?? 'asset'}:${issue.assetSlug}]` : '';
    console.log(`  - ${issue.code}${asset}: ${issue.message}`);
  }
}
const unclassified = report.issues
  .filter((issue) => issue.code === 'PRIVACY_UNCLASSIFIED')
  .map((issue) => issue.assetSlug)
  .filter((slug): slug is string => Boolean(slug));
const islands = report.issues
  .filter((issue) => issue.code === 'TERRITORY_ISLAND')
  .map((issue) => issue.assetSlug)
  .filter((slug): slug is string => Boolean(slug));

console.log('\nUnclassified assets');
console.log(unclassified.length ? unclassified.map((slug) => `  - ${slug}`).join('\n') : '  (none)');
console.log('\nDisconnected zones');
console.log(islands.length ? islands.map((slug) => `  - ${slug}`).join('\n') : '  (none)');

const historicalAssets = [
  ...pkg.territories.map((asset) => ({ type: 'territory', slug: asset.slug, historical: asset.historical })),
  ...pkg.properties.map((asset) => ({ type: 'property', slug: asset.slug, historical: asset.historical })),
  ...pkg.landmarks.map((asset) => ({ type: 'landmark', slug: asset.slug, historical: asset.historical })),
];
const historicalFields = [
  'era', 'activationYear', 'builtYear', 'openedYear', 'retiredYear',
  'demolishedYear', 'predecessorSlug', 'successorSlug',
] as const;
const noHistorical = historicalAssets.filter((asset) => !asset.historical);
const partialHistorical = historicalAssets.filter((asset) =>
  asset.historical && historicalFields.some((field) => asset.historical?.[field] === undefined),
);

console.log('\nHistorical unknowns');
console.log(`no historical metadata: ${noHistorical.length}`);
for (const asset of noHistorical) console.log(`  - ${asset.type}:${asset.slug}`);
console.log(`partially populated historical metadata: ${partialHistorical.length}`);
for (const asset of partialHistorical) console.log(`  - ${asset.type}:${asset.slug}`);

const assetRefs = [
  ...pkg.districts.map((asset) => asset.sourceRefs ?? []),
  ...pkg.territories.map((asset) => asset.sourceRefs ?? []),
  ...pkg.properties.map((asset) => asset.sourceRefs ?? []),
  ...pkg.landmarks.map((asset) => asset.sourceRefs ?? []),
].flat();

console.log('\nProvenance');
for (const source of pkg.provenance ?? []) {
  const citations = assetRefs.filter((sourceRef) => sourceRef === source.id).length;
  console.log(
    `  - ${source.sourceName} | ${source.license} | retrieved ${source.retrievedAt} | ` +
      `${citations} asset citation${citations === 1 ? '' : 's'}`,
  );
}
if (!pkg.provenance?.length) console.log('  (none)');
