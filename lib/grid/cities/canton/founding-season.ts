import type { GridCityPackage } from '../../core/types';
import { cantonDraftPackageFields } from './geography/canton-draft-package';
import { cantonFoundingSeasonEconomy } from './founding-season-economy';
import { cantonFoundingSeasonContest } from './founding-season-contest';
import { cantonFoundingSeasonCityPower } from './founding-season-city-power';

export const cantonFoundingSeasonPackage: GridCityPackage = {
  schemaVersion: 1,
  packageVersion: 1,
  status: 'draft',
  city: {
    slug: 'canton-oh',
    name: 'Canton',
    regionCode: 'OH',
    countryCode: 'US',
    timezone: 'America/New_York',
    // Existing Canton Quests central gathering point; this is only the
    // initial map camera anchor, not gameplay geography.
    mapCenter: { lat: 40.7989, lng: -81.3748 },
  },
  seasonTemplate: {
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
    cityPower: cantonFoundingSeasonCityPower,
  },
  ...cantonDraftPackageFields,
};
