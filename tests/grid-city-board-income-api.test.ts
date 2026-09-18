import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), 'utf8');

const route = read('app/api/grid/income/collect/route.ts');
const adapter = read('lib/grid/server/supabase-income-action.ts');
const service = read('lib/grid/server/income-action-service.ts');
const client = read('app/grid/grid-world-client.tsx');
const worldRoute = read('app/api/grid/world/route.ts');
const worldAdapter = read('lib/grid/server/supabase-world-projection.ts');

describe('Grid City Board income API contract', () => {
  it('gates collection behind economy writes and authenticated identity', () => {
    expect(route).toContain('isGridEconomyWriteEnabled()');
    expect(route).toContain('resolveAuthenticatedSession');
    expect(route).toContain('Authentication required.');
  });

  it('accepts only idempotency from the browser', () => {
    expect(route).toContain('body.idempotencyKey');
    expect(route).not.toContain('body.playerId');
    expect(route).not.toContain('body.seasonId');
    expect(route).not.toContain('body.credits');
    expect(route).not.toContain('body.influence');
    expect(route).not.toContain('body.commandPoints');
    expect(route).toContain('playerId: session.player.id');
    expect(route).toContain('now: new Date().toISOString()');
  });

  it('uses a read-only season resolver and existing atomic settlement service', () => {
    expect(adapter).toContain(".from('grid_cities')");
    expect(adapter).toContain(".from('grid_seasons')");
    expect(adapter).not.toMatch(/\.(insert|update|delete|upsert|rpc)\s*\(/);
    expect(service).toContain('settleGridPlayerResources(economyPort');
  });

  it('projects real accrual remainders and renders live production/countdown', () => {
    expect(worldAdapter).toContain('credits_accrual_remainder');
    expect(worldAdapter).toContain('influence_accrual_remainder');
    expect(worldRoute).toContain('generatedAt: new Date().toISOString()');
    expect(client).toContain("fetch('/api/grid/income/collect'");
    expect(client).toContain('income.pendingCredits');
    expect(client).toContain('income.pendingInfluence');
    expect(client).toContain('income.creditsPerHour');
    expect(client).toContain('income.influencePerHour');
    expect(client).toContain('income.collectibleAt');
    expect(client).toContain('humanizeWait(incomeWaitMs)');
    expect(client).toContain('Collect production');
  });
});
