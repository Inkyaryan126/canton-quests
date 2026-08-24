/**
 * Canton Quests Volume 1 — Canonical Prize Configuration
 * September 11–14, 2026 Launch
 *
 * Single source of truth for prize amounts. Import here; do not hardcode elsewhere.
 */

export const VOL1_PRIZES = {
  leaderboard: {
    champion: { id: 'prz-leaderboard-champion', title: 'Leaderboard Champion', amount: 200 },
    runnerUp:  { id: 'prz-leaderboard-runner-up', title: 'Leaderboard Runner-Up', amount: 100 },
  },
  drawings: [
    { id: 'prz-drawing-100', title: '$100 Cash Drawing', amount: 100, drawOrder: 1 },
    { id: 'prz-drawing-50a', title: '$50 Cash Drawing',  amount: 50,  drawOrder: 2 },
    { id: 'prz-drawing-50b', title: '$50 Cash Drawing',  amount: 50,  drawOrder: 3 },
  ],
} as const;

export const TOTAL_DRAWING_PRIZE_POOL =
  VOL1_PRIZES.drawings.reduce((sum, p) => sum + p.amount, 0); // 200

export const TOTAL_LEADERBOARD_PRIZE_POOL =
  VOL1_PRIZES.leaderboard.champion.amount + VOL1_PRIZES.leaderboard.runnerUp.amount; // 300

export const TOTAL_PRIZE_POOL = TOTAL_DRAWING_PRIZE_POOL + TOTAL_LEADERBOARD_PRIZE_POOL; // 500

/** Human-readable drawing prize summary shown to players. */
export const DRAWING_PRIZE_SUMMARY = `$${VOL1_PRIZES.drawings[0].amount} + $${VOL1_PRIZES.drawings[1].amount} + $${VOL1_PRIZES.drawings[2].amount}`;
