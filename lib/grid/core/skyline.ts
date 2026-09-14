import { GRID_DEVELOPMENT_BRANCHES } from './economy-types';
import type {
  GridDevelopmentBranch,
  GridSkylineRule,
} from './economy-types';

export interface GridSkylinePropertyState {
  propertySlug: string;
  territorySlug: string;
  developmentBranch: GridDevelopmentBranch | null;
  developmentLevel: number;
}

export interface GridSkylineTerritoryEdge {
  a: string;
  b: string;
}

export interface GridSkylineComponent {
  propertySlugs: string[];
  territorySlugs: string[];
  totalDevelopmentLevel: number;
  branchCounts: Record<GridDevelopmentBranch, number>;
  distinctBranches: GridDevelopmentBranch[];
}

function territoryPair(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function emptyBranchCounts(): Record<GridDevelopmentBranch, number> {
  return {
    commerce: 0,
    influence: 0,
    fortress: 0,
    intel: 0,
    prestige: 0,
  };
}

export function computeSkylineComponents(
  propertyStates: GridSkylinePropertyState[],
  edges: GridSkylineTerritoryEdge[]
): GridSkylineComponent[] {
  const developed = propertyStates
    .filter((property) => property.developmentLevel > 0)
    .slice()
    .sort((a, b) => a.propertySlug.localeCompare(b.propertySlug));

  const propertySlugs = new Set<string>();
  for (const property of developed) {
    if (!Number.isSafeInteger(property.developmentLevel) || property.developmentLevel < 0) {
      throw new Error(`invalid development level for property ${property.propertySlug}`);
    }
    if (!property.developmentBranch) {
      throw new Error(`developed property ${property.propertySlug} requires a development branch`);
    }
    if (propertySlugs.has(property.propertySlug)) {
      throw new Error(`duplicate Skyline property slug: ${property.propertySlug}`);
    }
    propertySlugs.add(property.propertySlug);
  }

  const adjacentTerritories = new Set(edges.map((edge) => territoryPair(edge.a, edge.b)));
  const neighbors = new Map<string, string[]>();
  for (const property of developed) neighbors.set(property.propertySlug, []);

  for (let i = 0; i < developed.length; i += 1) {
    for (let j = i + 1; j < developed.length; j += 1) {
      const a = developed[i];
      const b = developed[j];
      const connected =
        a.territorySlug === b.territorySlug ||
        adjacentTerritories.has(territoryPair(a.territorySlug, b.territorySlug));
      if (!connected) continue;
      neighbors.get(a.propertySlug)!.push(b.propertySlug);
      neighbors.get(b.propertySlug)!.push(a.propertySlug);
    }
  }
  for (const list of neighbors.values()) list.sort();

  const bySlug = new Map(developed.map((property) => [property.propertySlug, property]));
  const visited = new Set<string>();
  const components: GridSkylineComponent[] = [];

  for (const root of developed) {
    if (visited.has(root.propertySlug)) continue;
    const queue = [root.propertySlug];
    const componentSlugs: string[] = [];
    visited.add(root.propertySlug);

    while (queue.length > 0) {
      const current = queue.shift()!;
      componentSlugs.push(current);
      for (const next of neighbors.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    componentSlugs.sort();
    const componentProperties = componentSlugs.map((slug) => bySlug.get(slug)!);
    const branchCounts = emptyBranchCounts();
    let totalDevelopmentLevel = 0;
    for (const property of componentProperties) {
      totalDevelopmentLevel += property.developmentLevel;
      branchCounts[property.developmentBranch!] += 1;
    }

    components.push({
      propertySlugs: componentSlugs,
      territorySlugs: [...new Set(componentProperties.map((property) => property.territorySlug))].sort(),
      totalDevelopmentLevel,
      branchCounts,
      distinctBranches: GRID_DEVELOPMENT_BRANCHES.filter((branch) => branchCounts[branch] > 0),
    });
  }

  return components.sort((a, b) => a.propertySlugs[0].localeCompare(b.propertySlugs[0]));
}

export function matchSkylineRules(
  component: GridSkylineComponent,
  rules: GridSkylineRule[]
): GridSkylineRule[] {
  return rules.filter((rule) => {
    if (component.propertySlugs.length < rule.minDevelopedProperties) return false;
    if (rule.branchMode === 'any') return true;
    if (rule.branchMode === 'single-branch') return component.distinctBranches.length === 1;
    return component.distinctBranches.length >= 2;
  });
}
