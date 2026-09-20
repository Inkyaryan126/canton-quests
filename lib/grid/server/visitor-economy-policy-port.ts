import type { GridVisitorEconomyEvidence, GridVisitorEconomyEvidencePort } from './visitor-economy-port';
import type { GridVisitorEconomyResolvedPolicy } from './supabase-visitor-economy-policy';

/** The only policy input accepted by the authorization boundary. */
export interface GridVisitorEconomyPolicyPort {
  resolvePolicy(
    targetCitySlug: string,
  ): Promise<GridVisitorEconomyResolvedPolicy | null>;
}

/** Evidence must come from the authoritative server adapter, never the caller. */
export interface GridVisitorEconomyAuthoritativeEvidencePort
  extends GridVisitorEconomyEvidencePort {
  readEvidence(
    playerId: string,
    targetCitySlug: string,
  ): Promise<GridVisitorEconomyEvidence>;
}
