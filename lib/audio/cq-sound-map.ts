/**
 * Canton Quests — Central Sound Event Map & Configuration
 *
 * Defines all audio asset locations, playback priorities, volume calibrations,
 * cooldown limits, and preload settings for the Canton Quests tactical sound engine.
 * Swapping sound files requires modifying only the asset paths in this map.
 */

export const CQ_SOUND_MAP = {
  // UI Interactions
  uiClick: '/audio/cq/ui-click.mp3',
  uiConfirm: '/audio/cq/ui-confirm.mp3',
  uiBack: '/audio/cq/ui-back.mp3',
  uiError: '/audio/cq/ui-error.mp3',
  uiLocked: '/audio/cq/ui-locked.mp3',

  // Quest Milestones
  questSelect: '/audio/cq/quest-select.mp3',
  questStart: '/audio/cq/quest-start.mp3',
  questComplete: '/audio/cq/quest-complete.mp3',
  chainUnlock: '/audio/cq/chain-unlock.mp3',
  secretReveal: '/audio/cq/secret-reveal.mp3',

  // Player Progression
  badgeUnlock: '/audio/cq/badge-unlock.mp3',
  rankUp: '/audio/cq/rank-up.mp3',
  xpGain: '/audio/cq/xp-gain.mp3',

  // Dynamic Live Events
  flashDrop: '/audio/cq/flash-drop.mp3',
  transmission: '/audio/cq/transmission.mp3',
  finaleQualified: '/audio/cq/finale-qualified.mp3',

  // Starting Paths
  pathFamily: '/audio/cq/path-family.mp3',
  pathChallenge: '/audio/cq/path-challenge.mp3',
  pathSecret: '/audio/cq/path-secret.mp3',

  // Map & Scanner HUD
  scan: '/audio/cq/scan.mp3',
  lockOn: '/audio/cq/lock-on.mp3',
  nodePing: '/audio/cq/node-ping.mp3',
} as const;

export type CQSoundKey = keyof typeof CQ_SOUND_MAP;

export type CQSoundEvent =
  | 'ui_click'
  | 'ui_confirm'
  | 'ui_back'
  | 'ui_error'
  | 'ui_locked'
  | 'quest_select'
  | 'quest_start'
  | 'quest_complete'
  | 'chain_unlock'
  | 'secret_reveal'
  | 'badge_unlock'
  | 'rank_up'
  | 'xp_gain'
  | 'flash_drop'
  | 'transmission'
  | 'finale_qualified'
  | 'path_family'
  | 'path_challenge'
  | 'path_secret'
  | 'scan'
  | 'lock_on'
  | 'node_ping';

export type CQSoundCategory = 'ui' | 'quest' | 'player' | 'event' | 'path' | 'map';

export interface CQSoundConfig {
  key: CQSoundKey;
  event: CQSoundEvent;
  src: string;
  category: CQSoundCategory;
  volume: number; // 0.0 - 1.0
  cooldownMs: number; // minimum delay before repeating
  priority: number; // 0 - 100 (higher overrides / ducks lower)
  preload: boolean;
  description: string;
}

export const CQ_SOUND_CONFIGS: Record<CQSoundEvent, CQSoundConfig> = {
  ui_click: {
    key: 'uiClick',
    event: 'ui_click',
    src: CQ_SOUND_MAP.uiClick,
    category: 'ui',
    volume: 0.35, // Subtle, never harsh
    cooldownMs: 45,
    priority: 10,
    preload: true,
    description: 'Tactile, grounded micro-transient for button presses and tab clicks',
  },
  ui_confirm: {
    key: 'uiConfirm',
    event: 'ui_confirm',
    src: CQ_SOUND_MAP.uiConfirm,
    category: 'ui',
    volume: 0.5,
    cooldownMs: 120,
    priority: 25,
    preload: true,
    description: 'Crisp positive confirmation stinger',
  },
  ui_back: {
    key: 'uiBack',
    event: 'ui_back',
    src: CQ_SOUND_MAP.uiBack,
    category: 'ui',
    volume: 0.35,
    cooldownMs: 80,
    priority: 15,
    preload: false,
    description: 'Subtle descending tactile release for navigating backward or canceling',
  },
  ui_error: {
    key: 'uiError',
    event: 'ui_error',
    src: CQ_SOUND_MAP.uiError,
    category: 'ui',
    volume: 0.55,
    cooldownMs: 250,
    priority: 30,
    preload: true,
    description: 'Muted low tactical rejection thud (not loud arcade buzzer)',
  },
  ui_locked: {
    key: 'uiLocked',
    event: 'ui_locked',
    src: CQ_SOUND_MAP.uiLocked,
    category: 'ui',
    volume: 0.45,
    cooldownMs: 180,
    priority: 20,
    preload: false,
    description: 'Metallic resistance latch click for locked quest interactions',
  },
  quest_select: {
    key: 'questSelect',
    event: 'quest_select',
    src: CQ_SOUND_MAP.questSelect,
    category: 'quest',
    volume: 0.55,
    cooldownMs: 150,
    priority: 40,
    preload: true,
    description: 'Quick tactical scanner lock-on pulse when opening or targeting a quest',
  },
  quest_start: {
    key: 'questStart',
    event: 'quest_start',
    src: CQ_SOUND_MAP.questStart,
    category: 'quest',
    volume: 0.65,
    cooldownMs: 300,
    priority: 50,
    preload: false,
    description: 'Energetic deployment sweep and tactical lock when starting a mission',
  },
  quest_complete: {
    key: 'questComplete',
    event: 'quest_complete',
    src: CQ_SOUND_MAP.questComplete,
    category: 'quest',
    volume: 0.85,
    cooldownMs: 500,
    priority: 80,
    preload: true,
    description: 'Grounded sub-bass impact + ascending warm harmonic chord (feels earned)',
  },
  chain_unlock: {
    key: 'chainUnlock',
    event: 'chain_unlock',
    src: CQ_SOUND_MAP.chainUnlock,
    category: 'quest',
    volume: 0.75,
    cooldownMs: 500,
    priority: 75,
    preload: false,
    description: 'Multi-stage mechanical latch sequence and harmonic chime',
  },
  secret_reveal: {
    key: 'secretReveal',
    event: 'secret_reveal',
    src: CQ_SOUND_MAP.secretReveal,
    category: 'quest',
    volume: 0.75,
    cooldownMs: 500,
    priority: 70,
    preload: false,
    description: 'Low pulse + reverse swell + reveal click for hidden clues and cryptic lore',
  },
  badge_unlock: {
    key: 'badgeUnlock',
    event: 'badge_unlock',
    src: CQ_SOUND_MAP.badgeUnlock,
    category: 'player',
    volume: 0.8,
    cooldownMs: 500,
    priority: 85,
    preload: true,
    description: 'Metallic shimmer + crisp bell reward accent for unlocking achievements and badges',
  },
  rank_up: {
    key: 'rankUp',
    event: 'rank_up',
    src: CQ_SOUND_MAP.rankUp,
    category: 'player',
    volume: 0.9,
    cooldownMs: 500,
    priority: 90,
    preload: true,
    description: 'Deep cinematic boom + ascending brass fanfare for leaderboard standing ascension',
  },
  xp_gain: {
    key: 'xpGain',
    event: 'xp_gain',
    src: CQ_SOUND_MAP.xpGain,
    category: 'player',
    volume: 0.45,
    cooldownMs: 100,
    priority: 25,
    preload: false,
    description: 'Crisp micro-particle sparkle hit during XP counter progression',
  },
  flash_drop: {
    key: 'flashDrop',
    event: 'flash_drop',
    src: CQ_SOUND_MAP.flashDrop,
    category: 'event',
    volume: 0.8,
    cooldownMs: 600,
    priority: 65,
    preload: false,
    description: 'Urgent transmission alert stinger for pop-up live flash quest drops',
  },
  transmission: {
    key: 'transmission',
    event: 'transmission',
    src: CQ_SOUND_MAP.transmission,
    category: 'event',
    volume: 0.6,
    cooldownMs: 400,
    priority: 45,
    preload: false,
    description: 'Field comms radio incoming handshake tone',
  },
  finale_qualified: {
    key: 'finaleQualified',
    event: 'finale_qualified',
    src: CQ_SOUND_MAP.finaleQualified,
    category: 'event',
    volume: 1.0,
    cooldownMs: 1000,
    priority: 100,
    preload: false,
    description: 'Grandest event in the system — deep sub-impact + celestial overtone resonance',
  },
  path_family: {
    key: 'pathFamily',
    event: 'path_family',
    src: CQ_SOUND_MAP.pathFamily,
    category: 'path',
    volume: 0.75,
    cooldownMs: 400,
    priority: 60,
    preload: false,
    description: 'Warmer, brighter, welcoming, energetic acoustic resonance for Family path',
  },
  path_challenge: {
    key: 'pathChallenge',
    event: 'path_challenge',
    src: CQ_SOUND_MAP.pathChallenge,
    category: 'path',
    volume: 0.75,
    cooldownMs: 400,
    priority: 60,
    preload: false,
    description: 'Sharper, heavier, kinetic mechanical power-chord strike for Challenge path',
  },
  path_secret: {
    key: 'pathSecret',
    event: 'path_secret',
    src: CQ_SOUND_MAP.pathSecret,
    category: 'path',
    volume: 0.75,
    cooldownMs: 400,
    priority: 60,
    preload: false,
    description: 'Darker, mysterious D-minor sonar swell for Secret path',
  },
  scan: {
    key: 'scan',
    event: 'scan',
    src: CQ_SOUND_MAP.scan,
    category: 'map',
    volume: 0.6,
    cooldownMs: 350,
    priority: 35,
    preload: false,
    description: 'Radar sweep and frequency pulse during citywide objective grid scans',
  },
  lock_on: {
    key: 'lockOn',
    event: 'lock_on',
    src: CQ_SOUND_MAP.lockOn,
    category: 'map',
    volume: 0.5,
    cooldownMs: 150,
    priority: 30,
    preload: false,
    description: 'Precision reticle alignment snap when acquiring target GPS coordinates',
  },
  node_ping: {
    key: 'nodePing',
    event: 'node_ping',
    src: CQ_SOUND_MAP.nodePing,
    category: 'map',
    volume: 0.45,
    cooldownMs: 200,
    priority: 25,
    preload: false,
    description: 'Subtle GPS waypoint beacon sonar ping',
  },
};

/**
 * Maps camelCase CQ_SOUND_MAP keys to their canonical CQSoundEvent representation.
 */
export const CQ_KEY_TO_EVENT: Record<CQSoundKey, CQSoundEvent> = {
  uiClick: 'ui_click',
  uiConfirm: 'ui_confirm',
  uiBack: 'ui_back',
  uiError: 'ui_error',
  uiLocked: 'ui_locked',
  questSelect: 'quest_select',
  questStart: 'quest_start',
  questComplete: 'quest_complete',
  chainUnlock: 'chain_unlock',
  secretReveal: 'secret_reveal',
  badgeUnlock: 'badge_unlock',
  rankUp: 'rank_up',
  xpGain: 'xp_gain',
  flashDrop: 'flash_drop',
  transmission: 'transmission',
  finaleQualified: 'finale_qualified',
  pathFamily: 'path_family',
  pathChallenge: 'path_challenge',
  pathSecret: 'path_secret',
  scan: 'scan',
  lockOn: 'lock_on',
  nodePing: 'node_ping',
};

/**
 * Resolves any valid key or event identifier to its canonical configuration.
 */
export function resolveSoundConfig(identifier: CQSoundEvent | CQSoundKey): CQSoundConfig {
  if (identifier in CQ_SOUND_CONFIGS) {
    return CQ_SOUND_CONFIGS[identifier as CQSoundEvent];
  }
  const event = CQ_KEY_TO_EVENT[identifier as CQSoundKey];
  if (event && CQ_SOUND_CONFIGS[event]) {
    return CQ_SOUND_CONFIGS[event];
  }
  // Fallback default
  return CQ_SOUND_CONFIGS.ui_click;
}
