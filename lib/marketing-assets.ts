import { Quest, QuestEvent } from './types';

export const CQ_ASSET_PATH = '/canton-quests';
export const CQ_BRAND_PATH = '/brand';

export const cqBrand = {
  masterLogo: `${CQ_BRAND_PATH}/canton-quests-master-logo.png`,
  faviconMaster: `${CQ_BRAND_PATH}/canton-quests-favicon-master.png`,
  mark: `${CQ_BRAND_PATH}/canton-quests-mark.png`,
  mark512: `${CQ_BRAND_PATH}/canton-quests-mark-512.png`,
  mark192: `${CQ_BRAND_PATH}/canton-quests-mark-192.png`,
  appleTouchIcon: `${CQ_BRAND_PATH}/canton-quests-apple-touch-icon.png`,
  favicon: `${CQ_BRAND_PATH}/favicon.ico`,
  ogImage: `${CQ_BRAND_PATH}/canton-quests-og.png`,
};

export const cqImages = {
  logoNav: cqBrand.masterLogo,
  brandLogo: `${CQ_ASSET_PATH}/canton_quests.png`,
  badge: cqBrand.mark,
  heroCity: `${CQ_ASSET_PATH}/city-players-sunset.jpg`,
  heroCityBeam: `${CQ_ASSET_PATH}/hero-city-beam.jpg`,
  heroCityOriginal: `${CQ_ASSET_PATH}/11_hero_city_sunset.png`,
  tornPaper: `${CQ_ASSET_PATH}/torn-paper-wide.jpg`,
  tornMap: `${CQ_ASSET_PATH}/14_torn_map_texture.png`,
  texture: `${CQ_ASSET_PATH}/15_texture_swatches.png`,
  mapHud: `${CQ_ASSET_PATH}/adventure-map-hud.jpg`,
  mapMark: `${CQ_ASSET_PATH}/10_canton_ohio_map_mark.png`,
  cantonSign: `${CQ_ASSET_PATH}/canton-plaza-sign.jpg`,
  mckinleyStairs: `${CQ_ASSET_PATH}/mckinley-monument-stairs.jpg`,
  mckinleySunset: `${CQ_ASSET_PATH}/mckinley-monument-sunset.jpg`,
  palace: `${CQ_ASSET_PATH}/palace-theatre.jpg`,
  butterflyMural: `${CQ_ASSET_PATH}/butterfly-mural.jpg`,
  octopusMural: `${CQ_ASSET_PATH}/octopus-mural.jpg`,
  musicBlock: `${CQ_ASSET_PATH}/music-block-mural.jpg`,
  coffeeQr: `${CQ_ASSET_PATH}/coffee-qr-counter.jpg`,
  footballWide: `${CQ_ASSET_PATH}/football-sculpture-wide.jpg`,
  footballClose: `${CQ_ASSET_PATH}/football-sculpture-close.jpg`,
  questStrip: `${CQ_ASSET_PATH}/13_quest_photo_strip.png`,
  cityBanner: `${CQ_ASSET_PATH}/12_city_banner_sunset.png`,
  iconCompass: `${CQ_ASSET_PATH}/icon-compass-gold.png`,
  iconShield: `${CQ_ASSET_PATH}/icon-shield-gold.png`,
  iconTrophy: `${CQ_ASSET_PATH}/icon-trophy-gold.png`,
  iconUsers: `${CQ_ASSET_PATH}/icon-users-gold.png`,

  // New Cinematic Asset Package
  threeDoors: `${CQ_ASSET_PATH}/three_doors.png`,
  familyDoor: `${CQ_ASSET_PATH}/familydoor.png`,
  challengeDoor: `${CQ_ASSET_PATH}/challengedoor.png`,
  secretDoor: `${CQ_ASSET_PATH}/secretdoor.png`,
  cardAvailable: `${CQ_ASSET_PATH}/card_available.png`,
  cardComplete: `${CQ_ASSET_PATH}/card_complete.png`,
  cardLocked: `${CQ_ASSET_PATH}/card_locked.png`,
  cardPoster: `${CQ_ASSET_PATH}/card_poster.png`,
  questBoardBg: `${CQ_ASSET_PATH}/Quest_board.png`,
  leaderboardBg: `${CQ_ASSET_PATH}/leaderboard.png`,
  gmTransmissionBg: `${CQ_ASSET_PATH}/game_master_transmission.png`,
  prizeVault: `${CQ_ASSET_PATH}/prize_vault.png`,
  playerProfileBg: `${CQ_ASSET_PATH}/player_profile.png`,
  achievementBadges: `${CQ_ASSET_PATH}/quest_achievement_badges.png`,
  footerEndTransmission: `${CQ_ASSET_PATH}/footer_endoftrans.png`,
  palaceCinematic: `${CQ_ASSET_PATH}/palace.png`,
  footballCinematic: `${CQ_ASSET_PATH}/football.png`,
  frankCinematic: `${CQ_ASSET_PATH}/frank.png`,
  gooseWall: `${CQ_ASSET_PATH}/goosewall.png`,
  gooseWillie: `${CQ_ASSET_PATH}/goosewillie.png`,
  monumentCinematic: `${CQ_ASSET_PATH}/monument.png`,
  promoVideo: `${CQ_ASSET_PATH}/cq-briefing-transmission.mp4`,
  promoVideoPoster: `${CQ_ASSET_PATH}/cq-briefing-poster.jpg`,

  // Challenge Sector Standalone Quest Cards (1024x1536 PNG)
  challengeSkatePark: `${CQ_ASSET_PATH}/quests/challenge/skate_park.png`,
  challengeOpenGround: `${CQ_ASSET_PATH}/quests/challenge/the_open_ground.png`,
  challengeTower: `${CQ_ASSET_PATH}/quests/challenge/silo.png`,
  challengeMural: `${CQ_ASSET_PATH}/quests/challenge/mother_mural.png`,
  challengeWillie: `${CQ_ASSET_PATH}/quests/challenge/willie.png`,

  // Family District Standalone Quest Cards (1024x1536 PNG) — Phase 3A
  familyBell: `${CQ_ASSET_PATH}/quests/family/bell.png`,
  familyCantonSign: `${CQ_ASSET_PATH}/quests/family/canton.png`,
  familyFootball: `${CQ_ASSET_PATH}/quests/family/football.png`,
  familyOcto: `${CQ_ASSET_PATH}/quests/family/octo.png`,
  familyPalace: `${CQ_ASSET_PATH}/quests/family/palace.png`,

  // Secret District Standalone Quest Cards (1024x1536 PNG) — Phase 3B
  secretFlame: `${CQ_ASSET_PATH}/quests/secret/flame.png`,
  secretGoldenMark: `${CQ_ASSET_PATH}/quests/secret/the golden mark.png`,
  secretWater: `${CQ_ASSET_PATH}/quests/secret/water.png`,
};

export interface ChallengeSectorCardDef {
  order: number;
  number: string;
  title: string;
  location: string;
  image: string;
  slug: string;
  rewardXp: number;
  description: string;
}

/** Canonical 5-mission Challenge Sector route order (01 Skate Park -> 02 Open Ground -> 03 Tower -> 04 Mural -> 05 Willie) */
export const challengeSectorCards: ChallengeSectorCardDef[] = [
  {
    order: 1,
    number: '01',
    title: 'Skate Park Check-In',
    location: '9th Street Skate Park',
    image: cqImages.challengeSkatePark,
    slug: '9th-street-opening',
    rewardXp: 100,
    description: 'Reach the skate park and establish your position to begin the Challenge Sector run.',
  },
  {
    order: 2,
    number: '02',
    title: 'THE OPEN GROUND',
    location: 'CHALLENGE FIELD',
    image: cqImages.challengeOpenGround,
    slug: 'challenge-open-ground',
    rewardXp: 100,
    description: 'Cross into the open ground. Your next Challenge signal is waiting somewhere beyond the pavement.',
  },
  {
    order: 3,
    number: '03',
    title: 'The Tower',
    location: 'Mother Goose Land',
    image: cqImages.challengeTower,
    slug: 'challenge-the-tower',
    rewardXp: 100,
    description: 'Find the strange tower standing over the old grounds. Get close enough to confirm the landmark.',
  },
  {
    order: 4,
    number: '04',
    title: 'THE MURAL',
    location: 'MOTHER GOOSE LAND',
    image: cqImages.challengeMural,
    slug: 'challenge-the-mural',
    rewardXp: 100,
    description: 'Locate the painted wall and inspect the characters hidden across the scene.',
  },
  {
    order: 5,
    number: '05',
    title: 'Willie the Whale',
    location: 'Mother Goose Land',
    image: cqImages.challengeWillie,
    slug: 'challenge-blue-signal',
    rewardXp: 100,
    description: 'Find Willie. The old whale is still holding his ground — and your final Challenge signal.',
  },
];

export const questImagePool = [
  cqImages.palaceCinematic,
  cqImages.monumentCinematic,
  cqImages.butterflyMural,
  cqImages.coffeeQr,
  cqImages.cantonSign,
  cqImages.footballCinematic,
  cqImages.gooseWall,
  cqImages.gooseWillie,
  cqImages.challengeSkatePark,
  cqImages.challengeOpenGround,
  cqImages.challengeTower,
  cqImages.challengeMural,
  cqImages.challengeWillie,
  cqImages.frankCinematic,
  cqImages.musicBlock,
  cqImages.heroCity,
  cqImages.mapHud,
];

const questImageBySlug: Record<string, string> = {
  // Challenge Sector Quests (Sequence 01 - 05)
  '9th-street-opening': cqImages.challengeSkatePark,
  'challenge-skate-park': cqImages.challengeSkatePark,
  'challenge-open-ground': cqImages.challengeOpenGround,
  'the-open-ground': cqImages.challengeOpenGround,
  'challenge-the-tower': cqImages.challengeTower,
  'the-tower': cqImages.challengeTower,
  'challenge-the-mural': cqImages.challengeMural,
  'the-mural': cqImages.challengeMural,
  'goose-land-cipher': cqImages.challengeMural,
  'challenge-blue-signal': cqImages.challengeWillie,
  'willie-the-whale': cqImages.challengeWillie,
  'challenge-storybook-witness': cqImages.challengeMural,
  'challenge-what-survived': cqImages.challengeWillie,
  'challenge-the-lost-page': cqImages.challengeMural,

  // Family District Quests (Phase 3A)
  'bell-cipher': cqImages.familyBell,
  'canton-sign-capture': cqImages.familyCantonSign,
  'draft-lineup': cqImages.familyFootball,

  // Phase 3B
  'kraken-wall': cqImages.familyOcto,
  'palace-stars': cqImages.familyPalace,
  'eternal-flame': cqImages.secretFlame,
  'golden-mark-cipher': cqImages.secretGoldenMark,
  'spring-water-shelter': cqImages.secretWater,
};

const questImageByLocation: Record<string, string> = {
  // Real location photos used wherever available; cinematic art as fallback
  'loc-centennial-plaza':      cqImages.cantonSign,           // real photo
  'loc-mckinley-monument':     cqImages.mckinleySunset,       // real sunset photo (replaces cinematic)
  'loc-4th-st-mural':          cqImages.butterflyMural,       // real mural photo
  'loc-aura-craft-coffee':     cqImages.coffeeQr,             // real interior photo
  'loc-arcade-bar':            cqImages.heroCity,             // inactive quest; generic fallback
  'loc-music-hall':            cqImages.palace,               // real Palace Theatre photo
  'loc-hof-trail':             cqImages.footballWide,         // real sculpture photo (replaces cinematic)
  'loc-onesto-building':       cqImages.musicBlock,           // arts district photo — needs real Onesto photo
  'loc-west-lawn-frankenstein': cqImages.frankCinematic,      // cinematic illustration (no real photo exists)
  'loc-mother-goose-land':     cqImages.challengeMural,       // Mother Goose Land mural / artwork card
  'loc-9th-street':            cqImages.challengeSkatePark,   // 9th Street Skate Park card
  'loc-challenge-field':       cqImages.challengeOpenGround,  // The Open Ground field card
  'loc-challenge-tower':       cqImages.challengeTower,       // The Tower silo card
};

export const destinationCards = [
  {
    title: 'Centennial Plaza',
    label: 'Opening Signal',
    image: cqImages.cantonSign,
    district: 'Arts District',
    copy: 'The center grid for live drops, rendezvous clues, and opening weekend energy.',
  },
  {
    title: 'McKinley Monument',
    label: 'Historic Cipher',
    image: cqImages.monumentCinematic,
    district: 'Monument Park',
    copy: 'A landmark climb where observation, history, and skyline views become playable.',
  },
  {
    title: 'Palace Theatre',
    label: 'Marquee Lore',
    image: cqImages.palaceCinematic,
    district: 'Arts District',
    copy: 'Downtown lights, architectural details, and old Canton stories hide mission clues.',
  },
  {
    title: 'Mother Goose Land',
    label: 'Kinetic Challenge',
    image: cqImages.gooseWall,
    district: 'Mother Goose Land',
    copy: 'Historic park murals and nostalgic landmarks host energetic challenge routes.',
  },
  {
    title: 'West Lawn Cemetery',
    label: 'Hushed Cipher',
    image: cqImages.frankCinematic,
    district: 'Monument Park Corridor',
    copy: 'Respectful daytime history observation and sequential cipher fragments.',
  },
  {
    title: 'Arts District Murals',
    label: 'Photo Proof',
    image: cqImages.butterflyMural,
    district: 'Arts District',
    copy: 'Street art becomes a field objective for creative agents and hidden-route hunters.',
  },
];

export const proofTypeLabels: Record<Quest['verificationType'], string> = {
  checkin: 'GPS Check-In',
  gps: 'GPS Location',
  qr: 'QR Scan',
  passphrase: 'Passphrase',
  photo: 'Photo Proof',
  video: 'Video Proof',
  game_master: 'Game Master Approval',
  multi_step: 'Multi-Step Mission',
};

export const questCategoryLabels: Record<Quest['category'], string> = {
  exploration: 'Exploration',
  puzzle: 'Puzzle',
  observation: 'Observation',
  creative: 'Creative',
  photo_video: 'Photo / Video',
  business_partner: 'Partner Stop',
  flash: 'Flash Drop',
  trivia: 'Trivia',
  secret: 'Hidden Mission',
  finale: 'Finale',
  fair_core: 'Fair Core Signal',
  fair_bonus: 'Fair Daily Bonus',
};

export const rarityClassName: Record<string, string> = {
  COMMON: 'cq-rarity-common',
  RARE: 'cq-rarity-rare',
  EPIC: 'cq-rarity-epic',
  LEGENDARY: 'cq-rarity-legendary',
};

export function getActiveEvent(events: QuestEvent[]) {
  return events.find((event) => event.status === 'active') || events[0];
}

/**
 * A Mission's public status for directory/card display: LIVE, UPCOMING, or
 * ENDED. Prefers the event's own authoritative `status` field (the same
 * source getActiveEvent already trusts) and only falls back to comparing
 * startTime/endTime against now for older/local data that never got a
 * maintained status value.
 */
export function getOperationStatus(event: QuestEvent): 'LIVE' | 'UPCOMING' | 'ENDED' {
  if (event.status === 'ended') return 'ENDED';
  if (event.status === 'active') return 'LIVE';
  if (event.endTime && new Date(event.endTime).getTime() <= Date.now()) return 'ENDED';
  if (!event.startTime || new Date(event.startTime).getTime() <= Date.now()) return 'LIVE';
  return 'UPCOMING';
}

export function getQuestRarity(quest: Quest) {
  if (quest.isSecret || quest.isFinaleQuest) return 'LEGENDARY';
  if (quest.isFlash) return 'EPIC';
  if (quest.difficulty === 'hard') return 'EPIC';
  if (quest.difficulty === 'medium') return 'RARE';
  return 'COMMON';
}

export function getQuestImage(quest: Quest, index = 0) {
  if (quest.slug && questImageBySlug[quest.slug]) {
    return questImageBySlug[quest.slug];
  }

  if (quest.locationId && questImageByLocation[quest.locationId]) {
    return questImageByLocation[quest.locationId];
  }

  return questImagePool[index % questImagePool.length];
}

export function isStandaloneQuestCard(imagePath?: string): boolean {
  if (!imagePath) return false;
  return imagePath.includes('/quests/challenge/') || imagePath.includes('/quests/family/') || imagePath.includes('/quests/secret/');
}

export function getQuestDuration(quest: Quest) {
  if (quest.isFlash) return 'Timed drop';
  if (quest.difficulty === 'easy') return '15-25 min';
  if (quest.difficulty === 'medium') return '30-45 min';
  if (quest.difficulty === 'hard') return '45-75 min';
  return 'Finale tier';
}

export function cleanQuestTitle(title: string) {
  return title.replace('⚡ ', '').replace('🔒 ', '').replace('🏆 ', '');
}

export function formatEventWindow(event: QuestEvent) {
  if (!event.startTime || !event.endTime) return 'Event window announced soon';

  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  return `${start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} - ${end.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })}`;
}
