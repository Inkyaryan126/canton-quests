import { cqImages } from './marketing-assets';

export const ACQUISITION_ENTRY_HREF = '/events/canton-weekend-1/quests';

export const ACQUISITION_LANDING_DESTINATION_PRESETS = [
  { label: 'Family', path: '/start/family' },
  { label: 'Challenge', path: '/start/challenge' },
  { label: 'Secret', path: '/start/secret' },
] as const;

export type AcquisitionLandingSlug = 'family' | 'challenge' | 'secret';

export interface FairLandingContent {
  slug: AcquisitionLandingSlug;
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  theme: 'family' | 'challenge' | 'secret';
  eyebrow: string;
  headline: string;
  secondaryHeadline?: string;
  support: string[];
  cta: string;
  heroImage: string;
  heroImageAlt: string;
  proofPoints: string[];
  flow?: string[];
  objection?: {
    title: string;
    body: string;
  };
  challengeLine?: string;
  teaserCards?: Array<{
    title: string;
    copy: string;
  }>;
  sections: Array<{
    eyebrow: string;
    title: string;
    body: string;
  }>;
}

export const acquisitionLandingPages: Record<AcquisitionLandingSlug, FairLandingContent> = {
  family: {
    slug: 'family',
    title: 'Turn Canton Into Your Playground | Canton Quests Family Adventure',
    description:
      'Explore Canton together, solve clues, discover places, complete challenges, earn XP, and make memories. Zero app store download required.',
    ogTitle: 'Turn Canton Into Your Playground | Canton Quests',
    ogDescription:
      'A real-world Canton city adventure built for parents, kids, couples, and mixed-age crews. Explore together, solve clues, and earn XP.',
    theme: 'family',
    eyebrow: 'ALL-AGES CITY ADVENTURE',
    headline: 'TURN CANTON INTO YOUR PLAYGROUND',
    secondaryHeadline: 'EXPLORE TOGETHER. SOLVE CLUES. MAKE MEMORIES.',
    support: [
      'EXPLORE CANTON TOGETHER, SOLVE CLUES, DISCOVER PLACES, COMPLETE CHALLENGES, EARN XP, AND MAKE MEMORIES.',
      'Canton is hiding missions, clues, strange landmarks, and challenges in plain sight.',
      'Gather your crew, pick a quest from the live board, and turn the city into a shared real-world adventure.',
    ],
    cta: 'START THE FAMILY QUEST',
    heroImage: cqImages.heroCity,
    heroImageAlt: 'People exploring Canton at sunset',
    proofPoints: [
      'NO APP DOWNLOAD REQUIRED',
      'PLAY TOGETHER AS A CREW',
      'REAL CANTON LANDMARKS',
      'XP + PRIZE DRAWINGS',
    ],
    flow: ['CHOOSE A MISSION', 'EXPLORE CANTON', 'SUBMIT PROOF', 'EARN XP & DRAWING ENTRIES'],
    objection: {
      title: 'Built for mixed-age crews with zero friction.',
      body: 'No mandatory account creation before you begin. Choose a family callsign, pick an easy or medium mission, and start walking Canton right from your browser.',
    },
    challengeLine: 'Walkable downtown routes + landmark drive options.',
    sections: [
      {
        eyebrow: 'All-Ages Roles',
        title: 'Everyone gets a role on the team.',
        body: 'Clue spotters, navigators, photographers, and puzzle decoders all have jobs when Canton becomes the game board.',
      },
      {
        eyebrow: 'Family Safety First',
        title: 'Real-world adventure with safety built in.',
        body: 'Stay together, use marked crosswalks, respect local businesses, observe daylight hours, and never trespass on private property.',
      },
    ],
  },
  challenge: {
    slug: 'challenge',
    title: 'Think You Can Beat Canton? | Canton Quests Competitive Challenge',
    description:
      'Enter the competitive real-world Canton game. Timed flash drops, cryptographic ciphers, GPS missions, XP scoring, and live leaderboards.',
    ogTitle: 'Think You Can Beat Canton? | Canton Quests',
    ogDescription:
      'High-stakes real-world city competition in Canton, Ohio. Crack ciphers, hit flash drops, score XP, and climb the leaderboard.',
    theme: 'challenge',
    eyebrow: 'COMPETITIVE LIVE GRID // CITYWIDE PLAYERS',
    headline: 'THINK YOU CAN BEAT CANTON?',
    secondaryHeadline: "THE CITY IS THE BOARD. YOU'RE IN THE RACE.",
    support: [
      "CANTON IS THE BOARD. YOU'RE THE PLAYER.",
      'Hidden codes. Real locations. Timed flash drops. Cryptographic ciphers. Live leaderboard pressure.',
      'Some players solve one mission. The top agents conquer the whole board. Where do you stand on the leaderboard?',
    ],
    cta: 'ACCEPT THE CHALLENGE',
    heroImage: cqImages.mapHud,
    heroImageAlt: 'Canton Quests game map interface with tactical HUD',
    proofPoints: ['HIDDEN CODES', 'GPS CHECK-INS', 'TIMED FLASH DROPS', 'LIVE LEADERBOARDS'],
    flow: ['COMPLETE QUESTS', 'EARN XP', 'EARN DRAWING ENTRIES', 'CLIMB THE BOARD'],
    challengeLine: 'The leaderboard updates in real time. Field agents are already scoring.',
    sections: [
      {
        eyebrow: 'Tactical Scoring Matrix',
        title: 'Every verified check-in moves your rank.',
        body: 'Base quest XP, sequential cipher locks, and live flash drops feed into the real-time scoring ledger. Zero pay-to-win mechanics.',
      },
      {
        eyebrow: 'Strategic Traversal',
        title: 'Master route geometry and cipher speed.',
        body: 'The strongest competitive agents optimize their path across downtown, crack codes swiftly, and submit verified proof to dominate the leaderboard.',
      },
    ],
  },
  secret: {
    slug: 'secret',
    title: 'Unlisted Entry Point | Canton Quests Secret Lore',
    description:
      'You found an unlisted entry point. Discover hidden Canton ciphers, local mystery missions, and the unlisted layer of Canton Quests.',
    ogTitle: 'You Found an Unlisted Entry Point | Canton Quests',
    ogDescription:
      'Most players enter Canton Quests through the front door. You didn’t. Unlisted ciphers, forgotten landmarks, and real-world mysteries.',
    theme: 'secret',
    eyebrow: 'CLASSIFIED ENTRY // UNLISTED SIGNAL',
    headline: 'YOU FOUND AN UNLISTED ENTRY POINT.',
    secondaryHeadline: "MOST PLAYERS ENTER THROUGH THE FRONT DOOR. YOU DIDN'T.",
    support: [
      "Most players enter Canton Quests through the front door. You didn't.",
      'Graves. Symbols. Forgotten names. Architectural dates. Multi-step cipher locks hiding in plain sight.',
      'Canton Quests turns those hidden details into real missions. One of them begins with the Founder Cipher.',
    ],
    cta: 'ENTER THE QUEST',
    heroImage: cqImages.mckinleySunset,
    heroImageAlt: 'Dark Canton monument scene at sunset',
    proofPoints: ['UNLISTED CIPHERS', 'LOCAL MYSTERY', 'REAL-WORLD NODES', 'NO SPOILERS'],
    teaserCards: [
      { title: "THE FOUNDER'S THREE LOCKS", copy: 'A 3-step sequential cipher chain hidden across downtown.' },
      { title: "FRANKENSTEIN'S QUIET SIGNAL", copy: 'A respectful daytime historical node at West Lawn Cemetery.' },
      { title: 'THE COURIER ROAMING SIGNAL', copy: 'A roaming NPC agent spotted near the Arts Corridor.' },
    ],
    challengeLine: 'Mystery never overrides safety: strictly daylight, public sidewalks, and zero trespassing.',
    sections: [
      {
        eyebrow: 'Unwritten Directives',
        title: 'Look up, not down.',
        body: 'The answers are etched into physical stone, brass entryways, and public brickwork across Canton. Pay attention to what others walk past.',
      },
      {
        eyebrow: 'Respect The Site',
        title: 'Mystery does not override safety.',
        body: 'All secret missions operate from safe public access points during posted hours. Private areas, night climbs, and property interference are strictly prohibited.',
      },
    ],
  },
};
