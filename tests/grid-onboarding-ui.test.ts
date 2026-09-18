import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const page = fs.readFileSync(
  path.join(root, 'app/grid/onboarding/page.tsx'),
  'utf8',
);
const client = fs.readFileSync(
  path.join(root, 'app/grid/onboarding/grid-onboarding-client.tsx'),
  'utf8',
);
const publicGrid = fs.readFileSync(
  path.join(root, 'app/grid/page.tsx'),
  'utf8',
);

describe('Grid onboarding player UI contract', () => {
  it('keeps the staged onboarding route no-index and off the public Grid page', () => {
    expect(page).toContain('index: false');
    expect(page).toContain('follow: false');
    expect(publicGrid).not.toContain('href="/grid/onboarding"');
  });

  it('reads onboarding progress and starter availability from existing APIs', () => {
    expect(client).toContain("fetch('/api/grid/onboarding/status'");
    expect(client).toContain(
      "fetch('/api/grid/onboarding/starter-territories'",
    );
    expect(client).toContain("cache: 'no-store'");
  });

  it('uses only the guarded onboarding write endpoints', () => {
    expect(client).toContain("'/api/grid/onboarding/home-city'");
    expect(client).toContain("'/api/grid/onboarding/join'");
    expect(client).toContain(
      "'/api/grid/onboarding/starter-territories/claim'",
    );
    expect(client).not.toContain('/api/grid/contests');
    expect(client).not.toContain('/api/grid/properties');
  });

  it('never sends player, city, season, cost, or ownership authority from the browser', () => {
    expect(client).not.toContain('playerId:');
    expect(client).not.toContain('cityId:');
    expect(client).not.toContain('seasonId:');
    expect(client).not.toContain('creditsSpent:');
    expect(client).not.toContain('ownerPlayerId:');
  });

  it('keeps join and starter claims retry-safe within the browser session', () => {
    expect(client).toContain('window.sessionStorage.getItem');
    expect(client).toContain('window.sessionStorage.setItem');
    expect(client).toContain('window.sessionStorage.removeItem');
    expect(client).toContain('window.crypto.randomUUID()');
    expect(client).toContain('idempotencyKey: commandKey(scope)');
  });

  it('handles unauthenticated and staged-write states explicitly', () => {
    expect(client).toContain("statusResponse.status === 401");
    expect(client).toContain('href="/login"');
    expect(client).toContain('response.status === 404');
    expect(client).toContain(
      'This onboarding step is staged but not open yet.',
    );
  });

  it('shows exact starter resource requirements and disables unaffordable claims', () => {
    expect(client).toContain('{territory.cost.credits} CR');
    expect(client).toContain('{territory.cost.commandPoints} CP');
    expect(client).toContain('!territory.affordable');
    expect(client).toContain("'Resources required'");
  });

  it('renders the complete nine-step projection rather than hard-coding progress', () => {
    expect(client).toContain('onboarding.steps.map');
    expect(client).toContain('onboarding.completedCount');
    expect(client).toContain('onboarding.totalSteps');
    expect(client).toContain('onboarding?.nextStep');
  });

  it('hands authenticated players into the private City Board without exposing it publicly', () => {
    expect(client).toContain('href="/grid/preview"');
    expect(client).toContain('Open City Board');
    expect(client).toContain('View your City Board');
    expect(publicGrid).not.toContain('href="/grid/preview"');
  });
});
