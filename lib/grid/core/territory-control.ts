export interface GridTerritoryRef {
  slug: string;
}

export interface GridTerritoryEdgeRef {
  a: string;
  b: string;
}

export interface GridTerritoryOwnershipRef {
  territorySlug: string;
  ownerPlayerId: string | null;
}

export interface GridTerritoryControlProjectionInput {
  territories: GridTerritoryRef[];
  edges: GridTerritoryEdgeRef[];
  ownership: GridTerritoryOwnershipRef[];
  playerId: string;
  starterTerritorySlugs: string[];
}

export interface GridTerritoryControlProjection {
  ownedTerritorySlugs: string[];
  neutralTerritorySlugs: string[];
  validClaimSlugs: string[];
}

export function projectTerritoryControl(
  input: GridTerritoryControlProjectionInput,
): GridTerritoryControlProjection {
  const ownerBySlug = new Map(
    input.ownership.map((row) => [row.territorySlug, row.ownerPlayerId] as const),
  );
  const allSlugs = input.territories.map((territory) => territory.slug).sort();
  const known = new Set(allSlugs);

  const ownedTerritorySlugs = allSlugs.filter(
    (slug) => ownerBySlug.get(slug) === input.playerId,
  );
  const neutralTerritorySlugs = allSlugs.filter((slug) => {
    const owner = ownerBySlug.get(slug);
    return owner === undefined || owner === null;
  });
  const neutral = new Set(neutralTerritorySlugs);

  let validClaimSlugs: string[];
  if (ownedTerritorySlugs.length === 0) {
    validClaimSlugs = input.starterTerritorySlugs
      .filter((slug) => known.has(slug) && neutral.has(slug))
      .filter((slug, index, values) => values.indexOf(slug) === index)
      .sort();
  } else {
    const owned = new Set(ownedTerritorySlugs);
    const adjacentNeutral = new Set<string>();
    for (const edge of input.edges) {
      if (owned.has(edge.a) && neutral.has(edge.b)) adjacentNeutral.add(edge.b);
      if (owned.has(edge.b) && neutral.has(edge.a)) adjacentNeutral.add(edge.a);
    }
    validClaimSlugs = [...adjacentNeutral].sort();
  }

  return {
    ownedTerritorySlugs,
    neutralTerritorySlugs,
    validClaimSlugs,
  };
}
