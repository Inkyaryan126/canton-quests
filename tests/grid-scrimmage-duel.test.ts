import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonContest } from '../lib/grid/cities/canton/founding-season-contest';
import {
  createGridScrimmage,
  joinGridScrimmage,
  resolveGridScrimmageDuel,
  setGridScrimmageReady,
  startGridScrimmage,
} from '../lib/grid/core/scrimmage';

const NOW = '2026-09-16T18:00:00.000Z';

function activeScrimmage() {
  let state = createGridScrimmage({
    sessionId: 'scrim-duel',
    cityId: 'canton-oh',
    hostPlayerId: 'alpha',
    inviteCode: 'DUEL-1',
    rules: {
      minPlayers: 2,
      maxPlayers: 4,
      requireAllReady: true,
    },
    now: NOW,
  });
  state = joinGridScrimmage(state, {
    playerId: 'bravo',
    inviteCode: 'DUEL-1',
    now: NOW,
  });
  state = setGridScrimmageReady(state, {
    playerId: 'alpha',
    ready: true,
  });
  state = setGridScrimmageReady(state, {
    playerId: 'bravo',
    ready: true,
  });
  return startGridScrimmage(state, {
    playerId: 'alpha',
    now: NOW,
  });
}

describe('GRID scrimmage Signal Duel', () => {
  it('starts every player with isolated session-only Influence', () => {
    const state = activeScrimmage();

    expect(state.progressionScope).toBe('session-only');
    expect(state.match).toMatchObject({
      startingInfluencePerPlayer: 100,
      roundNumber: 0,
      lastRound: null,
    });
    expect(
      state.match?.combatants.map((combatant) => ({
        playerId: combatant.playerId,
        influence: combatant.remainingInfluence,
      })),
    ).toEqual([
      { playerId: 'alpha', influence: 100 },
      { playerId: 'bravo', influence: 100 },
    ]);
  });

  it('resolves Signal Dice damage without mutating the prior state', () => {
    const before = activeScrimmage();
    const after = resolveGridScrimmageDuel(
      before,
      {
        attackerPlayerId: 'alpha',
        defenderPlayerId: 'bravo',
        attackerRolls: [6, 6, 6],
        defenderRolls: [1, 1],
      },
      cantonFoundingSeasonContest,
    );

    expect(before.match?.roundNumber).toBe(0);
    expect(after.match?.roundNumber).toBe(1);
    expect(after.match?.lastRound).toMatchObject({
      winner: 'attacker',
      attackerInfluenceLost: 0,
      defenderInfluenceLost: 20,
    });
    expect(after.match?.combatants[0]).toMatchObject({
      remainingInfluence: 100,
      roundWins: 1,
      roundLosses: 0,
    });
    expect(after.match?.combatants[1]).toMatchObject({
      remainingInfluence: 80,
      roundWins: 0,
      roundLosses: 1,
    });
  });

  it('records split comparisons as a draw for both combatants', () => {
    const after = resolveGridScrimmageDuel(
      activeScrimmage(),
      {
        attackerPlayerId: 'alpha',
        defenderPlayerId: 'bravo',
        attackerRolls: [6, 1, 1],
        defenderRolls: [5, 2],
      },
      cantonFoundingSeasonContest,
    );

    expect(after.match?.lastRound?.winner).toBe('draw');
    expect(after.match?.combatants[0]).toMatchObject({
      remainingInfluence: 90,
      draws: 1,
    });
    expect(after.match?.combatants[1]).toMatchObject({
      remainingInfluence: 90,
      draws: 1,
    });
  });

  it('eliminates a combatant at zero session Influence', () => {
    const state = activeScrimmage();
    const weakened = {
      ...state,
      match: state.match
        ? {
            ...state.match,
            combatants: state.match.combatants.map((combatant) =>
              combatant.playerId === 'bravo'
                ? { ...combatant, remainingInfluence: 10 }
                : { ...combatant },
            ),
          }
        : null,
    };

    const eliminated = resolveGridScrimmageDuel(
      weakened,
      {
        attackerPlayerId: 'alpha',
        defenderPlayerId: 'bravo',
        attackerRolls: [6, 6, 6],
        defenderRolls: [1],
      },
      cantonFoundingSeasonContest,
    );

    expect(eliminated.match?.combatants[1]).toMatchObject({
      remainingInfluence: 0,
      eliminated: true,
    });

    expect(() =>
      resolveGridScrimmageDuel(
        eliminated,
        {
          attackerPlayerId: 'alpha',
          defenderPlayerId: 'bravo',
          attackerRolls: [6, 6, 6],
          defenderRolls: [],
        },
        cantonFoundingSeasonContest,
      ),
    ).toThrow('eliminated players cannot duel');
  });

  it('rejects self-duels and players outside the private session', () => {
    const state = activeScrimmage();

    expect(() =>
      resolveGridScrimmageDuel(
        state,
        {
          attackerPlayerId: 'alpha',
          defenderPlayerId: 'alpha',
          attackerRolls: [6],
          defenderRolls: [1],
        },
        cantonFoundingSeasonContest,
      ),
    ).toThrow('cannot duel themselves');

    expect(() =>
      resolveGridScrimmageDuel(
        state,
        {
          attackerPlayerId: 'alpha',
          defenderPlayerId: 'outsider',
          attackerRolls: [6],
          defenderRolls: [1],
        },
        cantonFoundingSeasonContest,
      ),
    ).toThrow('requires two session participants');
  });
});
