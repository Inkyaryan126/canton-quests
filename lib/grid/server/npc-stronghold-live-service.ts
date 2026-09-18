import type { GridCityPackage } from '../core/types';
import type { GridNpcStrongholdProjection } from '../core/npc-stronghold-types';
import {
  buildGridNpcStrongholdWorldProjection,
  type GridNpcStrongholdWorldProjection,
} from './npc-stronghold-world';
import type { GridNpcStrongholdRegistryPort } from './npc-stronghold-registry-port';
import type { GridNpcStrongholdRuntimeEvidencePort } from './npc-stronghold-runtime-port';
import {
  readGridNpcStrongholdRuntimeReadiness,
  resolveGridNpcStrongholdRuntimeReadiness,
} from './npc-stronghold-runtime-service';

export type GridNpcStrongholdLiveWorldResult =
  | {
      status: 'ready';
      missingFacts: [];
      strongholds: GridNpcStrongholdWorldProjection[];
    }
  | {
      status: 'incomplete';
      missingFacts: string[];
      strongholds: null;
    };

export async function listGridNpcStrongholdLiveWorld(
  registryPort: GridNpcStrongholdRegistryPort,
  evidencePort: GridNpcStrongholdRuntimeEvidencePort,
  pkg: GridCityPackage,
  now: string,
): Promise<GridNpcStrongholdLiveWorldResult> {
  const readiness = await readGridNpcStrongholdRuntimeReadiness(
    registryPort,
    evidencePort,
    {
      citySlug: pkg.city.slug,
      seasonSlug: pkg.seasonTemplate.slug,
      now,
    },
  );
  if (readiness.status === 'incomplete') {
    return {
      status: 'incomplete',
      missingFacts: readiness.missingFacts,
      strongholds: null,
    };
  }
  return {
    status: 'ready',
    missingFacts: [],
    strongholds: buildGridNpcStrongholdWorldProjection(
      pkg,
      readiness.runtimeInputs,
    ),
  };
}

export function createGridNpcStrongholdTrustedResolver(
  registryPort: GridNpcStrongholdRegistryPort,
  evidencePort: GridNpcStrongholdRuntimeEvidencePort,
  input: { citySlug: string; seasonSlug: string },
): (request: {
  strongholdId: string;
  now: string;
}) => Promise<GridNpcStrongholdProjection | null> {
  return async (request) => {
    const readiness = await resolveGridNpcStrongholdRuntimeReadiness(
      registryPort,
      evidencePort,
      {
        citySlug: input.citySlug,
        seasonSlug: input.seasonSlug,
        strongholdId: request.strongholdId,
        now: request.now,
      },
    );
    if (readiness.status === 'incomplete') {
      throw new Error(
        `Grid stronghold runtime evidence incomplete: ${readiness.missingFacts.join(', ')}`,
      );
    }
    return readiness.projection;
  };
}
