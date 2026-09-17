import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { instantiateGridDynamicEvent } from '../lib/grid/core/dynamic-events';
import type { GridDynamicEventTemplate } from '../lib/grid/core/dynamic-event-types';
import { buildGridDynamicEventWorldProjection } from '../lib/grid/server/dynamic-event-world';

const pkg = cantonFoundingSeasonPackage;

function template(
  overrides: Partial<GridDynamicEventTemplate> = {},
): GridDynamicEventTemplate {
  return {
    id: 'event-template',
    kind: 'economic-boom',
    durationMinutes: 60,
    priority: 10,
    target: { type: 'city', ids: [] },
    modifiers: [
      { key: 'credits-income', operation: 'add-bps', value: 1_500 },
    ],
    tags: ['internal-balance-tag'],
    ...overrides,
  };
}
function instance(
  eventTemplate: GridDynamicEventTemplate,
  instanceId: string,
  startsAt: string,
) {
  return instantiateGridDynamicEvent(eventTemplate, {
    instanceId,
    cityId: pkg.city.slug,
    startsAt,
  });
}

describe('Grid Dynamic Event world projection', () => {
  it('returns only events active at the requested instant', () => {
    const active = instance(template(), 'active-event', '2026-09-17T18:00:00Z');
    const ended = instance(template(), 'ended-event', '2026-09-17T16:00:00Z');
    const scheduled = instance(template(), 'scheduled-event', '2026-09-17T20:00:00Z');

    const projection = buildGridDynamicEventWorldProjection(
      pkg,
      [scheduled, ended, active],
      '2026-09-17T18:30:00Z',
    );

    expect(projection.map((event) => event.instanceId)).toEqual(['active-event']);
  });
  it('resolves public city, district, territory, and landmark target names', () => {
    const district = pkg.districts[0];
    const territory = pkg.territories.find(
      (candidate) => candidate.districtSlug === district.slug,
    )!;
    const landmark = pkg.landmarks.find(
      (candidate) => candidate.territorySlug === territory.slug,
    ) ?? pkg.landmarks[0];

    const events = [
      instance(template(), 'city-event', '2026-09-17T18:00:00Z'),
      instance(template({
        id: 'district-template',
        target: { type: 'district', ids: [district.slug] },
      }), 'district-event', '2026-09-17T18:00:00Z'),
      instance(template({
        id: 'territory-template',
        target: { type: 'territory', ids: [territory.slug] },
      }), 'territory-event', '2026-09-17T18:00:00Z'),
      instance(template({
        id: 'landmark-template',
        target: { type: 'landmark', ids: [landmark.slug] },
      }), 'landmark-event', '2026-09-17T18:00:00Z'),
    ];
    const projection = buildGridDynamicEventWorldProjection(
      pkg,
      events,
      '2026-09-17T18:30:00Z',
    );

    expect(projection.find((event) => event.instanceId === 'city-event')?.target)
      .toEqual({ type: 'city', entities: [{ id: pkg.city.slug, name: pkg.city.name }] });
    expect(projection.find((event) => event.instanceId === 'district-event')?.target)
      .toEqual({ type: 'district', entities: [{ id: district.slug, name: district.name }] });
    expect(projection.find((event) => event.instanceId === 'territory-event')?.target)
      .toEqual({ type: 'territory', entities: [{ id: territory.slug, name: territory.name }] });
    expect(projection.find((event) => event.instanceId === 'landmark-event')?.target)
      .toEqual({ type: 'landmark', entities: [{ id: landmark.slug, name: landmark.name }] });
  });

  it('sanitizes private property names before they reach the player', () => {
    const privateProperty = {
      ...pkg.properties[0],
      name: 'Private Residence Name',
      publicNameSafe: false,
    };
    const privatePkg = {
      ...pkg,
      properties: [privateProperty, ...pkg.properties.slice(1)],
    };
    const event = instance(template({
      target: { type: 'property', ids: [privateProperty.slug] },
    }), 'private-property-event', '2026-09-17T18:00:00Z');
    const [projection] = buildGridDynamicEventWorldProjection(
      privatePkg,
      [event],
      '2026-09-17T18:30:00Z',
    );

    expect(projection.target).toEqual({
      type: 'property',
      entities: [{ id: privateProperty.slug, name: 'Grid Property' }],
    });
    expect(JSON.stringify(projection)).not.toContain(privateProperty.name);
  });

  it('requires an explicit public route-label registry for route events', () => {
    const event = instance(template({
      kind: 'route-disruption',
      target: { type: 'route', ids: ['route-downtown-loop'] },
    }), 'route-event', '2026-09-17T18:00:00Z');

    expect(() =>
      buildGridDynamicEventWorldProjection(
        pkg,
        [event],
        '2026-09-17T18:30:00Z',
      ),
    ).toThrow(/unknown public route route-downtown-loop/);
    const [projection] = buildGridDynamicEventWorldProjection(
      pkg,
      [event],
      '2026-09-17T18:30:00Z',
      { routeLabels: { 'route-downtown-loop': 'Downtown Loop' } },
    );

    expect(projection.target).toEqual({
      type: 'route',
      entities: [{ id: 'route-downtown-loop', name: 'Downtown Loop' }],
    });
  });

  it('rejects events for the wrong city and unknown package targets', () => {
    const wrongCity = {
      ...instance(template(), 'wrong-city', '2026-09-17T18:00:00Z'),
      cityId: 'other-city',
    };
    expect(() =>
      buildGridDynamicEventWorldProjection(
        pkg,
        [wrongCity],
        '2026-09-17T18:30:00Z',
      ),
    ).toThrow(/does not match package city/);

    const unknownDistrict = instance(template({
      target: { type: 'district', ids: ['missing-district'] },
    }), 'unknown-district', '2026-09-17T18:00:00Z');
    expect(() =>
      buildGridDynamicEventWorldProjection(
        pkg,
        [unknownDistrict],
        '2026-09-17T18:30:00Z',
      ),
    ).toThrow(/unknown district missing-district/);
  });

  it('does not expose internal balancing metadata', () => {
    const event = instance(template(), 'safe-public-event', '2026-09-17T18:00:00Z');
    const [projection] = buildGridDynamicEventWorldProjection(
      pkg,
      [event],
      '2026-09-17T18:30:00Z',
    );
    const serialized = JSON.stringify(projection);

    expect(projection).toMatchObject({
      instanceId: 'safe-public-event',
      kind: 'economic-boom',
      startsAt: '2026-09-17T18:00:00.000Z',
      endsAt: '2026-09-17T19:00:00.000Z',
    });
    expect(serialized).not.toContain('credits-income');
    expect(serialized).not.toContain('internal-balance-tag');
    expect(serialized).not.toContain('priority');
    expect(serialized).not.toContain('templateId');
    expect(serialized).not.toContain('modifiers');
  });
});
