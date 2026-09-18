export interface GridPassportCityEntry {
  cityId: string;
  enteredAt: string;
}

export interface GridPassportCityStamp {
  cityId: string;
  firstEnteredAt: string;
  lastEnteredAt: string;
  entryCount: number;
  isHomeCity: boolean;
}

export interface GridPassportHistory {
  version: 1;
  homeCityId: string | null;
  citiesEntered: number;
  entriesRecorded: number;
  stamps: GridPassportCityStamp[];
}
