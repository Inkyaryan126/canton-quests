import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isGridScrimmageEnabled } from '../lib/grid/server/scrimmage-feature-flags';

const route = (...parts: string[]) =>
  fs.readFileSync(
    path.join(process.cwd(), 'app/api/grid/scrimmages', ...parts),
    'utf8',
  );

const createRoute = route('route.ts');
const joinRoute = route('join', 'route.ts');
const readRoute = route('[sessionId]', 'route.ts');
const readyRoute = route('[sessionId]', 'ready', 'route.ts');
const startRoute = route('[sessionId]', 'start', 'route.ts');
const rematchRoute = route('[sessionId]', 'rematch', 'route.ts');
const duelRoute = route('[sessionId]', 'duel', 'route.ts');
const leaveRoute = route('[sessionId]', 'leave', 'route.ts');
const cancelRoute = route('[sessionId]', 'cancel', 'route.ts');
const completeRoute = route('[sessionId]', 'complete', 'route.ts');

const writeRoutes = [
  createRoute,
  joinRoute,
  readyRoute,
  startRoute,
  rematchRoute,
  duelRoute,
  leaveRoute,
  cancelRoute,
  completeRoute,
];

describe('GRID scrimmage API contract', () => {
  it('requires both foundation and dedicated scrimmage flags', () => {
    expect(
      isGridScrimmageEnabled({
        GRID_FOUNDATION_ENABLED: '1',
        GRID_SCRIMMAGE_ENABLED: '1',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      isGridScrimmageEnabled({
        GRID_FOUNDATION_ENABLED: '1',
        GRID_SCRIMMAGE_ENABLED: '0',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isGridScrimmageEnabled({
        GRID_FOUNDATION_ENABLED: '0',
        GRID_SCRIMMAGE_ENABLED: '1',
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('keeps every route behind the scrimmage feature gate', () => {
    for (const source of [readRoute, ...writeRoutes]) {
      expect(source).toContain('isGridScrimmageEnabled()');
    }
  });

  it('requires an authenticated player for every route', () => {
    for (const source of [readRoute, ...writeRoutes]) {
      expect(source).toContain('Authentication required.');
      expect(source).toContain('session.player');
    }
  });

  it('derives host and member identity from the authenticated session', () => {
    expect(createRoute).toContain('hostPlayerId: session.player.id');
    expect(joinRoute).toContain('playerId: session.player.id');
    expect(readyRoute).toContain('playerId: session.player.id');
    expect(startRoute).toContain('playerId: session.player.id');
    expect(rematchRoute).toContain('playerId: session.player.id');
    expect(duelRoute).toContain('attackerPlayerId: session.player.id');
    expect(leaveRoute).toContain('playerId: session.player.id');
    expect(cancelRoute).toContain('playerId: session.player.id');
    expect(completeRoute).toContain('playerId: session.player.id');

    for (const source of writeRoutes) {
      expect(source).not.toMatch(/body\.playerId|body\.hostPlayerId/);
    }
  });

  it('generates sensitive session identity and command time server-side', () => {
    expect(createRoute).toContain('sessionId: randomUUID()');
    expect(createRoute).toContain('inviteCode: createInviteCode()');
    expect(createRoute).not.toMatch(/body\.sessionId|body\.inviteCode/);

    for (const source of [
      createRoute,
      joinRoute,
      startRoute,
      duelRoute,
      cancelRoute,
      completeRoute,
    ]) {
      expect(source).toContain('new Date().toISOString()');
      expect(source).not.toMatch(/body\.now/);
    }
  });

  it('keeps Signal Dice authoritative instead of accepting client rolls or Influence', () => {
    expect(duelRoute).toContain('randomInt(1, dieSides + 1)');
    expect(duelRoute).toContain('cantonFoundingSeasonContest');
    expect(duelRoute).toContain(
      'resolveGridScrimmageDuelSession',
    );
    expect(duelRoute).not.toMatch(
      /body\.(attackerRolls|defenderRolls|attackerCommittedInfluence|defenderCommittedInfluence)/,
    );
  });

  it('does not expose a scrimmage read to a non-participant', () => {
    expect(readRoute).toContain(
      'getGridScrimmageSessionForPlayer',
    );
    expect(readRoute).toContain('session.player.id');
    expect(readRoute).toContain(
      'Grid scrimmage session was not found.',
    );
  });

  it('exposes the complete private-lobby lifecycle', () => {
    expect(createRoute).toContain('createGridScrimmageSession');
    expect(joinRoute).toContain('joinGridScrimmageSession');
    expect(readyRoute).toContain('setGridScrimmageSessionReady');
    expect(startRoute).toContain('startGridScrimmageSession');
    expect(rematchRoute).toContain('resetGridScrimmageSessionForRematch');
    expect(duelRoute).toContain('resolveGridScrimmageDuelSession');
    expect(leaveRoute).toContain('leaveGridScrimmageSession');
    expect(cancelRoute).toContain('cancelGridScrimmageSession');
    expect(completeRoute).toContain('completeGridScrimmageSession');
  });
});
