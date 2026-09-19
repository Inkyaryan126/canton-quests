import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, 'app/grid/return/page.tsx'),
  'utf8',
);
const client = fs.readFileSync(
  path.join(root, 'app/grid/return/grid-return-client.tsx'),
  'utf8',
);
const publicGrid = fs.readFileSync(
  path.join(root, 'app/grid/page.tsx'),
  'utf8',
);

describe('Grid return briefing player UI contract', () => {
  it('keeps the private return route no-index and off the public Grid page', () => {
    expect(page).toContain('index: false');
    expect(page).toContain('follow: false');
    expect(publicGrid).not.toContain('href="/grid/return"');
  });

  it('reads only the sanitized return-summary endpoint', () => {
    expect(client).toContain("fetch('/api/grid/return-summary'");
    expect(client).toContain("cache: 'no-store'");
    expect(client).not.toContain("method: 'POST'");
    expect(client).not.toContain("method: 'PUT'");
    expect(client).not.toContain("method: 'PATCH'");
    expect(client).not.toContain("method: 'DELETE'");
  });

  it('handles authentication, staged runtime, and no-history states explicitly', () => {
    expect(client).toContain('response.status === 401');
    expect(client).toContain('response.status === 404');
    expect(client).toContain('href="/login"');
    expect(client).toContain('href="/grid/onboarding"');
    expect(client).toContain('No city history yet');
    expect(client).toContain('Return signal staged');
  });

  it('renders exact pending resource projections from the server summary', () => {
    expect(client).toContain('summary.pendingResources.creditsProduced');
    expect(client).toContain('summary.pendingResources.influenceGenerated');
    expect(client).toContain('summary.pendingResources.commandPointsRestored');
    expect(client).toContain('summary.pendingResources.projectedCredits');
    expect(client).toContain('summary.pendingResources.projectedInfluence');
    expect(client).toContain('summary.pendingResources.projectedCommandPoints');
    expect(client).toContain('summary.pendingResources.offlineAccrualCapped');
  });

  it('renders city activity, player activity, and sanitized highlights', () => {
    expect(client).toContain('summary.cityActivity.territoryClaims');
    expect(client).toContain('summary.cityActivity.territoryCaptures');
    expect(client).toContain('summary.yourActivity.contestsWon');
    expect(client).toContain('summary.yourActivity.contestsLost');
    expect(client).toContain('summary.highlights.map');
    expect(client).toContain('highlight.message');
    expect(client).toContain('highlight.kind');
  });

  it('does not ask the browser to handle raw player or event identities', () => {
    expect(client).not.toContain('playerId');
    expect(client).not.toContain('actorPlayerId');
    expect(client).not.toContain('defenderPlayerId');
    expect(client).not.toContain('attackerPlayerId');
    expect(client).not.toContain('event.payload');
  });

  it('re-enters the private City Board after the recap without exposing it publicly', () => {
    expect(client).toContain('href="/grid/preview"');
    expect(client).toContain('Open City Board');
    expect(publicGrid).not.toContain('href="/grid/preview"');
  });

  it('makes the existing City Board destination the explicit next action', () => {
    expect(client).toContain('NEXT ACTION');
    expect(client).toContain('Open City Board');
    expect(client).toContain('Use the City Board to continue with your projected wallet and');
    expect(client).toContain('Command Points.');
  });

  it('surfaces the private Strongholds battle screen from the authenticated return tools only', () => {
    expect(client).toContain('href="/grid/strongholds"');
    expect(client).toContain('STRONGHOLDS');
    expect(client).toContain('cq-grid-return-strongholds-link');
    expect(publicGrid).not.toContain('href="/grid/strongholds"');
  });

  it('surfaces offline defense doctrine from authenticated return tools only', () => {
    expect(client).toContain('href="/grid/defense"');
    expect(client).toContain('DEFENSE');
    expect(publicGrid).not.toContain('href="/grid/defense"');
  });

  it('surfaces Dominance Heat from authenticated return tools only', () => {
    expect(client).toContain('href="/grid/heat"');
    expect(client).toContain('HEAT');
    expect(publicGrid).not.toContain('href="/grid/heat"');
  });

  it('surfaces Alliance controls from authenticated return tools only', () => {
    expect(client).toContain('href="/grid/alliances"');
    expect(client).toContain('ALLIANCES');
    expect(publicGrid).not.toContain('href="/grid/alliances"');
  });
});
