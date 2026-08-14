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
};

export const questImagePool = [
  cqImages.palace,
  cqImages.mckinleyStairs,
  cqImages.butterflyMural,
  cqImages.coffeeQr,
  cqImages.cantonSign,
  cqImages.octopusMural,
  cqImages.musicBlock,
  cqImages.footballWide,
  cqImages.heroCity,
  cqImages.mapHud,
];

const questImageByLocation: Record<string, string> = {
  'loc-centennial-plaza': cqImages.cantonSign,
  'loc-mckinley-monument': cqImages.mckinleyStairs,
  'loc-4th-st-mural': cqImages.butterflyMural,
  'loc-aura-craft-coffee': cqImages.coffeeQr,
  'loc-arcade-bar': cqImages.footballWide,
  'loc-music-hall': cqImages.palace,
  'loc-hof-trail': cqImages.footballClose,
  'loc-onesto-building': cqImages.musicBlock,
};

export const destinationCards = [
  {
    title: 'Centennial Plaza',
    label: 'Opening Signal',
    image: cqImages.cantonSign,
    copy: 'The center grid for live drops, rendezvous clues, and opening weekend energy.',
  },
  {
    title: 'McKinley Monument',
    label: 'Historic Cipher',
    image: cqImages.mckinleySunset,
    copy: 'A landmark climb where observation, history, and skyline views become playable.',
  },
  {
    title: 'Palace Theatre',
    label: 'Marquee Lore',
    image: cqImages.palace,
    copy: 'Downtown lights, architectural details, and old Canton stories hide mission clues.',
  },
  {
    title: 'Arts District Murals',
    label: 'Photo Proof',
    image: cqImages.octopusMural,
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

export function getQuestRarity(quest: Quest) {
  if (quest.isSecret || quest.isFinaleQuest) return 'LEGENDARY';
  if (quest.isFlash) return 'EPIC';
  if (quest.difficulty === 'hard') return 'EPIC';
  if (quest.difficulty === 'medium') return 'RARE';
  return 'COMMON';
}

export function getQuestImage(quest: Quest, index = 0) {
  if (quest.locationId && questImageByLocation[quest.locationId]) {
    return questImageByLocation[quest.locationId];
  }

  return questImagePool[index % questImagePool.length];
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
