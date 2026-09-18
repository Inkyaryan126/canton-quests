export interface GridNpcStrongholdRuntimeEvidenceRequest {
  citySlug: string;
  seasonSlug: string;
  now: string;
  strongholdIds: string[];
  factionIds: string[];
}

export interface GridNpcStrongholdRuntimeEvidence {
  citySlug: string;
  seasonSlug: string;
  seasonActive: boolean | null;
  surgeIntensityBps: number | null;
  eventActiveByStrongholdId: Readonly<Record<string, boolean | null | undefined>>;
  factionPressureBpsByFaction: Readonly<Record<string, number | null | undefined>>;
}

export interface GridNpcStrongholdRuntimeEvidencePort {
  readEvidence(
    request: GridNpcStrongholdRuntimeEvidenceRequest,
  ): Promise<GridNpcStrongholdRuntimeEvidence>;
}
