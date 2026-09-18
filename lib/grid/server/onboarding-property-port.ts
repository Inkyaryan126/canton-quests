export interface GridOnboardingPropertyRefPort {
  resolvePropertyId(propertySlug: string): Promise<string | null>;
}
