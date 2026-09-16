import { randomInt } from 'node:crypto';
import type { GridSignalDiceRoller } from './contest-service';

export const cryptoSignalDiceRoller: GridSignalDiceRoller = {
  roll(dieSides: number): number {
    if (!Number.isInteger(dieSides) || dieSides < 2) {
      throw new Error('Signal Dice require at least two sides');
    }
    return randomInt(1, dieSides + 1);
  },
};
