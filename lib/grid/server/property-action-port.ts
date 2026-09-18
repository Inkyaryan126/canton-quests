export interface GridPropertyActionTarget {
  seasonId: string;
  seasonStatus: string;
  propertyId: string;
}

export interface GridPropertyActionPort {
  resolveTarget(propertySlug: string): Promise<GridPropertyActionTarget | null>;
}
