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
      winnerPlayerId: null,
      roundHistory: [],
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
        now: NOW,
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
    expect(after.match?.roundHistory).toEqual([after.match?.lastRound]);
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

  it('keeps an ordered immutable round history across multiple duels', () => {
    const before = activeScrimmage();
    const first = resolveGridScrimmageDuel(
      before,
      {
        attackerPlayerId: 'alpha',
        defenderPlayerId: 'bravo',
        attackerRolls: [6, 6, 6],
        defenderRolls: [1, 1],
        now: NOW,
      },
      cantonFoundingSeasonContest,
    );
    const second = resolveGridScrimmageDuel(
      first,
      {
        attackerPlayerId: 'bravo',
        defenderPlayerId: 'alpha',
        attackerRolls: [6, 6, 6],
        defenderRolls: [1, 1],
        now: NOW,
      },
      cantonFoundingSeasonContest,
    );

    expect(before.match?.roundHistory).toEqual([]);
    expect(first.match?.roundHistory).toHaveLength(1);
    expect(second.match?.roundHistory).toHaveLength(2);
    expect(second.match?.roundHistory.map((round) => round.roundNumber)).toEqual([
      1,
      2,
    ]);
    expect(first.match?.roundHistory).toHaveLength(1);
  });

  it('records split comparisons as a draw for both combatants', () => {
    const after = resolveGridScrimmageDuel(
      activeScrimmage(),
      {
        attackerPlayerId: 'alpha',
        defenderPlayerId: 'bravo',
        attackerRolls: [6, 1, 1],
        defenderRolls: [5, 2],
        now: NOW,
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
        now: NOW,
      },
      cantonFoundingSeasonContest,
    );

    expect(eliminated.match?.combatants[1]).toMatchObject({
      remainingInfluence: 0,
      eliminated: true,
    });
    expect(eliminated.match?.winnerPlayerId).toBe('alpha');
    expect(eliminated.status).toBe('completed');
    expect(eliminated.endedAt).toBe(NOW);

    expect(() =>
      resolveGridScrimmageDuel(
        eliminated,
        {
          attackerPlayerId: 'alpha',
          defenderPlayerId: 'bravo',
          attackerRolls: [6, 6, 6],
          defenderRolls: [],
          now: NOW,
        },
        cantonFoundingSeasonContest,
      ),
    ).toThrow('Grid scrimmage duel requires an active match');
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
          now: NOW,
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
          now: NOW,
        },
        cantonFoundingSeasonContest,
      ),
    ).toThrow('requires two session participants');
  });
});
