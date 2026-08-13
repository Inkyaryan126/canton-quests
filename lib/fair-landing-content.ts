import { cqImages } from './marketing-assets';

export const FAIR_ENTRY_HREF = '/quests';

export const FAIR_LANDING_DESTINATION_PRESETS = [
  { label: 'Family', path: '/start/family' },
  { label: 'Challenge', path: '/start/challenge' },
  { label: 'Secret', path: '/start/secret' },
] as const;

export type FairLandingSlug = 'family' | 'challenge' | 'secret';

export interface FairLandingContent {
  slug: FairLandingSlug;
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

export const fairLandingPages: Record<FairLandingSlug, FairLandingContent> = {
  family: {
    slug: 'family',
    title: 'Family Canton Adventure | Canton Quests',
    description: 'Get the family into a real Canton adventure with no app download, local missions, XP, and prize drawing entries.',
    ogTitle: 'Canton Quests Family Adventure',
    ogDescription: 'A low-friction Canton mission built for families who want a real local adventure together.',
    theme: 'family',
    eyebrow: 'Family Adventure',
    headline: 'YOUR KIDS THINK THEY KNOW CANTON. PROVE IT.',
    support: [
      'GET THEM OFF THE COUCH. INTO THE STORY.',
      "Canton is hiding missions, secrets, strange landmarks and challenges in plain sight.",
      "Grab your family. Pick a quest. Go find out what you've been walking past your whole life.",
    ],
    cta: 'UNLOCK MY FIRST MISSION',
    heroImage: cqImages.heroCity,
    heroImageAlt: 'People exploring Canton at sunset',
    proofPoints: ['NO APP DOWNLOAD', 'PLAY TOGETHER', 'REAL CANTON LOCATIONS', 'XP + PRIZE DRAWING ENTRIES'],
    objection: {
      title: "You don't need to spend the entire weekend playing.",
      body: 'Do one mission after the fair, make it a short family detour, or chase the larger mystery when everyone wants more.',
    },
    sections: [
      {
        eyebrow: 'Low Friction',
        title: 'One mission is enough to start.',
        body: 'Scan, choose a mission, head to a real Canton location, and submit proof when your crew finds the signal.',
      },
      {
        eyebrow: 'Shared Win',
        title: 'Everyone gets a role.',
        body: 'Readers, clue spotters, photo takers, navigators, and bold guessers all matter once Canton becomes the board.',
      },
    ],
  },
  challenge: {
    slug: 'challenge',
    title: 'Canton Challenge Game | Canton Quests',
    description: 'Enter a competitive real-world Canton game with quests, XP, drawing entries, and public leaderboard pressure.',
    ogTitle: 'Most People Will Quit',
    ogDescription: 'A competitive Canton Quests landing page for crews ready to earn XP and climb the board.',
    theme: 'challenge',
    eyebrow: 'Crew Challenge',
    headline: 'MOST PEOPLE WILL QUIT.',
    secondaryHeadline: 'YOU THINK YOUR CREW CAN BEAT CANTON?',
    support: [
      "CANTON IS THE BOARD. YOU'RE THE PLAYER.",
      'Hidden codes. Real locations. Timed drops. GPS missions. Strange clues. Public leaderboards.',
      'Some people will play one quest. Some will start looking at the entire city differently. Which one are you?',
    ],
    cta: 'ENTER THE GAME',
    heroImage: cqImages.mapHud,
    heroImageAlt: 'Canton Quests game map interface',
    proofPoints: ['HIDDEN CODES', 'GPS MISSIONS', 'TIMED DROPS', 'PUBLIC LEADERBOARDS'],
    flow: ['COMPLETE QUESTS', 'EARN XP', 'EARN DRAWING ENTRIES', 'CLIMB THE BOARD'],
    challengeLine: 'You can close this page. Somebody else will take your spot.',
    sections: [
      {
        eyebrow: 'Score Route',
        title: 'Every verified mission moves you.',
        body: 'Quest completions feed the same XP, reward, and leaderboard systems as the main Canton Quests game.',
      },
      {
        eyebrow: 'Crew Pride',
        title: 'Bring people who notice details.',
        body: 'The strongest teams split roles fast: navigator, code reader, photographer, puzzle brain, and closer.',
      },
    ],
  },
  secret: {
    slug: 'secret',
    title: 'Hidden Canton Mystery | Canton Quests',
    description: 'Find strange Canton stories, local mystery missions, and the first door into Canton Quests.',
    ogTitle: 'You Found the Door',
    ogDescription: 'Canton Quests turns hidden local stories and strange public details into real-world missions.',
    theme: 'secret',
    eyebrow: "There's a Frankenstein grave in Canton. That's not even the weird part.",
    headline: 'YOU FOUND THE DOOR.',
    support: [
      "Most people in Canton drive past stories every day without realizing they're there.",
      'Graves. Symbols. Forgotten names. Strange monuments. Codes hiding in ordinary places.',
      'Canton Quests turns those places into missions. One of them begins with Frankenstein.',
    ],
    cta: 'SHOW ME THE FIRST QUEST',
    heroImage: cqImages.mckinleySunset,
    heroImageAlt: 'A dark Canton monument scene at sunset',
    proofPoints: ['LOCAL MYSTERY', 'STRANGE HISTORY', 'REAL MISSIONS', 'NO SECRET SPOILERS'],
    teaserCards: [
      { title: "FRANKENSTEIN'S QUIET SIGNAL", copy: 'Something unusual waits at West Lawn.' },
      { title: "THE FOUNDER'S CIPHER", copy: 'A city leaves fingerprints.' },
      { title: '[CLASSIFIED]', copy: 'Complete the right mission to reveal this one.' },
    ],
    sections: [
      {
        eyebrow: 'Not A Tour',
        title: "You're given the mission.",
        body: "What happens next depends on whether you're paying attention.",
      },
      {
        eyebrow: 'Respect The Site',
        title: 'Mystery does not override safety.',
        body: 'Canton Quests keeps sensitive proof values and Game Master notes out of public pages and uses the existing safe quest handling.',
      },
    ],
  },
};
