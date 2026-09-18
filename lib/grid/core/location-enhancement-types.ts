export type GridActivityImportance = 'essential' | 'optional';
export type GridActivityCompletionMode = 'remote' | 'location';

export interface GridActivityAccessPolicy {
  activityId: string;
  importance: GridActivityImportance;
  completionModes: GridActivityCompletionMode[];
}

export type GridLocationEnhancementBenefit =
  | {
      kind: 'scouting-intel';
      intelId: string;
    }
  | {
      kind: 'resource-cache';
      credits?: number;
      influence?: number;
      commandPoints?: number;
    }
  | {
      kind: 'temporary-modifier';
      modifierId: string;
      basisPoints: number;
      durationMinutes: number;
    }
  | {
      kind: 'cost-reduction';
      targetId: string;
      basisPoints: number;
      uses: number;
    }
  | {
      kind: 'optional-event-access';
      eventId: string;
    }
  | {
      kind: 'crossover-reward';
      rewardId: string;
    };

export interface GridLocationEnhancementRule {
  id: string;
  zoneId: string;
  benefit: GridLocationEnhancementBenefit;
  verificationMaxAgeMinutes: number;
  startsAt?: string;
  endsAt?: string;
  maxClaimsPerPlayer?: number;
}

export interface GridLocationAttestation {
  verificationId: string;
  zoneId: string;
  verifiedAt: string;
}

export interface GridLocationEnhancementContext {
  now: string;
  priorClaimCount: number;
}

export type GridLocationEnhancementReason =
  | 'eligible'
  | 'presence-not-verified'
  | 'zone-mismatch'
  | 'not-started'
  | 'ended'
  | 'verification-before-window'
  | 'verification-after-evaluation'
  | 'verification-expired'
  | 'claim-limit-reached';

export interface GridLocationEnhancementDecision {
  eligible: boolean;
  reason: GridLocationEnhancementReason;
  ruleId: string;
  verificationId: string | null;
  benefit: GridLocationEnhancementBenefit | null;
}
