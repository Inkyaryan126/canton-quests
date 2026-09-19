import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
const sourcePath = path.join(process.cwd(), 'app/api/grid/alliances/[allianceId]/disband/route.ts');
const source = fs.existsSync(sourcePath) ? fs.readFileSync(sourcePath, 'utf8') : '';

describe('GRID Alliance disband API', () => {
  it('is authenticated, feature-gated, and derives leader identity and season server-side', () => {
    expect(source).toContain('isGridAllianceEnabled()');
    expect(source).toContain('resolveAuthenticatedSession(request)');
    expect(source).toContain('Authentication required.');
    expect(source).toContain('resolveGridAllianceSeason');
    expect(source).toContain('playerId: session.player.id');
    expect(source).not.toMatch(/body\.(playerId|seasonId|allianceId|cooldownUntil|influencePool)/);
  });
  it('requires an idempotency key and invokes the disband service', () => {
    expect(source).toContain('idempotencyKey');
    expect(source).toContain('disbandGridAlliance');
  });
});
