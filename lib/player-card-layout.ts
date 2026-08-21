/**
 * Canonical Player Card Percentage Coordinate Map & Layout Calibration
 * 
 * Derived directly from pixel bounding boxes in:
 * public/canton-quests/player_card_guide.png (1024 x 1536 px, 2:3 aspect ratio).
 * 
 * Master artwork background:
 * public/canton-quests/player_card.png (1024 x 1536 px).
 */

export interface CardFieldPosition {
  readonly left: string;
  readonly top: string;
  readonly width: string;
  readonly height: string;
}

export const PLAYER_CARD_LAYOUT = {
  dimensions: {
    naturalWidth: 1024,
    naturalHeight: 1536,
    aspectRatio: '2 / 3',
  },
  headerPlayerId: {
    left: '72.07%',
    top: '4.43%',
    width: '24.22%',
    height: '5.21%',
  },
  avatar: {
    left: '3.61%',
    top: '12.24%',
    width: '36.23%',
    height: '24.48%',
  },
  callsign: {
    left: '42.97%',
    top: '14.91%',
    width: '53.32%',
    height: '8.59%',
  },
  path: {
    left: '51.17%',
    top: '26.95%',
    width: '45.02%',
    height: '5.27%',
  },
  district: {
    left: '51.27%',
    top: '34.51%',
    width: '44.92%',
    height: '5.14%',
  },
  signal: {
    left: '52.93%',
    top: '43.62%',
    width: '30.86%',
    height: '5.53%',
  },
  totalXp: {
    left: '12.21%',
    top: '52.28%',
    width: '14.36%',
    height: '4.04%',
  },
  questsComplete: {
    left: '34.67%',
    top: '52.28%',
    width: '14.45%',
    height: '4.10%',
  },
  prizeEntries: {
    left: '58.20%',
    top: '52.28%',
    width: '14.55%',
    height: '4.10%',
  },
  cityRank: {
    left: '82.03%',
    top: '52.21%',
    width: '14.55%',
    height: '4.17%',
  },
  badges: [
    { left: '4.49%', top: '60.81%', width: '13.57%', height: '8.40%' },
    { left: '19.43%', top: '60.81%', width: '13.67%', height: '8.46%' },
    { left: '35.16%', top: '60.81%', width: '13.57%', height: '8.40%' },
    { left: '50.59%', top: '60.81%', width: '13.57%', height: '8.40%' },
    { left: '66.21%', top: '60.87%', width: '13.57%', height: '8.40%' },
    { left: '81.54%', top: '60.68%', width: '13.57%', height: '8.40%' },
  ] as const,
  memberSince: {
    left: '9.77%',
    top: '76.43%',
    width: '19.34%',
    height: '3.84%',
  },
  playerIdCode: {
    left: '9.77%',
    top: '82.23%',
    width: '19.43%',
    height: '3.97%',
  },
  clearanceLevel: {
    left: '9.67%',
    top: '88.02%',
    width: '19.53%',
    height: '3.97%',
  },
} as const;

/**
 * Returns dynamic CSS classes or inline style font-size adjustments
 * to guarantee that callsigns never wrap or collide with card borders.
 */
export function getCallsignFontScale(callsign: string): string {
  const len = (callsign || '').trim().length;
  if (len <= 8) return 'cq-callsign-lg';
  if (len <= 14) return 'cq-callsign-md';
  if (len <= 20) return 'cq-callsign-sm';
  return 'cq-callsign-xs';
}

/**
 * Returns dynamic CSS classes for starting district to fit long names cleanly.
 */
export function getDistrictFontScale(district: string): string {
  const len = (district || '').trim().length;
  if (len <= 15) return 'cq-district-lg';
  if (len <= 24) return 'cq-district-md';
  return 'cq-district-sm';
}
