import { getGridCityPackage } from '../lib/grid/cities/registry';
import { validateGridCityPackage } from '../lib/grid/core/city-package';

const citySlug = process.argv[2];

if (!citySlug) {
  console.error('Usage: npm run grid:validate-city -- <city-slug>');
  process.exit(2);
}

const pkg = getGridCityPackage(citySlug);
if (!pkg) {
  console.error(`Unknown Grid city package: ${citySlug}`);
  process.exit(2);
}

const result = validateGridCityPackage(pkg);
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      city: pkg.city.slug,
      packageVersion: pkg.packageVersion,
      status: pkg.status,
      districts: pkg.districts.length,
      territories: pkg.territories.length,
      properties: pkg.properties.length,
      landmarks: pkg.landmarks.length,
    },
    null,
    2
  )
);
