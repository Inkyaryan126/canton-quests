import type { GridMilestoneDefinition } from './types';

export const GRID_MILESTONES: GridMilestoneDefinition[] = [
  { id: 'city-compiler', title: 'City Compiler & Geography', phase: 'foundation', dependsOn: [], lanePatterns: ['city-compiler', 'road-acceptance'], branchPatterns: ['grid-city-', 'grid-road-acceptance'], integrationCommitSignals: ['City Compiler', 'compiler acceptance'] },
  { id: 'economy-core', title: 'Season Economy', phase: 'foundation', dependsOn: ['city-compiler'], lanePatterns: ['economy'], branchPatterns: ['grid-economy'], integrationCommitSignals: ['economy phase', 'Economy'] },
  { id: 'road-network', title: 'Road Network', phase: 'world', dependsOn: ['city-compiler'], lanePatterns: ['road-network'], branchPatterns: ['grid-road-network'], integrationCommitSignals: ['GRID Roads 13'] },
  { id: 'contest-system', title: 'Contest & Signal Dice', phase: 'gameplay', dependsOn: ['economy-core'], lanePatterns: ['contest', 'offline-defense'], branchPatterns: ['grid-contest', 'grid-offline-defense'], integrationCommitSignals: ['GRID Contest 6', 'authoritative round commands'] },
  { id: 'onboarding', title: 'Player Onboarding', phase: 'player', dependsOn: ['economy-core'], lanePatterns: ['onboarding'], branchPatterns: ['grid-onboarding'], integrationCommitSignals: ['GRID Onboarding 7'] },
  { id: 'map-world', title: '2.5D Map & World', phase: 'world', dependsOn: ['road-network'], lanePatterns: ['map-scene'], branchPatterns: ['grid-map-scene'], integrationCommitSignals: ['GRID Map'] },
  { id: 'market', title: 'Property Market', phase: 'economy', dependsOn: ['economy-core'], lanePatterns: ['market-auction-ui'], branchPatterns: ['grid-market-'], integrationCommitSignals: ['GRID Market/Auction:'] },
  { id: 'auctions', title: 'Auctions', phase: 'economy', dependsOn: ['market'], lanePatterns: ['market-auction-ui'], branchPatterns: ['grid-auction-', 'grid-market-auction-ui'], integrationCommitSignals: ['GRID Market/Auction:'] },
];
GRID_MILESTONES.push(
  { id: 'alliances', title: 'Alliances', phase: 'multiplayer', dependsOn: ['contest-system'], lanePatterns: ['alliance-core'], branchPatterns: ['grid-alliance'], integrationCommitSignals: ['GRID Alliance'] },
  { id: 'chat', title: 'Chat & Communications', phase: 'multiplayer', dependsOn: ['onboarding'], lanePatterns: ['chat-system'], branchPatterns: ['grid-chat'], integrationCommitSignals: ['GRID Comms'] },
  { id: 'progression', title: 'Progression & Rankings', phase: 'player', dependsOn: ['onboarding'], lanePatterns: ['progression-events'], branchPatterns: ['grid-progression'], integrationCommitSignals: ['GRID Progression'] },
  { id: 'mobile-platform', title: 'Mobile Platform Boundary', phase: 'platform', dependsOn: ['onboarding'], lanePatterns: ['mobile-platform'], branchPatterns: ['grid-mobile-platform'], integrationCommitSignals: ['GRID Mobile'] },
  { id: 'scrimmage', title: 'Scrimmage Mode', phase: 'multiplayer', dependsOn: ['contest-system'], lanePatterns: ['scrimmage-integration'], branchPatterns: ['grid-scrimmage'], integrationCommitSignals: ['GRID Scrimmage 6'] },
  { id: 'takeover', title: 'Takeover Persistence', phase: 'gameplay', dependsOn: ['contest-system'], lanePatterns: ['takeover-persistence'], branchPatterns: ['grid-takeover'], integrationCommitSignals: ['takeover persistence'] },
  { id: 'return-experience', title: 'Return Briefing', phase: 'player', dependsOn: ['onboarding'], lanePatterns: ['return-ui'], branchPatterns: ['grid-return'], integrationCommitSignals: ['return briefing'] },
  { id: 'dynamic-events', title: 'Dynamic Events', phase: 'world', dependsOn: ['map-world'], lanePatterns: ['dynamic-events'], branchPatterns: ['grid-dynamic-events'], integrationCommitSignals: ['GRID Events 1'] },
);
GRID_MILESTONES.push(
  { id: 'npc', title: 'NPC Factions & Strongholds', phase: 'world', dependsOn: ['dynamic-events'], lanePatterns: ['npc'], branchPatterns: ['grid-npc'], integrationCommitSignals: ['GRID NPC 3'] },
  { id: 'surge', title: 'The Surge', phase: 'season', dependsOn: ['contest-system'], lanePatterns: ['surge'], branchPatterns: ['grid-surge'], integrationCommitSignals: ['GRID Surge'] },
  { id: 'city-power', title: 'City Power', phase: 'strategy', dependsOn: ['contest-system'], lanePatterns: ['city-power'], branchPatterns: ['grid-city-power'], integrationCommitSignals: ['GRID Strategy 2'] },
  { id: 'dominance-heat', title: 'Dominance Heat', phase: 'strategy', dependsOn: ['city-power'], lanePatterns: ['dominance-heat'], branchPatterns: ['grid-dominance-heat'], integrationCommitSignals: ['GRID Strategy 1'] },
  { id: 'admin-control', title: 'GM / Admin Control Center', phase: 'operations', dependsOn: ['onboarding'], lanePatterns: ['admin-control-center'], branchPatterns: ['grid-admin-control-center'], integrationCommitSignals: ['GRID Admin:'] },
  { id: 'launch-readiness', title: 'Launch QA & Simulation', phase: 'operations', dependsOn: ['onboarding'], lanePatterns: ['launch-readiness'], branchPatterns: ['grid-launch-readiness'], integrationCommitSignals: ['GRID Launch Readiness:'] },
  { id: 'passport', title: 'Grid Passport', phase: 'identity', dependsOn: ['progression'], lanePatterns: ['passport'], branchPatterns: ['grid-passport'], integrationCommitSignals: ['Grid Passport'] },
  { id: 'location-play', title: 'Location-Enhanced Play', phase: 'world', dependsOn: ['map-world'], lanePatterns: ['location', 'gps'], branchPatterns: ['grid-location'], integrationCommitSignals: ['location bonus', 'GPS bonus'] },
);
GRID_MILESTONES.push(
  { id: 'anti-cheat', title: 'Anti-Cheat & Fraud Controls', phase: 'operations', dependsOn: ['market', 'contest-system'], lanePatterns: ['anti-cheat', 'fraud'], branchPatterns: ['grid-anti-cheat', 'grid-fraud'], integrationCommitSignals: ['anti-cheat', 'fraud controls'] },
  { id: 'season-archive', title: 'Season Conclusion & Archive', phase: 'season', dependsOn: ['surge', 'passport'], lanePatterns: ['season-archive', 'season-conclusion'], branchPatterns: ['grid-season-archive'], integrationCommitSignals: ['season archive', 'season conclusion'] },
  { id: 'production-activation', title: 'Canton Production Activation', phase: 'launch', dependsOn: ['launch-readiness', 'season-archive'], lanePatterns: ['production-activation'], branchPatterns: ['grid-production'], integrationCommitSignals: ['Founding Season activation', 'production activation'] },
);
