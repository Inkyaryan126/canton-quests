import { projectGridNpcStronghold } from '../core/npc-strongholds';
import type {
  GridNpcStrongholdActivation,
  GridNpcStrongholdConfig,
  GridNpcStrongholdContext,
  GridNpcStrongholdStatus,
} from '../core/npc-stronghold-types';
import type { GridCityPackage, GridLatLng } from '../core/types';

export interface GridNpcStrongholdWorldInput {
  config: GridNpcStrongholdConfig;
  context: GridNpcStrongholdContext;
}

interface GridNpcStrongholdWorldTargetBase {
  territorySlug: string;
  territoryName: string;
  districtSlug: string;
}

export type GridNpcStrongholdWorldTarget =
  | (GridNpcStrongholdWorldTargetBase & {
      kind: 'pve-territory';
    })
  | (GridNpcStrongholdWorldTargetBase & {
      kind: 'pve-landmark';
      landmark: {
        slug: string;
        name: string;
        point: GridLatLng;
      };
    });
export interface GridNpcStrongholdWorldProjection {
  strongholdId: string;
  factionId: string;
  status: Exclude<GridNpcStrongholdStatus, 'dormant'>;
  activationReason: GridNpcStrongholdActivation | null;
  contestable: boolean;
  garrisonInfluence: number;
  target: GridNpcStrongholdWorldTarget;
}

function worldTargetFor(
  pkg: GridCityPackage,
  config: GridNpcStrongholdConfig,
): GridNpcStrongholdWorldTarget {
  const territory = pkg.territories.find(
    (candidate) => candidate.slug === config.territorySlug,
  );
  if (!territory) {
    throw new Error(
      `NPC stronghold ${config.strongholdId} references unknown territory ${config.territorySlug}`,
    );
  }

  const base = {
    territorySlug: territory.slug,
    territoryName: territory.name,
    districtSlug: territory.districtSlug,
  };

  if (!config.landmarkSlug) {
    return { ...base, kind: 'pve-territory' };
  }
  const landmark = pkg.landmarks.find(
    (candidate) => candidate.slug === config.landmarkSlug,
  );
  if (!landmark) {
    throw new Error(
      `NPC stronghold ${config.strongholdId} references unknown landmark ${config.landmarkSlug}`,
    );
  }
  if (landmark.territorySlug !== territory.slug) {
    throw new Error(
      `NPC stronghold ${config.strongholdId} landmark ${landmark.slug} does not belong to territory ${territory.slug}`,
    );
  }

  return {
    ...base,
    kind: 'pve-landmark',
    landmark: {
      slug: landmark.slug,
      name: landmark.name,
      point: landmark.point,
    },
  };
}

export function buildGridNpcStrongholdWorldProjection(
  pkg: GridCityPackage,
  inputs: GridNpcStrongholdWorldInput[],
): GridNpcStrongholdWorldProjection[] {
  const seen = new Set<string>();
  return inputs.flatMap(({ config, context }) => {
    if (seen.has(config.strongholdId)) {
      throw new Error(`duplicate NPC stronghold id: ${config.strongholdId}`);
    }
    seen.add(config.strongholdId);

    const target = worldTargetFor(pkg, config);
    const projection = projectGridNpcStronghold(config, context);
    if (projection.status === 'dormant') return [];

    return [{
      strongholdId: projection.strongholdId,
      factionId: projection.objective.factionId,
      status: projection.status,
      activationReason: projection.activationReason,
      contestable: projection.contestable,
      garrisonInfluence: projection.garrisonInfluence,
      target,
    }];
  });
}
