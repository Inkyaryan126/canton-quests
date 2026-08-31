// Canton Quests — Phase 3 Test Seed Data (Canton, Ohio)

import {
  City,
  QuestEvent,
  LocationInfo,
  Quest,
  Player,
  LiveAnnouncement,
  SecretCode,
  Collectible,
  Achievement,
  NPCCharacter,
  BusinessPartnerInfo,
  CrowdObjective,
  BonusWindow,
  Prize,
} from './types';
import { CORE_QR_POINTS, DAILY_BONUS_POINTS, FAIR_BONUS_DATES, fairBonusQuestSlug, fairCoreQuestSlug } from './fair-hunt';

export const SEED_CITY: City = {
  id: 'city-canton-oh',
  name: 'Canton',
  slug: 'canton-oh',
  state: 'OH',
  isActive: true,
  createdAt: '2026-08-01T00:00:00Z',
};

export const SEED_LOCATIONS: LocationInfo[] = [
  {
    id: 'loc-centennial-plaza',
    cityId: SEED_CITY.id,
    name: 'Centennial Plaza',
    address: '330 Market Ave N, Canton, OH 44702',
    latitude: 40.7989,
    longitude: -81.3748,
    locationNotes: 'Downtown Canton central gathering space with outdoor screens and cafe seating.',
    isPartner: true,
    radiusMeters: 60,
    accessNotes: 'Open public plaza 6:00 AM – 11:00 PM daily. High pedestrian zone.',
    openingHours: '6:00 AM - 11:00 PM',
  },
  {
    id: 'loc-mckinley-monument',
    cityId: SEED_CITY.id,
    name: 'McKinley National Memorial',
    address: '800 McKinley Monument Dr NW, Canton, OH 44708',
    latitude: 40.8064,
    longitude: -81.3933,
    locationNotes: 'Historic 108-step monument overlooking the park and city.',
    isPartner: false,
    radiusMeters: 80,
    accessNotes: 'Park grounds open dawn to dusk. Stairway can be slick in rainy weather.',
    openingHours: 'Dawn - Dusk',
  },
  {
    id: 'loc-4th-st-mural',
    cityId: SEED_CITY.id,
    name: '4th Street Arts Corridor Mural',
    address: '4th St NW & Court Ave NW, Canton, OH 44702',
    latitude: 40.7995,
    longitude: -81.3755,
    locationNotes: 'Vibrant street art wall in the heart of downtown Canton Arts District.',
    isPartner: true,
    radiusMeters: 50,
    accessNotes: 'Public sidewalk access 24/7. Watch for downtown vehicular traffic.',
    openingHours: '24/7 Public Access',
  },
  {
    id: 'loc-aura-craft-coffee',
    cityId: SEED_CITY.id,
    name: 'Aura Craft Coffee',
    address: '414 4th St NW, Canton, OH 44702',
    latitude: 40.7998,
    longitude: -81.3761,
    locationNotes: 'Local partner coffee shop. Look near the espresso counter or patio area.',
    isPartner: true,
    radiusMeters: 40,
    accessNotes: 'Indoor scanning during business hours (7 AM - 6 PM M-S). Patio access 24/7.',
    openingHours: '7:00 AM - 6:00 PM',
  },
  {
    id: 'loc-arcade-bar',
    cityId: SEED_CITY.id,
    name: 'Downtown Canton Arcade Vault',
    address: '218 Market Ave N, Canton, OH 44702',
    latitude: 40.7978,
    longitude: -81.3748,
    locationNotes: 'Retro arcade venue featuring vintage pinball and arcade cabinets.',
    isPartner: true,
    radiusMeters: 40,
    accessNotes: 'Family friendly hours 12 PM - 8 PM.',
    openingHours: '12:00 PM - 10:00 PM',
  },
  {
    id: 'loc-music-hall',
    cityId: SEED_CITY.id,
    name: 'Canton Palace Theatre',
    address: '605 Market Ave N, Canton, OH 44702',
    latitude: 40.8012,
    longitude: -81.3748,
    locationNotes: 'Historic theater marquee and architectural gem of Canton.',
    isPartner: true,
    radiusMeters: 50,
    accessNotes: 'Marquee visible from sidewalk 24/7.',
    openingHours: '24/7 Outdoor Access',
  },
  {
    id: 'loc-hof-trail',
    cityId: SEED_CITY.id,
    name: 'Hall of Fame City Marker',
    address: '2121 George Halas Dr NW, Canton, OH 44708',
    latitude: 40.8211,
    longitude: -81.3985,
    locationNotes: 'Commemorative plaza marker celebrating Canton football heritage.',
    isPartner: false,
    radiusMeters: 75,
    accessNotes: 'Outdoor trail plaza open daily.',
    openingHours: 'Dawn - Dusk',
  },
  {
    id: 'loc-onesto-building',
    cityId: SEED_CITY.id,
    name: 'The Onesto Historic Entrance',
    address: '225 2nd St NW, Canton, OH 44702',
    latitude: 40.7971,
    longitude: -81.3752,
    locationNotes: 'Grand historic hotel building with ornate brass entrance doors.',
    isPartner: false,
    radiusMeters: 45,
    accessNotes: 'Public sidewalk view.',
    openingHours: '24/7',
  },
  {
    id: 'loc-mother-goose-land',
    cityId: SEED_CITY.id,
    name: 'Mother Goose Land',
    address: '714 12th St NW, Canton, OH 44703',
    latitude: 40.8055,
    longitude: -81.3862,
    locationNotes: 'Historic Canton park featuring large illustrated mural walls and nostalgic storybook character landmarks.',
    isPartner: false,
    radiusMeters: 60,
    accessNotes: 'Open public park. Daylight hours recommended. Check current seasonal operating status before visiting.',
    openingHours: 'Dawn - Dusk (seasonal)',
  },
  {
    id: 'loc-west-lawn-frankenstein',
    cityId: SEED_CITY.id,
    name: 'Frankenstein Monument at West Lawn Cemetery',
    address: '1919 7th St NW, Canton, OH 44708',
    locationNotes:
      'Human field verification required before launch: confirm exact monument location, cemetery visitor rules, and any photography restrictions with West Lawn Cemetery staff.',
    isPartner: false,
    radiusMeters: 60,
    accessNotes:
      'Daylight cemetery visit only during posted visitor hours. Stay on cemetery paths and roads, keep voices low, and never touch, climb, lean on, decorate, or disturb graves, monuments, markers, flowers, or memorial items.',
    openingHours: 'Posted visitor hours only; daylight access. Gates may close earlier in winter. Reconfirm before launch.',
  },
  {
    id: 'loc-9th-street',
    cityId: SEED_CITY.id,
    name: '9th Street Skate Corridor',
    address: '9th St NW, Canton, OH 44703',
    latitude: 40.8060,
    longitude: -81.3870,
    locationNotes: 'Urban skate corridor and open recreation area at the edge of the Challenge district.',
    isPartner: false,
    radiusMeters: 60,
    accessNotes: 'Public outdoor space. Daylight hours recommended.',
    openingHours: 'Dawn - Dusk',
  },
  {
    id: 'loc-challenge-field',
    cityId: SEED_CITY.id,
    name: 'Challenge Field',
    address: '9th St NW & Shriver Ave NW, Canton, OH 44703',
    latitude: 40.8058,
    longitude: -81.3866,
    locationNotes: 'Large open field location from the Challenge Sector route.',
    isPartner: false,
    radiusMeters: 60,
    accessNotes: 'Open public park field ground. Daylight hours recommended.',
    openingHours: 'Dawn - Dusk',
  },
  {
    id: 'loc-challenge-tower',
    cityId: SEED_CITY.id,
    name: 'The Tower at Mother Goose Land',
    address: '714 12th St NW, Canton, OH 44703',
    latitude: 40.8056,
    longitude: -81.3864,
    locationNotes: 'Historic storybook silo/tower landmark standing over Mother Goose Land.',
    isPartner: false,
    radiusMeters: 60,
    accessNotes: 'Open public park ground. Daylight hours recommended.',
    openingHours: 'Dawn - Dusk',
  },
];

export const SEED_EVENT: QuestEvent = {
  id: 'evt-canton-vol-1',
  cityId: SEED_CITY.id,
  title: "Canton Quests: Volume 1 - The Founder's Cipher",
  slug: 'canton-weekend-1',
  description:
    'A real-world Canton adventure of founder marks, hidden field signals, public art, history nodes, partner stops, and one respectful cemetery mystery.',
  status: 'active',
  currentPhase: 'day_1',
  isPaused: false,
  startTime: '2026-09-11T18:00:00Z',
  endTime: '2026-09-14T22:00:00Z',
  basicInstructions:
    '1. Choose a mission from the board.\n2. Travel only to public or partner-approved places during posted hours.\n3. Use the on-site clue, QR, photo, or GPS check to submit proof.\n4. Earn XP and drawing entries, then check progress and the leaderboard.',
  safetyNotes:
    'Use marked crosswalks, obey posted hours, avoid private property, and skip any location that feels unsafe or unavailable. Cemetery quests are daylight-only and require respectful conduct.',
  mapCenterLat: 40.7989,
  mapCenterLon: -81.3748,
  themeColor: '#f5b942',
  createdAt: '2026-08-01T00:00:00Z',
  requiresPath: true,
};

// The Fair QR Hunt — a real, independent Operation. Path-free: a scan-based
// scavenger hunt for the county fair, distinct from the Sept 11 Main
// Operation's three-path experience. Its own event_id keeps its scoring,
// leaderboard, and participation completely separate from Volume 1.
export const SEED_FAIR_EVENT: QuestEvent = {
  id: 'evt-canton-fair-qr-hunt',
  cityId: SEED_CITY.id,
  title: 'Canton Quests: Fair QR Hunt',
  slug: 'fair-qr-hunt',
  description:
    'A path-free QR scavenger hunt across the fairgrounds. Scan every unique QR marker you can find for points toward the $100 Fair QR Hunt prize — no starting path required.',
  status: 'active',
  currentPhase: 'day_1',
  isPaused: false,
  // Sept 4, 12:00 AM America/New_York -> Sept 5, 11:59:59 PM America/New_York.
  // America/New_York is a fixed UTC-4 (EDT) offset for all of September
  // 2026 (DST doesn't end until early November), so these are safe fixed
  // UTC instants — mirrors the fair-qr-hunt event row seeded in
  // supabase/migrations/20260826072300_operation_scoped_path_and_fair_hunt.sql.
  startTime: '2026-09-04T04:00:00Z',
  endTime: '2026-09-06T03:59:59Z',
  basicInstructions:
    '1. Explore the fairgrounds and find the QR markers.\n2. Scan each one — every unique marker counts once per player.\n3. Track your live rank on the Fair QR Hunt leaderboard.',
  safetyNotes: 'Stay in public fairground areas, follow posted event staff instructions, and use marked walkways.',
  mapCenterLat: 40.7989,
  mapCenterLon: -81.3748,
  themeColor: '#22d3ee',
  createdAt: '2026-08-15T00:00:00Z',
  requiresPath: false,
};

// Demo Players with Path & Attribution Metadata
export const SEED_DEMO_PLAYERS: Player[] = [
  {
    id: 'plr-apex-hunter',
    displayName: 'ApexHunter_330',
    avatarUrl: '⚡',
    role: 'player',
    totalXp: 850,
    level: 4,
    selectedStartingPath: 'challenge',
    acquisitionSource: 'challenge_flyer',
    tagline: 'Leaderboard chaser. Speed and ciphers.',
    favoriteStyle: 'Speed & Physical Challenge',
    themeColor: '#ef4444',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'plr-canton-rover',
    displayName: 'CantonRover',
    avatarUrl: '🧭',
    role: 'player',
    totalXp: 600,
    level: 3,
    selectedStartingPath: 'family',
    acquisitionSource: 'family_flyer',
    tagline: 'Exploring Canton landmarks with the crew.',
    favoriteStyle: 'Arts & History',
    themeColor: '#f59e0b',
    createdAt: '2026-08-01T00:00:00Z',
  },
  {
    id: 'plr-downtown-decoder',
    displayName: 'DowntownDecoder',
    avatarUrl: '🔍',
    role: 'player',
    totalXp: 450,
    level: 2,
    selectedStartingPath: 'secret',
    acquisitionSource: 'secret_flyer',
    tagline: 'Ciphers, history, and forgotten lore.',
    favoriteStyle: 'Cryptic Mystery',
    themeColor: '#8b5cf6',
    createdAt: '2026-08-01T00:00:00Z',
  },
];

// Canonical Achievements Catalog
export const SEED_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach-pathfinder-family',
    slug: 'pathfinder-family',
    name: 'Pathfinder: Family Adventure',
    description: 'Completed your first mission starting in the Downtown Arts district.',
    badgeSymbol: '🧭',
    category: 'path',
    rarity: 'common',
    district: 'family',
  },
  {
    id: 'ach-pathfinder-challenge',
    slug: 'pathfinder-challenge',
    name: 'Pathfinder: Kinetic Challenge',
    description: 'Completed your first mission starting in the Challenge district.',
    badgeSymbol: '⚡',
    category: 'path',
    rarity: 'common',
    district: 'challenge',
  },
  {
    id: 'ach-pathfinder-secret',
    slug: 'pathfinder-secret',
    name: 'Pathfinder: Secret Mystery',
    description: 'Completed your first mission starting in the Mystery & Memorial district.',
    badgeSymbol: '🗝️',
    category: 'path',
    rarity: 'common',
    district: 'secret',
  },
  {
    id: 'ach-district-sweep-family',
    slug: 'district-sweep-family',
    name: 'District Sweep: Arts & Downtown',
    description: 'Completed all active missions in the Downtown Arts district.',
    badgeSymbol: '🎨',
    category: 'district',
    rarity: 'rare',
    district: 'family',
  },
  {
    id: 'ach-district-sweep-challenge',
    slug: 'district-sweep-challenge',
    name: 'District Sweep: Athletic & Skill',
    description: 'Completed all active missions in the Challenge district.',
    badgeSymbol: '🏆',
    category: 'district',
    rarity: 'rare',
    district: 'challenge',
  },
  {
    id: 'ach-district-sweep-secret',
    slug: 'district-sweep-secret',
    name: 'District Sweep: Mystery & Memorial',
    description: 'Completed all active missions in the Secret district.',
    badgeSymbol: '📜',
    category: 'district',
    rarity: 'rare',
    district: 'secret',
  },
  {
    id: 'ach-triple-threat',
    slug: 'triple-threat',
    name: 'Triple Threat',
    description: 'Completed qualifying missions across all three Canton districts (Family, Challenge, and Secret).',
    badgeSymbol: '🔱',
    category: 'exploration',
    rarity: 'epic',
  },
  {
    id: 'ach-nomad',
    slug: 'nomad',
    name: 'City Nomad',
    description: 'Completed qualifying missions across all three districts within the same event day.',
    badgeSymbol: '🌐',
    category: 'exploration',
    rarity: 'epic',
  },
  {
    id: 'ach-day-one-king',
    slug: 'day-one-king',
    name: 'Day 1 City Conqueror',
    description: 'Finished Day 1 ranked #1 in XP on the official individual leaderboard (+5 Prize Entries).',
    badgeSymbol: '👑',
    category: 'competitive',
    rarity: 'legendary',
  },
  {
    id: 'ach-keeper-of-the-archive',
    slug: 'keeper-of-the-archive',
    name: 'Keeper of the Archive',
    description: "Completed the full West Lawn Archive chain — Frankenstein's Quiet Signal through The Watchers' Silent Court.",
    badgeSymbol: '📖',
    category: 'path',
    rarity: 'legendary',
    district: 'secret',
  },
];

// Phase 3 Collectibles Catalog
export const SEED_COLLECTIBLES: Collectible[] = [
  {
    id: 'col-founder-token',
    name: 'Founder Token',
    slug: 'founder-token',
    description: 'Awarded to agents who crack the Founder Cipher at Centennial Plaza.',
    badgeSymbol: '🏅',
    rarity: 'common',
  },
  {
    id: 'col-founder-mark',
    name: 'The Mark',
    slug: 'founder-mark',
    description: "Lock I of The Founder's Three Locks. Earned by completing the Family / Record path.",
    badgeSymbol: '🔶',
    rarity: 'rare',
  },
  {
    id: 'col-founder-code',
    name: 'The Code',
    slug: 'founder-code',
    description: "Lock II of The Founder's Three Locks. Earned by completing the Challenge / Trial path.",
    badgeSymbol: '🔴',
    rarity: 'rare',
  },
  {
    id: 'col-founder-word',
    name: 'The Word',
    slug: 'founder-word',
    description: "Lock III of The Founder's Three Locks. Earned by completing the Secret / Archive path at West Lawn Cemetery.",
    badgeSymbol: '🟣',
    rarity: 'legendary',
  },
  {
    id: 'col-palace-seal',
    name: 'Palace Theatre Golden Seal',
    slug: 'palace-seal',
    description: 'Historic seal granted for completing the Palace Theatre marquee lore.',
    badgeSymbol: '👑',
    rarity: 'legendary',
  },
];

// Phase 3 Secret Codes
export const SEED_SECRET_CODES: SecretCode[] = [
  {
    id: 'code-founder-2026',
    eventId: SEED_EVENT.id,
    code: '',
    description: 'Game Master Opening Broadcast Code',
    bonusPoints: 150,
    maxRedemptions: 50,
    currentRedemptions: 4,
    isActive: true,
    grantCollectibleId: 'col-founder-token',
    createdAt: '2026-08-07T18:00:00Z',
  },
  {
    id: 'code-courier-77',
    eventId: SEED_EVENT.id,
    code: '',
    description: 'Handed out by roaming NPC "The Courier" near Arts District',
    bonusPoints: 200,
    maxRedemptions: 15,
    currentRedemptions: 2,
    isActive: true,
    grantCollectibleId: 'col-palace-seal',
    createdAt: '2026-08-07T19:30:00Z',
  },
];

// Phase 3 Announcements
export const SEED_ANNOUNCEMENTS: LiveAnnouncement[] = [
  {
    id: 'ann-1',
    eventId: SEED_EVENT.id,
    title: '🎉 CANTON QUEST WEEKEND #1 IS LIVE!',
    message: 'Welcome Agents! Stand by for pop-up flash drops and secret code broadcasts.',
    urgency: 'urgent',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 'ann-2',
    eventId: SEED_EVENT.id,
    title: '🔥 DOUBLE XP ACTIVE ON PUZZLE QUESTS',
    message: 'All puzzle category quest completions earn 2x XP for the next 45 minutes!',
    urgency: 'flash',
    expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    createdAt: new Date(Date.now() - 900000).toISOString(),
  },
  {
    id: 'ann-3',
    eventId: SEED_EVENT.id,
    title: '🕵️ ROAMING NPC SPOTTED',
    message: '"The Courier" was last seen near the 4th Street Arts Corridor Mural with secret passphrase codes.',
    urgency: 'info',
    createdAt: new Date(Date.now() - 300000).toISOString(),
  },
];

// Phase 3 NPC Characters
export const SEED_NPCS: NPCCharacter[] = [
  {
    id: 'npc-courier',
    eventId: SEED_EVENT.id,
    aliasName: 'The Courier',
    description: 'A mysterious agent roaming downtown Canton handing out secret passphrase cards.',
    avatarSymbol: '🕵️',
    isActive: true,
    currentZone: '4th Street Arts Corridor',
    clueHint: 'Look near the giant street mural or Aura Craft Coffee patio.',
    secretCode: 'Distributed in person by The Courier',
    lastSpottedAt: new Date(Date.now() - 600000).toISOString(),
  },
];

// Phase 3 Business Partners
export const SEED_PARTNERS: BusinessPartnerInfo[] = [
  {
    id: 'bp-aura-coffee',
    cityId: SEED_CITY.id,
    name: 'Aura Craft Coffee',
    address: '414 4th St NW, Canton, OH 44702',
    contactNotes: 'Partner coffee shop providing QR card placement and perk discounts.',
    publicInstructions: 'Show completed quest screen at counter for 10% off espresso drinks!',
    isActive: true,
  },
  {
    id: 'bp-arcade-vault',
    cityId: SEED_CITY.id,
    name: 'Downtown Canton Arcade Vault',
    address: '218 Market Ave N, Canton, OH 44702',
    contactNotes: 'Arcade venue partner.',
    publicInstructions: 'Show completed quest screen for 5 free game tokens!',
    isActive: true,
  },
];

// Phase 3 Crowd Objectives
export const SEED_CROWD_OBJECTIVES: CrowdObjective[] = [
  {
    id: 'crowd-20-quests',
    eventId: SEED_EVENT.id,
    title: 'Canton Collective: 20 Citywide Quest Solves',
    description: 'When players collectively complete 20 quests, a secret bonus drop unlocks!',
    targetCount: 20,
    currentCount: 14,
    objectiveType: 'total_completions',
    isAchieved: false,
  },
];

// Phase 3 Bonus Windows
export const SEED_BONUS_WINDOWS: BonusWindow[] = [
  {
    id: 'bw-puzzle-2x',
    eventId: SEED_EVENT.id,
    title: 'Double XP Puzzle Sprint',
    multiplier: 2.0,
    flatBonus: 0,
    targetCategory: 'puzzle',
    startsAt: new Date(Date.now() - 900000).toISOString(),
    expiresAt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
    isActive: false,
  },
];

// Canton Quests Volume 1 — Canonical Prize Pool ($500 total)
// Source of truth for prize records; amounts defined in lib/prize-config.ts
export const SEED_PRIZES: Prize[] = [
  {
    id: 'prz-leaderboard-champion',
    eventId: SEED_EVENT.id,
    title: 'Leaderboard Champion — $200',
    sponsorName: 'Canton Quests',
    quantity: 1,
    eligibilityRule: 'Highest verified XP score on the citywide leaderboard at event close.',
  },
  {
    id: 'prz-leaderboard-runner-up',
    eventId: SEED_EVENT.id,
    title: 'Leaderboard Runner-Up — $100',
    sponsorName: 'Canton Quests',
    quantity: 1,
    eligibilityRule: 'Second-highest verified XP score on the citywide leaderboard at event close.',
  },
  {
    id: 'prz-drawing-100',
    eventId: SEED_EVENT.id,
    title: '$100 Cash Drawing',
    sponsorName: 'Canton Quests',
    quantity: 1,
    eligibilityRule: 'Random drawing from verified participant entry pool. Drawn first. One entry = one chance.',
  },
  {
    id: 'prz-drawing-50a',
    eventId: SEED_EVENT.id,
    title: '$50 Cash Drawing',
    sponsorName: 'Canton Quests',
    quantity: 1,
    eligibilityRule: 'Random drawing from remaining pool after $100 winner removed. Drawn second.',
  },
  {
    id: 'prz-drawing-50b',
    eventId: SEED_EVENT.id,
    title: '$50 Cash Drawing',
    sponsorName: 'Canton Quests',
    quantity: 1,
    eligibilityRule: 'Random drawing from remaining pool after $100 and first $50 winners removed. Drawn third.',
  },
];

// Exact SEED_QUESTS array order preserved with Phase 3 fields added
export const SEED_QUESTS: Quest[] = [
  {
    id: 'qst-centennial-discovery',
    eventId: SEED_EVENT.id,
    locationId: 'loc-centennial-plaza',
    location: SEED_LOCATIONS[0],
    title: 'Open the Founder Signal',
    slug: 'centennial-beacon',
    description: "Every agent's first move. The city grid goes live the moment you arrive.",
    instructions: 'Report to Centennial Plaza and activate your field log. Tap CHECK IN when you are physically at the plaza. Your GPS will confirm the lock.',
    pointValue: 75,
    xpReward: 75,
    drawingEntryReward: 1,
    difficulty: 'easy',
    category: 'exploration',
    startingPath: 'family',
    verificationType: 'checkin',
    proofRequirement: 'GPS check-in from the public plaza area.',
    isFlash: false,
    status: 'active',
    sortOrder: 1,
    createdAt: '2026-08-01T00:00:00Z',
    radiusMeters: 60,
    requireLocationVerification: true,
    safetyNotes: 'Use public sidewalks and plaza areas. Do not enter closed event setups, stages, or restricted maintenance areas.',
    gmNotes: 'Field verify plaza access on launch weekend and place opening signage where it does not obstruct pedestrian flow.',
    // First of the Founder's Three Locks quests — see qst-onesto-brass-motto
    // (THE CODE) and qst-watchers-silent-court (THE WORD) for the other two.
    rewardConfig: {
      collectibleUnlockIds: ['col-founder-token', 'col-founder-mark'],
      threeLocksFragment: { lock: 'mark', collectibleId: 'col-founder-mark' },
      cipherFragmentKeys: ['arts-founder-signal'],
    },
  },
  {
    id: 'qst-mckinley-cipher',
    eventId: SEED_EVENT.id,
    locationId: 'loc-mckinley-monument',
    location: SEED_LOCATIONS[1],
    title: 'The Stone Stair Cipher',
    slug: 'mckinley-monument-year',
    description: 'The McKinley Memorial has been carved with the answer since it was built. You just have to read it.',
    instructions: 'Visit the McKinley National Memorial during daylight public hours. Find the dedication marker near the monument approach. The year is on stone, facing the path — it marks when something was dedicated, not a birth or death year. Stand at the base of the stairs and look at the markers around you. Enter the four-digit year.',
    pointValue: 150,
    xpReward: 150,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'puzzle',
    startingPath: 'secret',
    verificationType: 'passphrase',
    proofRequirement: 'Enter the four-digit year found on the physical marker identified by the quest.',
    isFlash: false,
    status: 'active',
    sortOrder: 2,
    createdAt: '2026-08-01T00:00:00Z',
    radiusMeters: 80,
    requireLocationVerification: true,
    safetyNotes: 'Daylight recommended. Stairs may be slick; players do not need to climb quickly or leave public paths.',
    gmNotes: 'Existing server hash expects the verified four-digit answer. Reconfirm plaque wording and target marker before printing clue cards.',
    rewardConfig: {
      cipherFragmentKeys: ['secret-stone-stair'],
    },
  },
  {
    id: 'qst-4th-st-mural-photo',
    eventId: SEED_EVENT.id,
    locationId: 'loc-4th-st-mural',
    location: SEED_LOCATIONS[2],
    title: 'The Painted Witness',
    slug: '4th-st-mural-pose',
    description: 'The Arts District keeps its own records. Your job is to prove you read them.',
    instructions: 'Find the large street mural on 4th Street NW. Stand on the public sidewalk — the mural faces the street and is impossible to miss. Keep storefronts clear and watch traffic when crossing. Take a photo of your team or callsign card with the mural clearly visible behind you.',
    pointValue: 175,
    xpReward: 175,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'creative',
    startingPath: 'family',
    verificationType: 'photo',
    proofRequirement: 'Upload a photo or proof link showing the mural and your team/callsign card.',
    isFlash: false,
    status: 'active',
    sortOrder: 3,
    createdAt: '2026-08-01T00:00:00Z',
    safetyNotes: 'Stay on sidewalks, keep storefront entrances clear, and watch traffic when crossing downtown streets.',
    gmNotes: 'Manual review should verify the mural is visible and the proof appears original to the event window.',
    rewardConfig: {
      cipherFragmentKeys: ['arts-painted-witness'],
    },
  },
  {
    id: 'qst-aura-coffee-qr',
    eventId: SEED_EVENT.id,
    locationId: 'loc-aura-craft-coffee',
    location: SEED_LOCATIONS[3],
    title: 'The Counter-Sign at Aura',
    slug: 'aura-coffee-scan',
    description: 'A partner business is holding a signal for you. No purchase required.',
    instructions: 'Visit Aura Craft Coffee at 414 4th St NW during business hours (7 AM – 6 PM). Look near the espresso counter for the official Canton Quests QR card displaying the Canton Quests emblem. Scan or copy the passcode printed on it and enter it below.',
    pointValue: 125,
    xpReward: 125,
    drawingEntryReward: 1,
    difficulty: 'easy',
    category: 'business_partner',
    startingPath: 'family',
    verificationType: 'qr',
    proofRequirement: 'Enter the QR passcode displayed on the official Canton Quests card.',
    isFlash: false,
    status: 'active',
    sortOrder: 4,
    createdAt: '2026-08-01T00:00:00Z',
    radiusMeters: 40,
    requireQrAndLocation: true,
    safetyNotes: 'Visit only during partner-approved hours, respect staff and customers, and do not block the counter.',
    gmNotes: 'Requires partner permission, final QR placement, and free no-purchase access path before launch.',
  },
  {
    id: 'qst-arcade-high-score-video',
    eventId: SEED_EVENT.id,
    locationId: 'loc-arcade-bar',
    location: SEED_LOCATIONS[4],
    title: 'The Neon Victory Loop',
    slug: 'arcade-champion-video',
    description: 'A high-energy partner media quest. Partner confirmation required before activation.',
    instructions: 'When the partner site is confirmed and announced, visit the arcade venue during approved hours. Record a short celebration clip from the approved game area and upload it as proof.',
    pointValue: 250,
    xpReward: 250,
    drawingEntryReward: 2,
    difficulty: 'hard',
    category: 'photo_video',
    startingPath: 'challenge',
    verificationType: 'video',
    proofRequirement: 'Upload a short video or proof link from the approved partner area.',
    isFlash: false,
    status: 'inactive',
    sortOrder: 5,
    createdAt: '2026-08-01T00:00:00Z',
    safetyNotes: 'Partner permission required. Family-friendly hours only; no alcohol purchase or adult-only access may be required.',
    gmNotes: 'Partner-ready slot. Confirm venue name, hours, minor policy, and exact proof backdrop before activation.',
    rewardConfig: {
      cipherFragmentKeys: ['challenge-neon-loop'],
    },
  },
  {
    id: 'qst-palace-theatre-year',
    eventId: SEED_EVENT.id,
    locationId: 'loc-music-hall',
    location: SEED_LOCATIONS[5],
    title: 'The Palace Lantern Date',
    slug: 'palace-theatre-lore',
    description: 'The Palace Theatre has been showing its founding date to Canton for over a century. Most people walk past it without reading.',
    instructions: 'Stand on the public sidewalk in front of Canton Palace Theatre on Market Ave N. Find the four-digit year displayed on the exterior of the building itself — not a sign or poster, but part of the structure. Enter it below. No ticket purchase required.',
    pointValue: 125,
    xpReward: 125,
    drawingEntryReward: 1,
    difficulty: 'easy',
    category: 'trivia',
    startingPath: 'family',
    verificationType: 'passphrase',
    proofRequirement: 'Enter the four-digit year from the approved exterior marker.',
    isFlash: false,
    status: 'active',
    sortOrder: 6,
    createdAt: '2026-08-01T00:00:00Z',
    safetyNotes: 'Stay on public sidewalks and keep theatre entrances clear. No ticket purchase is required.',
    gmNotes: 'Existing server hash expects the verified four-digit answer. Reconfirm marker text before launch.',
    rewardConfig: {
      cipherFragmentKeys: ['arts-palace-lantern'],
    },
  },
  {
    id: 'qst-market-square-flash',
    eventId: SEED_EVENT.id,
    locationId: 'loc-centennial-plaza',
    location: SEED_LOCATIONS[0],
    title: 'Flash Drop — Market Square Signal',
    slug: 'market-square-flash',
    description: 'The Game Master just opened a 45-minute window. Drop everything and move.',
    instructions: 'Get to Centennial Plaza and check in before the window closes. This signal is live right now. Tap CHECK IN from the plaza — the window expires at the time displayed. GPS must confirm your position. No clue needed. Just be there.',
    pointValue: 225,
    xpReward: 225,
    drawingEntryReward: 2,
    difficulty: 'medium',
    category: 'flash',
    startingPath: 'cross_city',
    verificationType: 'checkin',
    proofRequirement: 'Timed GPS check-in during an active Game Master flash window.',
    isFlash: true,
    startsAt: '2026-09-12T19:00:00Z',
    expiresAt: '2026-09-12T19:45:00Z',
    status: 'active',
    sortOrder: 7,
    createdAt: '2026-08-01T00:00:00Z',
    radiusMeters: 60,
    requireLocationVerification: true,
    safetyNotes: 'No running into traffic or cutting through restricted areas. The drop is optional and should be paused if the plaza is crowded or closed.',
    gmNotes: 'Use live controls to adjust the active window based on weather and field conditions.',
    // Demo of the reusable reward template (lib/quest-rewards.ts): a flash
    // quest with a race bonus for early arrivals plus optional NFC/photo
    // bonus paths on top of the required GPS check-in.
    rewardConfig: {
      baseXp: 225,
      nfcBonusXp: 15,
      photoVideoBonusXp: 20,
      raceBonus: [
        { place: 1, bonusPoints: 100 },
        { place: 2, bonusPoints: 50 },
        { place: 3, bonusPoints: 25 },
      ],
      countsTowardFinale: true,
    },
  },
  {
    id: 'qst-onesto-brass-motto',
    eventId: SEED_EVENT.id,
    locationId: 'loc-onesto-building',
    location: SEED_LOCATIONS[7],
    title: 'The Brass Door Key',
    slug: 'onesto-brass-motto',
    description: 'A downtown doorway has been holding a one-word message in its architectural detail since the building opened.',
    instructions: 'Go to the Onesto building at 225 2nd St NW. From the public sidewalk, inspect the brass architectural detail near the main entrance. Find the single word inscribed in the metalwork — it is not a name, but a word that describes what a building or institution aspires to be. Enter it below. Capitalization does not matter.',
    pointValue: 150,
    xpReward: 150,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'observation',
    startingPath: 'challenge',
    verificationType: 'passphrase',
    proofRequirement: 'Enter the exact word from the approved public-facing architectural detail.',
    isFlash: false,
    status: 'active',
    sortOrder: 8,
    createdAt: '2026-08-01T00:00:00Z',
    safetyNotes: 'Public sidewalk view only. Do not enter private residential or lobby areas unless invited by posted public access.',
    gmNotes: 'Reconfirm visible clue target and public viewing boundary before launch.',
    // Second of the Founder's Three Locks quests — see qst-centennial-discovery
    // (THE MARK) and qst-watchers-silent-court (THE WORD) for the other two.
    rewardConfig: {
      collectibleUnlockIds: ['col-founder-code'],
      threeLocksFragment: { lock: 'code', collectibleId: 'col-founder-code' },
      cipherFragmentKeys: ['challenge-brass-key'],
    },
  },
  {
    id: 'qst-hof-legend-qr',
    eventId: SEED_EVENT.id,
    locationId: 'loc-hof-trail',
    location: SEED_LOCATIONS[6],
    title: 'The Helmet Trail Emblem',
    slug: 'hof-trail-emblem',
    description: 'The Hall of Fame trail has a hidden emblem. High-value. High distance. All worth it.',
    instructions: 'Follow the Hall of Fame trail to the approved public marker location near 2121 George Halas Dr NW. Find the official Canton Quests QR emblem mounted at the approved fixture — it is weatherproofed and visible at eye level. Look for the Canton Quests seal. You have to travel to earn it. Enter the QR passcode below.',
    pointValue: 325,
    xpReward: 325,
    drawingEntryReward: 2,
    difficulty: 'hard',
    category: 'trivia',
    startingPath: 'challenge',
    verificationType: 'qr',
    proofRequirement: 'Enter the QR passcode from the official field emblem.',
    isFlash: false,
    status: 'active',
    sortOrder: 9,
    createdAt: '2026-08-01T00:00:00Z',
    requireQrAndLocation: true,
    radiusMeters: 75,
    safetyNotes: 'Use marked pedestrian routes and daylight hours. Do not cross traffic outside crosswalks.',
    gmNotes: 'Human verification required for exact placement, permission, QR weatherproofing, and pedestrian safety.',
    rewardConfig: {
      cipherFragmentKeys: ['challenge-helmet-emblem'],
    },
  },
  // Secret Path — West Lawn Archive: Chapter 1
  {
    id: 'qst-frankenstein-west-lawn',
    eventId: SEED_EVENT.id,
    locationId: 'loc-west-lawn-frankenstein',
    location: SEED_LOCATIONS[9],
    title: "Frankenstein's Quiet Signal",
    slug: 'frankenstein-west-lawn',
    description: "A Canton family name became one of literature's most famous monsters. The original stone is still here.",
    instructions:
      'Visit West Lawn Cemetery during public daylight hours. Locate the Frankenstein family monument — a large stone bearing the family surname. From a public path, take a respectful photo with your callsign card and the monument clearly visible behind you. Enter the surname exactly as it is carved on the stone.',
    pointValue: 200,
    xpReward: 200,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'secret',
    startingPath: 'secret',
    verificationType: 'photo',
    proofRequirement:
      'Upload a respectful daytime photo from a public cemetery path with the Frankenstein monument visible and your callsign card in frame.',
    isFlash: false,
    status: 'active',
    sortOrder: 10,
    createdAt: '2026-08-01T00:00:00Z',
    isSecret: true,
    safetyNotes:
      'Daylight only. Confirm cemetery hours before visiting. Stay on paved or gravel paths. No touching, climbing, rubbing, decorating, moving items, loud behavior, nighttime access, or interference with graves, markers, visitors, or staff.',
    gmNotes:
      'MUST complete site walk before launch: (1) confirm Frankenstein monument exact location and surname spelling, (2) confirm cemetery public visitor hours, (3) confirm photography rules. Chapter 1 of the West Lawn Archive chain.',
    rewardConfig: {
      cipherFragmentKeys: ['secret-quiet-signal'],
    },
  },
  // Secret Path — West Lawn Archive: Chapter 2
  {
    id: 'qst-watchers-first',
    eventId: SEED_EVENT.id,
    locationId: 'loc-west-lawn-frankenstein',
    location: SEED_LOCATIONS[9],
    title: 'The First Watchers',
    slug: 'watchers-first',
    description: 'Three silent observers. Three fragments of the Archive. The first chapter of the Watcher chain.',
    instructions:
      'Return to West Lawn Cemetery during public daylight hours. You will locate three specific monuments and record one detail from each. Stay on paved or gravel paths at all times. Do not touch, lean on, or sit on any monument. Leave everything exactly as you found it.',
    pointValue: 300,
    xpReward: 300,
    drawingEntryReward: 2,
    difficulty: 'hard',
    category: 'secret',
    startingPath: 'secret',
    verificationType: 'multi_step',
    proofRequirement: 'Verify all three Watcher observations in sequence.',
    isFlash: false,
    status: 'active',
    sortOrder: 10,
    createdAt: '2026-08-01T00:00:00Z',
    isSecret: true,
    prerequisiteQuestId: 'qst-frankenstein-west-lawn',
    unlockConditionType: 'prerequisite',
    steps: [
      {
        id: 'step-watcher-wise-surname',
        questId: 'qst-watchers-first',
        stepOrder: 1,
        title: 'Watcher One — The Wise Stone',
        instructions:
          'Find the Wise family monument in the cemetery. The surname is carved prominently on the stone. Enter the full surname exactly as carved.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-watcher-reese-object',
        questId: 'qst-watchers-first',
        stepOrder: 2,
        title: 'Watcher Two — The Reese Mark',
        instructions:
          'Find the Reese family monument. Identify the single object or symbol depicted on or carved into the stone — not a name, but an image. Enter that single word.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-watcher-soldier-year',
        questId: 'qst-watchers-first',
        stepOrder: 3,
        title: 'Watcher Three — The Soldier\'s Year',
        instructions:
          'Find the standing Civil War soldier monument. What four-digit year is carved into the monument base or plinth? Enter that year.',
        verificationType: 'passphrase',
      },
    ],
    safetyNotes:
      'Daylight only. Confirm cemetery hours before visiting. Stay on paved or gravel paths. No touching, climbing, rubbing, decorating, moving items, or loud behavior near graves.',
    gmNotes:
      'MUST complete site walk: (1) confirm Wise monument location and exact surname, (2) confirm Reese monument and depicted object, (3) confirm Civil War soldier monument and year on base. Set server passphrase hashes for all three steps.',
  },
  // Secret Path — West Lawn Archive: Chapter 3 (awards THE WORD / col-founder-word)
  {
    id: 'qst-watchers-silent-court',
    eventId: SEED_EVENT.id,
    locationId: 'loc-west-lawn-frankenstein',
    location: SEED_LOCATIONS[9],
    title: "The Watchers' Silent Court",
    slug: 'watchers-silent-court',
    description: 'Three more keepers. Three more fragments. The final Watcher chain that completes the Archive and claims THE WORD.',
    instructions:
      'Return to West Lawn Cemetery during public daylight hours. You will locate three more monuments in the deeper sections. Stay on all marked paths. Do not touch or disturb any grave markers.',
    pointValue: 350,
    xpReward: 350,
    drawingEntryReward: 2,
    difficulty: 'hard',
    category: 'secret',
    startingPath: 'secret',
    verificationType: 'multi_step',
    proofRequirement: 'Verify all three Silent Court observations in sequence to complete the Archive and claim THE WORD.',
    isFlash: false,
    status: 'active',
    sortOrder: 11,
    createdAt: '2026-08-01T00:00:00Z',
    isSecret: true,
    prerequisiteQuestId: 'qst-watchers-first',
    unlockConditionType: 'prerequisite',
    steps: [
      {
        id: 'step-sc-miller-inscription',
        questId: 'qst-watchers-silent-court',
        stepOrder: 1,
        title: 'Court One — Miller Inscription',
        instructions:
          'Find the Miller family monument. There is a word or phrase inscribed below the surname — not a date, not a name. Enter the first word of that inscription.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-sc-black-symbol',
        questId: 'qst-watchers-silent-court',
        stepOrder: 2,
        title: 'Court Two — The Black Symbol',
        instructions:
          'Find the Black family monument. Identify the single object or symbol carved into the stone face. Enter that single word.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-sc-meyer-letter',
        questId: 'qst-watchers-silent-court',
        stepOrder: 3,
        title: 'Court Three — The Meyer Letter',
        instructions:
          'Find the Meyer family monument. There is a single letter or initial carved prominently that is not part of the family name. Enter that letter.',
        verificationType: 'passphrase',
      },
    ],
    safetyNotes:
      'Daylight only. Confirm cemetery hours. Stay on paved or gravel paths. No touching, climbing, rubbing, or disturbing grave markers.',
    gmNotes:
      'MUST complete site walk: (1) confirm Miller monument and inscription, (2) confirm Black monument and symbol, (3) confirm Meyer monument and letter/initial. Set server passphrase hashes. rewardConfig below defines the col-founder-word (THE WORD) grant, issued automatically on verified completion.',
    // Third of the Founder's Three Locks quests — see qst-centennial-discovery
    // (THE MARK) and qst-onesto-brass-motto (THE CODE) for the other two.
    rewardConfig: {
      collectibleUnlockIds: ['col-founder-word'],
      threeLocksFragment: { lock: 'word', collectibleId: 'col-founder-word' },
      cipherFragmentKeys: ['secret-silent-court'],
      countsTowardFinale: true,
    },
  },
  // Secret Path — West Lawn Archive: Chapter 4 Bonus
  {
    id: 'qst-watchers-lost',
    eventId: SEED_EVENT.id,
    locationId: 'loc-west-lawn-frankenstein',
    location: SEED_LOCATIONS[9],
    title: "The Watchers' Lost Record",
    slug: 'watchers-lost',
    description: 'Four more voices from the archive. The bonus chain for those who refuse to stop listening.',
    instructions:
      'Return to West Lawn Cemetery during public daylight hours. This chain requires the deepest search of the cemetery grounds. You will locate four additional monuments. Stay on all marked paths at all times.',
    pointValue: 400,
    xpReward: 400,
    drawingEntryReward: 3,
    difficulty: 'hard',
    category: 'secret',
    startingPath: 'secret',
    verificationType: 'multi_step',
    proofRequirement: 'Verify all four Lost Record observations in sequence.',
    isFlash: false,
    status: 'active',
    sortOrder: 12,
    createdAt: '2026-08-01T00:00:00Z',
    isSecret: true,
    prerequisiteQuestId: 'qst-watchers-silent-court',
    unlockConditionType: 'prerequisite',
    steps: [
      {
        id: 'step-lr-dickes',
        questId: 'qst-watchers-lost',
        stepOrder: 1,
        title: 'Record One — Dickes',
        instructions:
          'Find the Dickes family monument. What material or finish is the monument primarily made of? Enter the single word describing the material.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-lr-heldenbrand',
        questId: 'qst-watchers-lost',
        stepOrder: 2,
        title: 'Record Two — Heldenbrand',
        instructions:
          'Find the Heldenbrand monument. There is a four-digit year on the stone. Enter that year.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-lr-pallus',
        questId: 'qst-watchers-lost',
        stepOrder: 3,
        title: "Record Three — The Keeper's Mark",
        instructions:
          'Find the monument with a distinctive carved symbol or emblem that marks it apart from typical grave markers. Enter the one-word description of that symbol. (GM configurable — confirm on site walk.)',
        verificationType: 'passphrase',
      },
      {
        id: 'step-lr-baldwin',
        questId: 'qst-watchers-lost',
        stepOrder: 4,
        title: 'Record Four — Baldwin',
        instructions:
          'Find the Baldwin family monument. What single word appears below the surname on the stone? Enter it exactly.',
        verificationType: 'passphrase',
      },
    ],
    safetyNotes:
      'Daylight only. Confirm cemetery hours. Stay on paved or gravel paths. Do not touch or disturb any grave markers.',
    gmNotes:
      'MUST complete full site walk: identify all four monuments (Dickes, Heldenbrand, Pallus/configurable, Baldwin), confirm all answers, set server passphrase hashes. Bonus chain — activate only after Ch1–3 are field-verified.',
  },
  // ALL-PLAYER — The Founder's Three Locks (shared late-game convergence)
  {
    id: 'qst-secret-cipher-77',
    eventId: SEED_EVENT.id,
    locationId: 'loc-4th-st-mural',
    location: SEED_LOCATIONS[2],
    title: "The Founder's Three Locks",
    slug: 'secret-cipher-77',
    description: "Three paths. Three keys. One final lock. Agents from every district converge here.",
    instructions:
      'Each branch of the city has hidden a key. THE MARK was left by the Family / Record path. THE CODE was left by the Challenge / Trial path. THE WORD was sealed in the West Lawn Archive. If you have done the work across all three districts, you hold all three keys. Enter them in sequence — one per lock.',
    pointValue: 650,
    xpReward: 650,
    drawingEntryReward: 4,
    difficulty: 'epic',
    category: 'secret',
    startingPath: 'cross_city',
    verificationType: 'multi_step',
    proofRequirement: 'Enter all three field keys in sequence — THE MARK, THE CODE, and THE WORD.',
    isFlash: false,
    status: 'active',
    sortOrder: 20,
    createdAt: '2026-08-01T00:00:00Z',
    unlockConditionType: 'none',
    steps: [
      {
        id: 'step-secret-founder-fragment',
        questId: 'qst-secret-cipher-77',
        stepOrder: 1,
        title: 'Lock I — THE MARK',
        instructions:
          'Enter the key from the Family / Record path. THE MARK was embedded in the physical clue card placed at the Founder Signal location. It proves you walked the downtown arts district.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-secret-mural-fragment',
        questId: 'qst-secret-cipher-77',
        stepOrder: 2,
        title: 'Lock II — THE CODE',
        instructions:
          'Enter the key from the Challenge / Trial path. THE CODE was revealed at the end of the Brass Door Key mission in the challenge district. It proves you cracked the trial.',
        verificationType: 'passphrase',
      },
      {
        id: 'step-secret-brass-fragment',
        questId: 'qst-secret-cipher-77',
        stepOrder: 3,
        title: 'Lock III — THE WORD',
        instructions:
          "Enter the key from the Secret / Archive path. THE WORD was sealed in West Lawn Cemetery at the end of The Watchers' Silent Court. It proves you completed the archive.",
        verificationType: 'passphrase',
      },
    ],
    safetyNotes: 'Use only public sidewalks and approved partner/public spaces while gathering the three keys.',
    gmNotes:
      "Do not publish key answers. All three key clue cards must be placed and mapped to server step hashes before enabling. This is the city-wide convergence quest — all paths lead here. Rewards 4 drawing entries.",
  },
  {
    id: 'qst-founders-secret-clue',
    eventId: SEED_EVENT.id,
    locationId: 'loc-centennial-plaza',
    location: SEED_LOCATIONS[0],
    title: "The Founder's Keystone",
    slug: 'founders-secret-clue',
    description: 'The opening signal reveals a second mark at the plaza.',
    instructions:
      'After opening the Founder Signal, inspect the approved public clue card or marker at Centennial Plaza and enter the keystone word.',
    // STATUS: Inactive at launch — cuts roster redundancy at Centennial Plaza
    pointValue: 150,
    xpReward: 150,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'puzzle',
    startingPath: 'family',
    verificationType: 'passphrase',
    proofRequirement: 'Enter the keystone word from the approved physical clue.',
    isFlash: false,
    status: 'inactive',  // Cut from Sept 11 launch — redundant Centennial Plaza quest
    sortOrder: 12,
    createdAt: '2026-08-01T00:00:00Z',
    radiusMeters: 60,
    prerequisiteQuestId: 'qst-centennial-discovery',
    unlockConditionType: 'prerequisite',
    requireLocationVerification: true,
    safetyNotes: 'Stay in public plaza areas and do not move or alter any clue card or fixture.',
    gmNotes: 'Server hash expects launch clue value. Place clue card only after final field route check.',
  },
  {
    id: 'qst-palace-flash-popup',
    eventId: SEED_EVENT.id,
    locationId: 'loc-music-hall',
    location: SEED_LOCATIONS[5],
    title: 'Flash Drop — Palace Lantern Cipher',
    slug: 'palace-marquee-flash',
    description: '30 minutes. A live cipher at the Palace. This one disappears at midnight.',
    instructions:
      'Get to Canton Palace Theatre on Market Ave N. The Game Master has activated a temporary passcode display near the Palace exterior — visible from the public sidewalk. Find it and enter the active flash passcode before the timer expires. Well-lit. Public. Fast.',
    pointValue: 275,
    xpReward: 275,
    drawingEntryReward: 2,
    difficulty: 'hard',
    category: 'flash',
    startingPath: 'cross_city',
    verificationType: 'passphrase',
    proofRequirement: 'Enter flash passcode before expiry.',
    isFlash: true,
    startsAt: '2026-09-12T23:00:00Z',
    expiresAt: '2026-09-12T23:30:00Z',
    status: 'active',
    sortOrder: 13,
    createdAt: '2026-08-01T00:00:00Z',
    safetyNotes:
      'Only activate if the sidewalk is well lit, public, and calm. No road crossings outside marked crosswalks and no building entry required.',
    gmNotes: 'Evening flash is optional. Cancel if weather, crowding, or lighting creates field risk.',
  },
  {
    id: 'qst-civic-seal-photo',
    eventId: SEED_EVENT.id,
    locationId: 'loc-centennial-plaza',
    location: SEED_LOCATIONS[0],
    title: 'The Civic Seal Snapshot',
    slug: 'civic-seal-snapshot',
    description: 'A family-friendly photo stop that turns the city center into a team badge moment.',
    instructions:
      'Find an approved public civic backdrop near the plaza and take a photo of your team/callsign card making a clear Canton Quests victory mark.',
    pointValue: 125,
    xpReward: 125,
    drawingEntryReward: 1,
    difficulty: 'easy',
    category: 'creative',
    startingPath: 'family',
    verificationType: 'photo',
    proofRequirement: 'Upload a photo or proof link from the approved public civic backdrop.',
    isFlash: false,
    status: 'inactive',  // Cut from Sept 11 launch — generic plaza photo, no distinct media
    sortOrder: 14,
    createdAt: '2026-08-01T00:00:00Z',
    safetyNotes: 'Keep sidewalks clear and do not photograph strangers closely without consent.',
    gmNotes: 'Pick final backdrop after human site walk; avoid exposing private business entrances or minors in public recap feeds.',
  },
  // Challenge Path — 9th Street Opening Trial
  {
    id: 'qst-9th-street-opening',
    eventId: SEED_EVENT.id,
    locationId: 'loc-9th-street',
    location: undefined,
    title: 'The 9th Street Signal',
    slug: '9th-street-opening',
    description: 'The Challenge path starts here. Show up. Check in. The grid opens.',
    instructions:
      'Report to the 9th Street Skate Corridor at 9th St NW and check in to activate your Challenge district field log. Tap CHECK IN when you are physically at the location. Your GPS will confirm the signal.',
    pointValue: 75,
    xpReward: 75,
    drawingEntryReward: 1,
    difficulty: 'easy',
    category: 'exploration',
    startingPath: 'challenge',
    verificationType: 'checkin',
    proofRequirement: 'GPS check-in from the 9th Street public area.',
    isFlash: false,
    status: 'active',
    sortOrder: 17,
    createdAt: '2026-08-01T00:00:00Z',
    radiusMeters: 60,
    requireLocationVerification: true,
    safetyNotes: 'Public outdoor space. Use sidewalks and crosswalks. Daylight recommended.',
    gmNotes: 'Field verify access and GPS accuracy before launch. Confirm 9th Street coordinates and public access.',
  },
  // Challenge Path — Mother Goose Land
  {
    id: 'qst-goose-land-cipher',
    eventId: SEED_EVENT.id,
    locationId: 'loc-mother-goose-land',
    location: undefined,
    title: 'The Goose Land Cipher',
    slug: 'goose-land-cipher',
    description: "Canton's most nostalgic landmark is hiding a word in the mural wall. It has always been there.",
    instructions:
      'Go to Mother Goose Land at 714 12th St NW. Find the large illustrated mural wall. The answer is embedded in the mural — not written as a label, but depicted as an image. What is the character in the lower right section of the wall holding? Enter that single word. Lowercase, no spaces.',
    pointValue: 175,
    xpReward: 175,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'observation',
    startingPath: 'challenge',
    verificationType: 'passphrase',
    proofRequirement: 'Enter the single word for the depicted object in the mural.',
    isFlash: false,
    status: 'active',
    sortOrder: 16,
    createdAt: '2026-08-01T00:00:00Z',
    radiusMeters: 60,
    safetyNotes: 'Open public park. Daylight hours only. Respect any seasonal closures or maintenance areas.',
    gmNotes: 'MUST confirm on site before launch: (1) visit the mural wall and verify exact detail + single-word answer, (2) set server passphrase hash, (3) confirm park is accessible on event weekend, (4) confirm seasonal operating status.',
  },
  // ---------------------------------------------------------------------------
  // Challenge Sector — "THE STORYBOOK SECTOR" (C1-C4)
  // Narrative theme: "Forgotten doesn't mean finished." Mother Goose Land /
  // 9th Street area — open to the public but weathered/run-down compared
  // with what it once was. Tone: preservation, memory, visibility,
  // potential, recovery. Players never repair, paint, touch, climb, or
  // alter the site.
  //
  // STATUS: DRAFT — coordinates for this specific chain and final owner
  // verification are not yet supplied. `status: 'draft'` keeps every one of
  // these hidden from players (see calculateQuestState in game-engine.ts)
  // until an owner supplies real coordinates and flips status to 'active'.
  // `location` is deliberately left undefined (locationId only) rather than
  // reusing loc-mother-goose-land's existing lat/lon — those coordinates
  // were set for a different, already-live quest (qst-goose-land-cipher)
  // and were not confirmed for this chain; do not assume they apply here.
  // ---------------------------------------------------------------------------
  {
    id: 'qst-challenge-blue-signal',
    eventId: SEED_EVENT.id,
    locationId: 'loc-mother-goose-land',
    location: undefined,
    title: 'The Blue Signal',
    slug: 'challenge-blue-signal',
    description: "Forgotten doesn't mean finished. One painted whale survived long enough for you to notice it.",
    instructions:
      'The Mother Goose Land mural wall still carries a large blue creature from the old storybook scenes. What large blue creature appears on the mural? Answer from memory or from the field — this one can be solved remotely.',
    pointValue: 150,
    xpReward: 150,
    drawingEntryReward: 1,
    difficulty: 'easy',
    category: 'observation',
    startingPath: 'challenge',
    verificationType: 'passphrase',
    acceptedAnswerVariants: [
      'sha256:22c71fc75f2ccec3be35306272851ffc48e0587cabced42e87880a9fdcb3c0be', // BLUE WHALE
      'sha256:6a688edef29d0df679ceee752d6b4741b653a45520feaabe9dbbe7b50f26a49c', // A WHALE
    ],
    proofRequirement: 'Enter the large blue creature that appears on the mural (e.g. "whale").',
    isFlash: false,
    status: 'draft',
    sortOrder: 18,
    createdAt: '2026-08-24T00:00:00Z',
    radiusMeters: 60,
    remoteCapable: true,
    rewardConfig: {
      baseXp: 150,
      fieldCheckInBonusXp: 75,
      photoVideoBonusXp: 50,
    },
    sectorIntroTransmission: {
      type: 'VIDEO',
      message:
        "Challenge operative, this sector isn't polished and it isn't pristine. It was built for wonder, and pieces of that story are still standing. Your job isn't to judge what's faded. Your job is to recover what remains.",
      mediaKey: 'commander/challenge-sector-intro.mp4',
      fallbackType: 'PHOTO_MESSAGE',
    },
    // Suggested Commander video script (production reference only, not shown
    // to players — the transmission's `message` above is the actual copy
    // used until the real video/photo asset is produced):
    // "Challenge operative. Take a look around. This place was built for
    // wonder. Time hit it hard, but it didn't erase it. The characters are
    // still here. The stories are still on these walls. Somebody just has
    // to pay attention again. Recover what remains. Make the forgotten
    // visible."
    commanderTransmission: {
      type: 'PHOTO_MESSAGE',
      message: "Good. Start with what refuses to disappear. One painted whale survived long enough for you to notice it.",
      mediaKey: 'commander/challenge-c1-blue-signal.jpg',
    },
    safetyNotes:
      'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic.',
    gmNotes:
      "DRAFT/CONTENT_LOCKED — coordinates for Mother Goose Land / 9th Street not yet supplied for this chain; do not activate until coordinates and final owner verification are confirmed. Completion headline: SIGNAL IDENTIFIED. Completion message: \"The story is faded. The signal isn't.\" Unlocks C2 (qst-challenge-storybook-witness) on completion.",
  },
  {
    id: 'qst-challenge-storybook-witness',
    eventId: SEED_EVENT.id,
    locationId: 'loc-mother-goose-land',
    location: undefined,
    title: 'Storybook Witness',
    slug: 'challenge-storybook-witness',
    description: 'Three fragments recovered from a wall most people pass without seeing.',
    instructions:
      'Return to the Mother Goose Land mural wall. Three separate storybook details are waiting to be named, in sequence. Each can be answered remotely or from the field.',
    pointValue: 200,
    xpReward: 200,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'observation',
    startingPath: 'challenge',
    verificationType: 'multi_step',
    proofRequirement: 'Answer all three observation prompts, in sequence.',
    isFlash: false,
    status: 'draft',
    sortOrder: 19,
    createdAt: '2026-08-24T00:00:00Z',
    radiusMeters: 60,
    remoteCapable: true,
    prerequisiteQuestId: 'qst-challenge-blue-signal',
    unlockConditionType: 'prerequisite',
    steps: [
      {
        id: 'step-challenge-storybook-cat',
        questId: 'qst-challenge-storybook-witness',
        stepOrder: 1,
        title: 'The Investigator',
        instructions: 'Which character is dressed like an investigator?',
        verificationType: 'passphrase',
        acceptedAnswerVariants: [
          'sha256:af77342b0797f13a314ea730bb27471c14e327cd77f7280453850f2eae695763', // DETECTIVE CAT
          'sha256:4dbfbad0e12ac681b3f858e39abb96f0df3165cd0c4ee8479179d0fa34b36786', // CAT DETECTIVE
        ],
      },
      {
        id: 'step-challenge-storybook-gingerbread',
        questId: 'qst-challenge-storybook-witness',
        stepOrder: 2,
        title: 'The Sweet Character',
        instructions: 'What sweet storybook character appears near the pumpkins?',
        verificationType: 'passphrase',
        acceptedAnswerVariants: [
          'sha256:f2923498f1758f7be933884f67205c806a56bc03ae8c61dc4328f699ad703cea', // GINGERBREAD
          'sha256:2f06ab7e9e52d0829b54c63946e271948658e192c6a4d4ecf5ad8aea5976c86e', // GINGERBREAD PERSON
        ],
      },
      {
        id: 'step-challenge-storybook-wolf',
        questId: 'qst-challenge-storybook-witness',
        stepOrder: 3,
        title: 'The Hunter',
        instructions: 'What animal appears to be chasing one of the pigs?',
        verificationType: 'passphrase',
        acceptedAnswerVariants: [
          'sha256:5553573c3a34e91b53c7106d5bad7cd1f39ca129743ab4fdf46e1367213a70c8', // A WOLF
        ],
      },
    ],
    rewardConfig: {
      baseXp: 200,
      fieldCheckInBonusXp: 100,
    },
    commanderTransmission: {
      type: 'PHOTO_MESSAGE',
      message: "That's the difference between passing a place and seeing it. The wall still has stories left.",
      mediaKey: 'commander/challenge-c2-storybook-witness.jpg',
    },
    safetyNotes:
      'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic.',
    gmNotes:
      'DRAFT/CONTENT_LOCKED — coordinates not yet supplied; do not activate until field-verified. Completion headline: WITNESSES CONFIRMED. Completion message: "Three fragments recovered from a wall most people pass without seeing." Prerequisite: C1. Unlocks C3 (qst-challenge-what-survived) on completion.',
  },
  {
    id: 'qst-challenge-what-survived',
    eventId: SEED_EVENT.id,
    locationId: 'loc-mother-goose-land',
    location: undefined,
    title: 'What Survived',
    slug: 'challenge-what-survived',
    description: "You didn't restore the wall. You did something that comes first: you noticed it.",
    instructions:
      'Which of these characters is clearly visible on the surviving mural — Blue whale, Dragon, Spaceship, or Race car? Answer remotely, or visit in person to also log a field check-in and a preservation photo.',
    pointValue: 175,
    xpReward: 175,
    drawingEntryReward: 1,
    difficulty: 'medium',
    category: 'observation',
    startingPath: 'challenge',
    verificationType: 'passphrase',
    // No variant answers beyond the canonical form — this is a closed
    // multiple-choice prompt (Blue whale / Dragon / Spaceship / Race car);
    // no rendered multiple-choice UI exists yet, so it's presented as a
    // free-text prompt naming the correct choice.
    proofRequirement: 'Enter the correct character (choices: Blue whale, Dragon, Spaceship, Race car).',
    isFlash: false,
    status: 'draft',
    sortOrder: 20,
    createdAt: '2026-08-24T00:00:00Z',
    radiusMeters: 60,
    remoteCapable: true,
    prerequisiteQuestId: 'qst-challenge-storybook-witness',
    unlockConditionType: 'prerequisite',
    rewardConfig: {
      baseXp: 175,
      fieldCheckInBonusXp: 125,
      photoVideoBonusXp: 75,
      nfcBonusXp: 50,
    },
    commanderTransmission: {
      type: 'PHOTO_MESSAGE',
      message:
        'A place does not have to be perfect to matter. Somebody has to see what is worth keeping before anybody decides it is worth saving.',
      mediaKey: 'commander/challenge-c3-what-survived.jpg',
    },
    safetyNotes:
      'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic. Field photo must be taken during the event — no reused or found images.',
    gmNotes:
      'DRAFT/CONTENT_LOCKED — coordinates not yet supplied; do not activate until field-verified. Photo instruction: "Take a photograph of any surviving mural character you believe deserves preservation. The image must be taken during the event." NFC bonus (+50 XP) is tied to logical cache key C-CACHE-01 ("Storybook Cache") — see the NFC cache note near SEED_COLLECTIBLES; no physical cache placement or coordinates exist yet, and the NFC scan-tag architecture itself is not implemented in this codebase (only the configured XP bonus amount exists), so this bonus is not claimable until both are built. Completion headline: ARCHIVE UPDATED. Completion message: "You didn\'t restore the wall. You did something that comes first: you noticed it." Prerequisite: C2. Unlocks C4 (qst-challenge-the-lost-page) on completion.',
  },
  {
    id: 'qst-challenge-the-lost-page',
    eventId: SEED_EVENT.id,
    locationId: 'loc-mother-goose-land',
    location: undefined,
    title: 'The Lost Page',
    slug: 'challenge-the-lost-page',
    description: 'The forgotten story produced something the Founder needed.',
    instructions:
      'Find the largest creature swimming through the story. Find the investigator watching the wall. Find the character made to be eaten. Find the hunter chasing the frightened story. Enter all four, in order, separated by hyphens: WHALE-CAT-GINGERBREAD-WOLF.',
    pointValue: 300,
    xpReward: 300,
    drawingEntryReward: 1,
    difficulty: 'hard',
    category: 'puzzle',
    startingPath: 'challenge',
    verificationType: 'passphrase',
    proofRequirement: 'Enter the full normalized sequence, e.g. "WHALE-CAT-GINGERBREAD-WOLF".',
    isFlash: false,
    status: 'draft',
    sortOrder: 21,
    createdAt: '2026-08-24T00:00:00Z',
    radiusMeters: 60,
    remoteCapable: true,
    // Transitively equivalent to requiring C1 + C2 + C3: C3 already requires
    // C2, which already requires C1, so gating on C3 alone enforces the full
    // chain via the existing single-prerequisite mechanism (no multi-
    // prerequisite schema support exists, and none is needed here).
    prerequisiteQuestId: 'qst-challenge-what-survived',
    unlockConditionType: 'prerequisite',
    rewardConfig: {
      baseXp: 300,
      fieldCheckInBonusXp: 150,
      collectibleUnlockIds: ['col-founder-code'],
      threeLocksFragment: { lock: 'code', collectibleId: 'col-founder-code' },
      countsTowardFinale: true,
      // STORYBOOK_SURVIVOR badge intentionally omitted — see gmNotes: no
      // 'storybook-survivor' (or similarly-slugged) achievement exists in
      // SEED_ACHIEVEMENTS/the achievements catalog, and inventing one here
      // would create an unsafe reference badgeUnlockSlugs can't resolve.
    },
    commanderTransmission: {
      type: 'VIDEO',
      message: "That's not just another answer. You recovered CODE. One of three locks is now in your hands.",
      mediaKey: 'commander/challenge-code-recovered.mp4',
      fallbackType: 'PHOTO_MESSAGE',
    },
    safetyNotes:
      'Remain in public-access areas. Nothing in these missions requires climbing, crossing fences, entering restricted structures, touching the mural, altering the site, or entering traffic.',
    gmNotes:
      "DRAFT/CONTENT_LOCKED — coordinates not yet supplied; do not activate until field-verified. Badge STORYBOOK_SURVIVOR requested but does not exist in the achievements catalog (SEED_ACHIEVEMENTS) — reported as missing rather than invented; add it there first if it should be granted. Completion headline: LOCK FRAGMENT RECOVERED. Completion message: \"The forgotten story produced something the Founder needed.\" Prerequisites: C1, C2, C3 (enforced transitively via C3's own prerequisite chain). Grants THREE LOCKS FRAGMENT: CODE -> col-founder-code (existing catalog entry, not a new collectible).",
  },
  // Finale Quest
  {
    id: 'qst-grand-finale-cipher',
    eventId: SEED_EVENT.id,
    locationId: 'loc-centennial-plaza',
    location: SEED_LOCATIONS[0],
    title: "Finale — The Founder's Master Key",
    slug: 'grand-finale-cipher',
    description: 'One key. One lock. The entire weekend has been leading here.',
    instructions: 'Qualified agents receive a final prompt from the Game Master during Finale Mode. Watch the official broadcast channel — the Master Key will be issued there. Enter it exactly as issued. No guessing. This key is unique to the finale event and expires when the window closes.',
    pointValue: 900,
    xpReward: 900,
    drawingEntryReward: 5,
    difficulty: 'epic',
    category: 'finale',
    startingPath: 'cross_city',
    verificationType: 'passphrase',
    proofRequirement: 'Finale qualification and official Game Master prompt required.',
    isFlash: false,
    isFinaleQuest: true,
    status: 'active',
    sortOrder: 15,
    createdAt: '2026-08-01T00:00:00Z',
    unlockConditionType: 'manual',
    safetyNotes: 'Finale prompt must never require rushing, trespassing, unsafe driving, or nighttime cemetery access.',
    gmNotes: 'Keep inactive until finale operations are staffed. Confirm drawing ledger status before awarding final entries.',
  },
];

// Fair QR Hunt — 20 permanent core QRs + 2 one-day-only daily bonus QRs
// (Sept 4-5). Public target_code values mirror the ones seeded in production
// (supabase/migrations/20260826140000_fair_qr_hunt_core_and_bonus_quests.sql
// plus the follow-up date-correction migration) so local/offline testing
// exercises the same real codes. starts_at/
// expires_at are fixed UTC instants — America/New_York is a constant UTC-4
// (EDT) offset for all of September 2026, so no DST math is needed; see
// FAIR_TIMEZONE / getFairDateKey in lib/fair-hunt.ts for the timezone-aware
// "what day is today" logic actually used at display/verification time.
const FAIR_CORE_CODES = [
  'FAIR-C01-E8Y6', 'FAIR-C02-V8TZ', 'FAIR-C03-98HH', 'FAIR-C04-B625', 'FAIR-C05-Q96H',
  'FAIR-C06-7Z96', 'FAIR-C07-RT8Y', 'FAIR-C08-BFVN', 'FAIR-C09-7VJ4', 'FAIR-C10-DH9S',
  'FAIR-C11-SY4H', 'FAIR-C12-YY3V', 'FAIR-C13-E4H8', 'FAIR-C14-FC59', 'FAIR-C15-YF59',
  'FAIR-C16-DVXZ', 'FAIR-C17-4QTZ', 'FAIR-C18-Y373', 'FAIR-C19-UNYD', 'FAIR-C20-6X4J',
];
const FAIR_BONUS_CODES = [
  'FAIR-B0904-PFVX', 'FAIR-B0905-V47W',
];
const FAIR_WINDOW_START = '2026-09-04T04:00:00Z';
const FAIR_WINDOW_END = '2026-09-06T03:59:59Z';

export const SEED_FAIR_QUESTS: Quest[] = [
  ...Array.from({ length: 20 }, (_, i) => {
    const n = i + 1;
    const quest: Quest = {
      id: `qst-${fairCoreQuestSlug(n)}`,
      eventId: SEED_FAIR_EVENT.id,
      title: `Signal ${String(n).padStart(2, '0')}`,
      slug: fairCoreQuestSlug(n),
      description: 'A permanent Canton Quests QR marker hidden somewhere across the fairgrounds.',
      instructions: 'Find the physical QR card and scan it with your phone camera to claim this signal.',
      pointValue: CORE_QR_POINTS,
      xpReward: CORE_QR_POINTS,
      drawingEntryReward: 0,
      difficulty: 'easy',
      category: 'fair_core',
      verificationType: 'qr',
      targetCode: FAIR_CORE_CODES[i],
      proofRequirement: 'Scan the physical QR marker.',
      isFlash: false,
      startsAt: FAIR_WINDOW_START,
      expiresAt: FAIR_WINDOW_END,
      status: 'active',
      sortOrder: n,
      createdAt: '2026-08-26T00:00:00Z',
      gmNotes: 'Placement TBD.',
      safetyNotes: 'Stay in public fairground areas and use marked walkways.',
    };
    return quest;
  }),
  ...FAIR_BONUS_DATES.map((dateKey, i) => {
    const [, month, day] = dateKey.split('-');
    const dayStart = `2026-09-${day}T04:00:00Z`;
    const nextDay = String(Number(day) + 1).padStart(2, '0');
    const dayEnd = i === FAIR_BONUS_DATES.length - 1 ? FAIR_WINDOW_END : `2026-09-${nextDay}T03:59:59Z`;
    const quest: Quest = {
      id: `qst-${fairBonusQuestSlug(dateKey)}`,
      eventId: SEED_FAIR_EVENT.id,
      title: `Daily Bonus — Sept ${Number(day)}`,
      slug: fairBonusQuestSlug(dateKey),
      description: 'A one-day-only bonus QR marker, live for a single Fair calendar day.',
      instructions: "Find today's bonus QR card and scan it before the day ends — it will not be here tomorrow.",
      pointValue: DAILY_BONUS_POINTS,
      xpReward: DAILY_BONUS_POINTS,
      drawingEntryReward: 0,
      difficulty: 'medium',
      category: 'fair_bonus',
      verificationType: 'qr',
      targetCode: FAIR_BONUS_CODES[i],
      proofRequirement: 'Scan the physical QR marker.',
      isFlash: true,
      startsAt: dayStart,
      expiresAt: dayEnd,
      status: 'active',
      sortOrder: 20 + i + 1,
      createdAt: '2026-08-26T00:00:00Z',
      gmNotes: 'Placement TBD.',
      safetyNotes: 'Stay in public fairground areas and use marked walkways.',
    };
    return quest;
  }),
];
