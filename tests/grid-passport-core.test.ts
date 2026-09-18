import { describe, expect, it } from 'vitest';
import { projectGridPassportHistory } from '../lib/grid/core/passport';

const HOME = '00000000-0000-4000-8000-000000000001';
const CITY_TWO = '00000000-0000-4000-8000-000000000002';
const CITY_THREE = '00000000-0000-4000-8000-000000000003';

describe('Grid Passport city-entry history', () => {
  it('projects permanent first/last entry history across multiple cities', () => {
    const passport = projectGridPassportHistory(HOME, [
      { cityId: CITY_TWO, enteredAt: '2026-10-03T12:00:00.000Z' },
      { cityId: HOME, enteredAt: '2026-09-18T12:00:00.000Z' },
      { cityId: CITY_TWO, enteredAt: '2026-10-05T09:30:00.000Z' },
      { cityId: CITY_THREE, enteredAt: '2026-11-01T15:00:00.000Z' },
    ]);

    expect(passport).toEqual({
      version: 1,
      homeCityId: HOME,
      citiesEntered: 3,
      entriesRecorded: 4,
      stamps: [
        {
          cityId: HOME,
          firstEnteredAt: '2026-09-18T12:00:00.000Z',
          lastEnteredAt: '2026-09-18T12:00:00.000Z',
          entryCount: 1,
          isHomeCity: true,
        },
        {
          cityId: CITY_TWO,
          firstEnteredAt: '2026-10-03T12:00:00.000Z',
          lastEnteredAt: '2026-10-05T09:30:00.000Z',
          entryCount: 2,
          isHomeCity: false,
        },
        {
          cityId: CITY_THREE,
          firstEnteredAt: '2026-11-01T15:00:00.000Z',
          lastEnteredAt: '2026-11-01T15:00:00.000Z',
          entryCount: 1,
          isHomeCity: false,
        },
      ],
    });
  });

  it('is deterministic regardless of authoritative record order', () => {
    const entries = [
      { cityId: CITY_TWO, enteredAt: '2026-10-05T09:30:00.000Z' },
      { cityId: HOME, enteredAt: '2026-09-18T12:00:00.000Z' },
      { cityId: CITY_TWO, enteredAt: '2026-10-03T12:00:00.000Z' },
    ];

    expect(projectGridPassportHistory(HOME, entries)).toEqual(
      projectGridPassportHistory(HOME, [...entries].reverse()),
    );
  });

  it('keeps Home City identity without inventing an entry stamp', () => {
    expect(projectGridPassportHistory(HOME, [])).toEqual({
      version: 1,
      homeCityId: HOME,
      citiesEntered: 0,
      entriesRecorded: 0,
      stamps: [],
    });
  });

  it('rejects blank identifiers and malformed timestamps', () => {
    expect(() => projectGridPassportHistory('   ', [])).toThrow(
      'Grid Passport requires a non-empty homeCityId',
    );
    expect(() =>
      projectGridPassportHistory(HOME, [
        { cityId: ' ', enteredAt: '2026-09-18T12:00:00.000Z' },
      ]),
    ).toThrow('Grid Passport requires a non-empty cityId');
    expect(() =>
      projectGridPassportHistory(HOME, [
        { cityId: CITY_TWO, enteredAt: 'not-a-date' },
      ]),
    ).toThrow('Grid Passport entry requires a valid enteredAt timestamp');
  });

  it('does not carry local wealth between cities', () => {
    const passport = projectGridPassportHistory(HOME, [
      { cityId: HOME, enteredAt: '2026-09-18T12:00:00.000Z' },
      { cityId: CITY_TWO, enteredAt: '2026-10-03T12:00:00.000Z' },
    ]);
    const serialized = JSON.stringify(passport);

    expect(serialized).not.toMatch(/credits|influence|commandPoints/i);
  });
});
