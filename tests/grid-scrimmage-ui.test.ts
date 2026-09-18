import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSource = fs.readFileSync(
  path.join(process.cwd(), 'app/grid/scrimmage/page.tsx'),
  'utf8',
);
const clientSource = fs.readFileSync(
  path.join(process.cwd(), 'app/grid/scrimmage/scrimmage-client.tsx'),
  'utf8',
);
const readRouteSource = fs.readFileSync(
  path.join(
    process.cwd(),
    'app/api/grid/scrimmages/[sessionId]/route.ts',
  ),
  'utf8',
);
const joinRouteSource = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/scrimmages/join/route.ts'),
  'utf8',
);

describe('GRID player Scrimmage UI', () => {
  it('keeps the private play surface hidden until Scrimmage is enabled', () => {
    expect(pageSource).toContain('isGridScrimmageEnabled()');
    expect(pageSource).toContain('notFound()');
    expect(pageSource).toContain("dynamic = 'force-dynamic'");
  });

  it('supports the complete private-session lifecycle from the browser', () => {
    expect(clientSource).toContain("requestScrimmage('/api/grid/scrimmages'");
    expect(clientSource).toContain(
      "requestScrimmage('/api/grid/scrimmages/join'",
    );
    expect(clientSource).toContain(
      'new URLSearchParams(window.location.search)',
    );
    for (const command of [
      "'ready'",
      "'start'",
      "'duel'",
      "'complete'",
      "'cancel'",
      '/leave',
    ]) {
      expect(clientSource).toContain(command);
    }
  });

  it('submits only the chosen opponent for a duel and never rolls dice in the browser', () => {
    expect(clientSource).toMatch(
      /runMutation\(\s*'duel',\s*\{\s*defenderPlayerId: combatant\.playerId,\s*\}/s,
    );
    expect(clientSource).not.toContain('Math.random');
    expect(clientSource).not.toContain('randomInt(');
  });

  it('makes the session-only safety boundary explicit in the player experience', () => {
    expect(clientSource).toContain('SESSION-ONLY');
    expect(clientSource).toContain(
      'No Credits · No city XP · No territory changes',
    );
    expect(clientSource).toContain('SESSION-LOCAL COMBAT STATE');
    expect(clientSource).not.toMatch(
      /\/api\/grid\/(?:economy|progression|territor(?:y|ies)|properties)/,
    );
  });

  it('returns viewer identity only to authenticated participants so the UI can mark YOU without guessing', () => {
    for (const source of [readRouteSource, joinRouteSource]) {
      expect(source).toContain('playerId: session.player.id');
      expect(source).toContain('role:');
      expect(source).toContain(
        'scrimmage.hostPlayerId === session.player.id',
      );
    }
    expect(clientSource).toContain('viewer?.playerId === playerId');
  });

  it('announces the final surviving combatant instead of leaving the result implicit', () => {
    expect(clientSource).toContain('scrimmage.match.winnerPlayerId');
    expect(clientSource).toContain('LAST PLAYER STANDING');
  });

  it('renders a readable round log from the persisted session history', () => {
    expect(clientSource).toContain('ROUND LOG');
    expect(clientSource).toContain('scrimmage.match.roundHistory');
    expect(clientSource).toContain('.slice(-6)');
  });

  it('shows the winner on the completed-session screen after automatic finalization', () => {
    expect(clientSource).toContain('SCRIMMAGE WINNER');
    expect(clientSource).toContain('scrimmage.match?.winnerPlayerId');
  });

  it('uses private aliases instead of rendering raw database ids as names', () => {
    expect(clientSource).toContain("return 'YOU'");
    expect(clientSource).toContain("return 'HOST'");
    expect(clientSource).toContain('PLAYER');
    expect(clientSource).not.toContain('>{participant.playerId}<');
  });
});
