export interface GridDirectDealMarketContext {
  cityId: string;
  seasonId: string;
  seasonStatus: string;
}

export interface GridDirectDealPublicPlayer {
  playerId: string;
  callsign: string;
}

export interface GridDirectDealStoredProposal {
  proposalId: string;
  seasonId: string;
  cityId: string;
  proposerPlayerId: string;
  counterpartyPlayerId: string;
  proposerCredits: number;
  counterpartyCredits: number;
  proposerPropertyIds: string[];
  counterpartyPropertyIds: string[];
  transactionTaxBps: number;
  propertyTradeCooldownMinutes: number;
  maxAssetsPerSide: number;
  createdAt: string;
  expiresAt: string;
  status: 'open' | 'accepted' | 'cancelled';
}

export interface GridDirectDealPropertySnapshot {
  propertyId: string;
  propertySlug: string;
  baseValueCredits: number;
  tradable: boolean;
  majorLandmark: boolean;
  ownerPlayerId: string | null;
  acquiredAt: string | null;
}

export interface GridDirectDealPlayerState {
  playerId: string;
  credits: number;
}

export interface GridDirectDealMarketPort {
  getContext(): Promise<GridDirectDealMarketContext | null>;
  resolvePlayerByCallsign(
    callsign: string,
  ): Promise<GridDirectDealPublicPlayer | null>;
  resolvePropertyIds(
    propertySlugs: readonly string[],
  ): Promise<Array<{ propertySlug: string; propertyId: string }>>;
  listOpenProposals(
    viewerPlayerId: string,
    now: string,
  ): Promise<GridDirectDealStoredProposal[]>;
  readProposal(proposalId: string): Promise<GridDirectDealStoredProposal | null>;
  readPlayerLabels(
    playerIds: readonly string[],
  ): Promise<GridDirectDealPublicPlayer[]>;
  readPlayerStates(
    playerIds: readonly string[],
  ): Promise<GridDirectDealPlayerState[]>;
  readProperties(
    propertyIds: readonly string[],
  ): Promise<GridDirectDealPropertySnapshot[]>;
}
