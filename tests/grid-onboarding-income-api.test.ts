import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const feed = read('app/api/grid/onboarding/income/route.ts');
const collect = read('app/api/grid/onboarding/income/collect/route.ts');
const service = read('lib/grid/server/onboarding-income-service.ts');

describe('Grid onboarding first-income API contract', () => {
  it('keeps the income preview authenticated, read-only, and world-read gated', () => {
    expect(feed).toContain('export async function GET');
    expect(feed).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    expect(feed).toContain('resolveAuthenticatedSession');
    expect(feed).toContain('isGridWorldReadEnabled()');
    expect(feed).toContain('session.player.id');
  });

  it('guards collection behind onboarding writes and authenticated identity', () => {
    expect(collect).toContain('export async function POST');
    expect(collect).toContain('isGridOnboardingWriteEnabled()');
    expect(collect).toContain('resolveAuthenticatedSession');
    expect(collect).toContain('Authentication required.');
  });
  it('accepts only an idempotency key from the browser', () => {
    expect(collect).toContain('body.idempotencyKey');
    expect(collect).not.toContain('body.playerId');
    expect(collect).not.toContain('body.seasonId');
    expect(collect).not.toContain('body.credits');
    expect(collect).not.toContain('body.influence');
    expect(collect).toContain('playerId: session.player.id');
    expect(collect).toContain('now: new Date().toISOString()');
  });

  it('uses deterministic preview math before the existing atomic settlement service', () => {
    expect(service).toContain('settleGridResources({');
    expect(service).toContain('resolveTerritoryIncomeRate');
    expect(service).toContain('resolvePropertyIncomeRate');
    expect(service).toContain('getDevelopmentBonusesThroughLevel');
    expect(service).toContain('settleGridPlayerResources(economyPort');
    expect(service).toContain("preview.state !== 'collectible'");
  });

  it('does not expose raw event or player authority in the collection result', () => {
    expect(service).not.toContain('eventId: result.eventId');
    expect(service).not.toContain('playerId: result.playerId');
    expect(service).not.toContain('seasonId: result.seasonId');
  });
});
