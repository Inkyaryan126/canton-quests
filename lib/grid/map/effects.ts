import type { GridMapRenderPacket } from './render-packet';

export type GridMapEffectKind =
  | 'contest-started'
  | 'contest-ended'
  | 'territory-control-changed'
  | 'building-risen'
  | 'building-lowered'
  | 'property-condition-changed'
  | 'skyline-changed';

export type GridMapEffectIntensity = 'soft' | 'strong';

export interface GridMapEffectCue {
  id: string;
  kind: GridMapEffectKind;
  entityId: string;
  intensity: GridMapEffectIntensity;
  from?: string | number;
  to?: string | number;
}

const EFFECT_PRIORITY: Record<GridMapEffectKind, number> = {
  'contest-started': 10,
  'contest-ended': 20,
  'territory-control-changed': 30,
  'building-risen': 40,
  'building-lowered': 40,
  'property-condition-changed': 50,
  'skyline-changed': 60,
};
function indexBy<T>(
  values: readonly T[],
  keyFor: (value: T) => string,
): Map<string, T> {
  return new Map(values.map((value) => [keyFor(value), value] as const));
}

function skylineSignature(packet: GridMapRenderPacket): string {
  return JSON.stringify(
    packet.skylines
      .map((skyline) => ({
        propertySlugs: [...skyline.propertySlugs].sort(),
        territorySlugs: [...skyline.territorySlugs].sort(),
        totalDevelopmentLevel: skyline.totalDevelopmentLevel,
        ruleIds: [...skyline.ruleIds].sort(),
      }))
      .sort((a, b) =>
        a.territorySlugs.join(':').localeCompare(b.territorySlugs.join(':')),
      ),
  );
}

function contestCues(
  previous: GridMapRenderPacket,
  next: GridMapRenderPacket,
): GridMapEffectCue[] {
  const before = indexBy(
    previous.contestFronts.features,
    (feature) => feature.properties.contestId,
  );
  const after = indexBy(
    next.contestFronts.features,
    (feature) => feature.properties.contestId,
  );
  const cues: GridMapEffectCue[] = [];
  for (const contestId of after.keys()) {
    if (before.has(contestId)) continue;
    cues.push({
      id: `contest-started:${contestId}`,
      kind: 'contest-started',
      entityId: contestId,
      intensity: 'strong',
    });
  }

  for (const contestId of before.keys()) {
    if (after.has(contestId)) continue;
    cues.push({
      id: `contest-ended:${contestId}`,
      kind: 'contest-ended',
      entityId: contestId,
      intensity: 'soft',
    });
  }

  return cues;
}

function territoryControlCues(
  previous: GridMapRenderPacket,
  next: GridMapRenderPacket,
): GridMapEffectCue[] {
  const before = indexBy(
    previous.territories.features,
    (feature) => feature.properties.slug,
  );
  const after = indexBy(
    next.territories.features,
    (feature) => feature.properties.slug,
  );
  const cues: GridMapEffectCue[] = [];
  for (const [slug, feature] of after) {
    const prior = before.get(slug);
    if (!prior) continue;
    const from = prior.properties.fillRole;
    const to = feature.properties.fillRole;
    if (from === to) continue;
    cues.push({
      id: `territory-control:${slug}:${from}:${to}`,
      kind: 'territory-control-changed',
      entityId: slug,
      intensity: 'strong',
      from,
      to,
    });
  }

  return cues;
}

function buildingCues(
  previous: GridMapRenderPacket,
  next: GridMapRenderPacket,
): GridMapEffectCue[] {
  const before = indexBy(
    previous.virtualBuildings,
    (building) => building.propertySlug,
  );
  const after = indexBy(
    next.virtualBuildings,
    (building) => building.propertySlug,
  );
  const ids = new Set([...before.keys(), ...after.keys()]);
  const cues: GridMapEffectCue[] = [];
  for (const propertySlug of ids) {
    const from = before.get(propertySlug)?.heightUnits ?? 0;
    const to = after.get(propertySlug)?.heightUnits ?? 0;
    if (from === to) continue;
    cues.push({
      id: `building-height:${propertySlug}:${from}:${to}`,
      kind: to > from ? 'building-risen' : 'building-lowered',
      entityId: propertySlug,
      intensity: Math.abs(to - from) >= 2 ? 'strong' : 'soft',
      from,
      to,
    });
  }

  return cues;
}

function conditionCues(
  previous: GridMapRenderPacket,
  next: GridMapRenderPacket,
): GridMapEffectCue[] {
  const before = indexBy(
    previous.properties.features,
    (feature) => feature.properties.slug,
  );
  const after = indexBy(
    next.properties.features,
    (feature) => feature.properties.slug,
  );
  const cues: GridMapEffectCue[] = [];

  for (const [slug, feature] of after) {
    const prior = before.get(slug);
    if (!prior) continue;
    const from = prior.properties.conditionBand;
    const to = feature.properties.conditionBand;
    if (from === to) continue;
    cues.push({
      id: `property-condition:${slug}:${from}:${to}`,
      kind: 'property-condition-changed',
      entityId: slug,
      intensity: 'soft',
      from,
      to,
    });
  }

  return cues;
}

export function deriveGridMapEffectCues(
  previous: GridMapRenderPacket,
  next: GridMapRenderPacket,
): GridMapEffectCue[] {
  const cues = [
    ...contestCues(previous, next),
    ...territoryControlCues(previous, next),
    ...buildingCues(previous, next),
    ...conditionCues(previous, next),
  ];

  if (skylineSignature(previous) !== skylineSignature(next)) {
    cues.push({
      id: 'skyline-changed',
      kind: 'skyline-changed',
      entityId: 'skyline',
      intensity: 'soft',
    });
  }

  return cues.sort((a, b) =>
    EFFECT_PRIORITY[a.kind] - EFFECT_PRIORITY[b.kind] ||
    a.id.localeCompare(b.id),
  );
}
