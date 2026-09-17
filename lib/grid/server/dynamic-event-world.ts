import { projectGridDynamicEvent } from '../core/dynamic-events';
import type {
  GridDynamicEventInstance,
  GridDynamicEventKind,
  GridDynamicEventTargetType,
} from '../core/dynamic-event-types';
import type { GridCityPackage } from '../core/types';

export interface GridDynamicEventWorldEntity {
  id: string;
  name: string;
}

export interface GridDynamicEventWorldTarget {
  type: GridDynamicEventTargetType;
  entities: GridDynamicEventWorldEntity[];
}

export interface GridDynamicEventWorldProjection {
  instanceId: string;
  kind: GridDynamicEventKind;
  startsAt: string;
  endsAt: string;
  target: GridDynamicEventWorldTarget;
}

export interface GridDynamicEventWorldOptions {
  routeLabels?: Readonly<Record<string, string>>;
}
function requirePackageCity(
  pkg: GridCityPackage,
  instance: GridDynamicEventInstance,
): void {
  if (instance.cityId !== pkg.city.slug) {
    throw new Error(
      `Dynamic event ${instance.instanceId} city ${instance.cityId} does not match package city ${pkg.city.slug}`,
    );
  }
}

function publicLandmarkName(
  landmark: GridCityPackage['landmarks'][number],
): string {
  if (
    landmark.privacyClass === 'PRIVATE_EXCLUDED' ||
    landmark.privacyClass === 'UNKNOWN_REVIEW_REQUIRED'
  ) {
    return 'Grid Landmark';
  }
  return landmark.name;
}

function resolveEntity(
  pkg: GridCityPackage,
  type: Exclude<GridDynamicEventTargetType, 'city' | 'route'>,
  id: string,
): GridDynamicEventWorldEntity {
  if (type === 'district') {
    const district = pkg.districts.find((candidate) => candidate.slug === id);
    if (!district) throw new Error(`unknown district ${id}`);
    return { id, name: district.name };
  }

  if (type === 'territory') {
    const territory = pkg.territories.find((candidate) => candidate.slug === id);
    if (!territory) throw new Error(`unknown territory ${id}`);
    return { id, name: territory.name };
  }

  if (type === 'property') {
    const property = pkg.properties.find((candidate) => candidate.slug === id);
    if (!property) throw new Error(`unknown property ${id}`);
    return {
      id,
      name: property.publicNameSafe ? property.name : 'Grid Property',
    };
  }

  const landmark = pkg.landmarks.find((candidate) => candidate.slug === id);
  if (!landmark) throw new Error(`unknown landmark ${id}`);
  return { id, name: publicLandmarkName(landmark) };
}
function resolveTarget(
  pkg: GridCityPackage,
  instance: GridDynamicEventInstance,
  options: GridDynamicEventWorldOptions,
): GridDynamicEventWorldTarget {
  if (instance.target.type === 'city') {
    return {
      type: 'city',
      entities: [{ id: pkg.city.slug, name: pkg.city.name }],
    };
  }

  if (instance.target.type === 'route') {
    const routeLabels = options.routeLabels ?? {};
    const entities = instance.target.ids.map((id) => {
      const name = routeLabels[id]?.trim();
      if (!name) throw new Error(`unknown public route ${id}`);
      return { id, name };
    });
    return { type: 'route', entities };
  }

  const targetType: Exclude<
    GridDynamicEventTargetType,
    'city' | 'route'
  > = instance.target.type;

  return {
    type: targetType,
    entities: instance.target.ids.map((id) =>
      resolveEntity(pkg, targetType, id),
    ),
  };
}
export function buildGridDynamicEventWorldProjection(
  pkg: GridCityPackage,
  instances: GridDynamicEventInstance[],
  now: string,
  options: GridDynamicEventWorldOptions = {},
): GridDynamicEventWorldProjection[] {
  return instances
    .map((instance) => {
      requirePackageCity(pkg, instance);
      const status = projectGridDynamicEvent(instance, now);
      if (!status.active) return null;

      return {
        instanceId: instance.instanceId,
        kind: instance.kind,
        startsAt: instance.startsAt,
        endsAt: instance.endsAt,
        target: resolveTarget(pkg, instance, options),
      };
    })
    .filter(
      (event): event is GridDynamicEventWorldProjection => event !== null,
    )
    .sort(
      (left, right) =>
        left.startsAt.localeCompare(right.startsAt) ||
        left.instanceId.localeCompare(right.instanceId),
    );
}
