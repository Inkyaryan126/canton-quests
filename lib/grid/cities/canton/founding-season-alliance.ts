import type { GridAllianceRules } from '../../core/alliance-types';

/**
 * Founding-season Alliance tuning.
 *
 * The six-player cap keeps early Alliances coordinated without allowing one
 * group to absorb the city. The 600-Influence pool equals one full starting
 * Influence allocation per maximum member; fragmentation and >4-member
 * surcharges make large, disconnected networks increasingly expensive.
 */
export const cantonFoundingSeasonAlliance = {
  maxMembers: 6,
  leaveCooldownSeconds: 24 * 60 * 60,
  influencePoolCap: 600,
  baseUpkeepInfluencePerTick: 4,
  memberUpkeepInfluencePerTick: 2,
  disconnectedComponentUpkeepInfluencePerTick: 4,
  largeAllianceThreshold: 4,
  largeAllianceSurchargeInfluencePerMemberPerTick: 3,
} satisfies GridAllianceRules;
