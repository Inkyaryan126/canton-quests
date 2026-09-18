import { compileCityPackage } from '../../../compiler/pipeline';
import type { GridCityPackage } from '../../../core/types';
import { cantonFoundingSeasonEconomy } from '../founding-season-economy';
import { cantonFoundingSeasonContest } from '../founding-season-contest';
import { cantonFoundingSeasonAlliance } from '../founding-season-alliance';
import { cantonRawGeography } from './raw-geography';

const cantonCityMeta: GridCityPackage['city'] = {
  slug: 'canton-oh',
  name: 'Canton',
  regionCode: 'OH',
  countryCode: 'US',
  timezone: 'America/New_York',
  mapCenter: { lat: 40.7989, lng: -81.3748 },
};

const cantonSeasonTemplate: GridCityPackage['seasonTemplate'] = {
  slug: 'founding-season',
  name: 'Founding Season',
  durationDays: 30,
  surgeHours: 72,
  balance: {
    startingCredits: 5000,
    startingInfluence: 100,
    maxCommandPoints: 10,
    commandPointRegenMinutes: 60,
  },
  economy: cantonFoundingSeasonEconomy,
  contest: cantonFoundingSeasonContest,
  alliance: cantonFoundingSeasonAlliance,
};

const compiled = compileCityPackage(
  cantonRawGeography,
  cantonSeasonTemplate,
  cantonCityMeta,
  {
    compilerVersion: '1.0.0',
    sourceSnapshotVersion: 'canton-downtown-slice-v1',
  },
);

export const cantonDraftValidation = compiled.validation;

export const cantonDraftPackageFields = {
  districts: compiled.package.districts,
  territories: compiled.package.territories,
  edges: compiled.package.edges,
  properties: compiled.package.properties,
  landmarks: compiled.package.landmarks,
  compilerVersion: compiled.package.compilerVersion,
  sourceSnapshotVersion: compiled.package.sourceSnapshotVersion,
  generatedAt: compiled.package.generatedAt,
  checksum: compiled.package.checksum,
  provenance: compiled.package.provenance,
} satisfies Pick<
  GridCityPackage,
  | 'districts'
  | 'territories'
  | 'edges'
  | 'properties'
  | 'landmarks'
  | 'compilerVersion'
  | 'sourceSnapshotVersion'
  | 'generatedAt'
  | 'checksum'
  | 'provenance'
>;
