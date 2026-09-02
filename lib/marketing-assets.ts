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
    title: 'Canton Sign Capture',
    label: 'Family Sector',
    image: cqImages.familyCantonSign,
    district: 'Centennial Plaza',
    copy: 'Canton spells its own name in the open. Prove you found it.',
  },
  {
    title: 'Bell Cipher',
    label: 'Family Sector',
    image: cqImages.familyBell,
    district: 'Arts District',
    copy: 'A city this old rings with more than one voice — Canton keeps a bell that still remembers who put it there.',
  },
  {
    title: 'Draft Lineup',
    label: 'Family Sector',
    image: cqImages.familyFootball,
    district: 'HOF Trail',
    copy: "Before the Hall of Fame, before the highlight reels, there was a first line. It's still crouched here, waiting for the snap.",
  },
  {
    title: 'Kraken Wall',
    label: 'Family Sector',
    image: cqImages.familyOcto,
    district: 'Arts District',
    copy: 'Track down the giant tentacle mural and capture the creature in a photo.',
  },
  {
    title: 'Palace Stars',
    label: 'Family Sector',
    image: cqImages.familyPalace,
    district: 'Palace Theatre Block',
    copy: "The Palace isn't the only name written into this block.",
  },
  {
    title: 'The 9th Street Signal',
    label: 'Challenge Sector',
    image: cqImages.challengeSkatePark,
    district: '9th Street Skate Park',
    copy: 'The Challenge path starts here. Show up. Check in. The grid opens.',
  },
  {
    title: 'The Open Ground',
    label: 'Challenge Sector',
    image: cqImages.challengeOpenGround,
    district: 'Mother Goose Land',
    copy: 'Cross into the open ground. Your next Challenge signal is waiting somewhere beyond the pavement.',
  },
  {
    title: 'The Tower',
    label: 'Challenge Sector · Staged',
    image: cqImages.challengeTower,
    district: 'Mother Goose Land',
    copy: 'A strange painted tower has stood over these grounds since before the park had a name people remember.',
  },
  {
    title: 'Willie the Whale',
    label: 'Challenge Sector',
    image: cqImages.challengeWillie,
    district: 'Mother Goose Land',
    copy: "Willie's been holding his ground at Mother Goose Land longer than most of downtown has existed.",
  },
  {
    title: 'The Stone Stair Cipher',
    label: 'Secret Sector',
    image: cqImages.mckinleySunset,
    district: 'McKinley National Memorial',
    copy: 'The McKinley Memorial has been carved with the answer since it was built. You just have to read it.',
  },
  {
    title: 'The Eternal Flame',
    label: 'Secret Sector',
    image: cqImages.secretFlame,
    district: 'Monument Park',
    copy: 'Some flames are lit to make sure a promise never goes dark.',
  },
  {
    title: 'The Golden Mark',
    label: 'Secret Sector · Staged',
    image: cqImages.secretGoldenMark,
    district: 'Canton Road',
    copy: 'A curious symbol stands along the way. Some say it marks a meeting point — for those who know.',
  },
  {
    title: 'Spring Water Shelter',
    label: 'Secret Sector · Staged',
    image: cqImages.secretWater,
    district: 'Fort Hill Park',
    copy: 'A quiet place to pause and listen. Fresh water flows here — and so might the answers.',
  },
];

/**
 * A small, spoiler-safe subset of destinationCards for the public Mission
 * Directory's "glimpse inside" preview only (app/events/page.tsx).
 * destinationCards itself is untouched and still fully powers the real
 * in-Mission board (components/FounderCipherShell.tsx) — this list just
 * picks out entry-point Family/Challenge cards whose copy never reveals a
 * cipher answer, exact solution, finale location, or late-game discovery.
 * Deliberately excludes every Secret Sector card and every "Staged"
 * (not-yet-placed) card.
 */
const MISSION_PREVIEW_CARD_TITLES = ['Canton Sign Capture', 'Bell Cipher', 'Kraken Wall', 'The 9th Street Signal'];
export const missionPreviewCards = destinationCards.filter((card) => MISSION_PREVIEW_CARD_TITLES.includes(card.title));

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
 * ENDED. `status: 'ended'` is a genuine admin override (always ENDED, even
 * if endTime is somehow still in the future). Otherwise this is purely
 * time-driven — an "active" status (meaning "published/enabled", not
 * "happening right now") does NOT by itself make a future-dated Mission
 * show as LIVE. A Mission is only LIVE once its own startTime has actually
 * arrived (or it has no startTime at all) and it isn't paused; an ended
 * endTime always wins over a stale status value. `now` is injectable for
 * tests — never hardcode "today" here.
 */
export function getOperationStatus(event: QuestEvent, now: Date = new Date()): 'LIVE' | 'UPCOMING' | 'ENDED' {
  if (event.status === 'ended') return 'ENDED';
  const nowMs = now.getTime();
  if (event.endTime && new Date(event.endTime).getTime() <= nowMs) return 'ENDED';
  const hasStarted = !event.startTime || new Date(event.startTime).getTime() <= nowMs;
  if (hasStarted && !event.isPaused) return 'LIVE';
  return 'UPCOMING';
}

/**
 * The small set of "worldbuilding-only" archived Missions — ended events
 * with a real event row (title/dates/status/description) but deliberately
 * no quests, QR codes, submissions, or players behind them. Distinct from
 * a real Operation (e.g. the Sept 11 Main Operation) that will also
 * eventually reach status: 'ended' but has genuine quest/leaderboard
 * history worth showing on the full /events/[slug] dashboard. Cards and
 * links for these slugs route to the lightweight /events/archive/[slug]
 * page instead, and never claim a prize/leaderboard that doesn't exist.
 */
export const ARCHIVED_MISSION_DEBRIEF: Record<string, { stamp: string; lines: string[] }> = {
  'the-missing-signal': {
    stamp: 'MISSION COMPLETE',
    lines: ['The signal was traced.', 'The network remained.', 'Somewhere in Canton, another transmission was already waiting.'],
  },
  'the-midnight-ledger': {
    stamp: 'MISSION COMPLETE',
    lines: ['The final entry was recovered.', 'The ledger closed.', 'But one question remained:', 'Who was keeping the record?'],
  },
};

export function isWorldbuildingArchiveMission(slug: string): boolean {
  return slug in ARCHIVED_MISSION_DEBRIEF;
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
