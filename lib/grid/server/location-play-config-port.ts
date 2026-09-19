import type { GridLocationEnhancementRule } from '../core/location-enhancement-types';
import type { GridLocationPresenceZone } from './location-presence-verifier';

export interface GridLocationPlayRuleResolution {
  cityId: string;
  seasonId: string;
  seasonStatus: string;
  startsAt: string | null;
  endsAt: string | null;
  rule: GridLocationEnhancementRule;
  zone: GridLocationPresenceZone;
}

export interface GridLocationPlayConfigPort {
  resolveRule(
    citySlug: string,
    seasonSlug: string,
    ruleId: string,
  ): Promise<GridLocationPlayRuleResolution | null>;
}
