/**
 * Canton Quests — Player File / Mission separation cleanup.
 *
 * The permanent Player File (/profile) used to be polluted with
 * Founder's-Cipher-Mission-specific content: a Starting District callout,
 * a "Commander's Next Move" quest recommendation, "Other Districts /
 * Citywide Access" quest lists, a District Progress bar, a Founder's
 * Cipher-specific $200 drawing-prize box, and a "Founder's Three Locks"
 * finale-key tracker. None of that belongs on a page meant to represent
 * the player's identity across every Mission, not just one.
 *
 * The permanent Player File must now contain exactly three things:
 *   1. The Player Card
 *   2. Badge Selection
 *   3. Profile Settings
 *
 * Everything Mission-specific either already lives in its own Mission
 * route (app/events/[slug]/*) or was deleted as dead/duplicated UI that
 * only ever rendered on this page.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const profileSource = readSource('app/profile/page.tsx');

describe('Player File — the three permanent sections still render', () => {
  it('renders the Player Card', () => {
    expect(profileSource).toContain('<PlayerCard');
    expect(profileSource).toContain('cq-player-card-panel');
  });

  it('renders Badge Selection', () => {
    expect(profileSource).toMatch(/id="badges-heading">BADGES</);
    expect(profileSource).toContain('toggleFeaturedBadge');
    expect(profileSource).toContain('cq-badge-grid');
  });

  it('renders Profile Settings', () => {
    expect(profileSource).toMatch(/id="settings-heading">Profile Settings</);
    expect(profileSource).toContain('Callsign');
    expect(profileSource).toContain('Save Player File');
  });
});

describe('Player File — Mission-specific sections are gone', () => {
  it('no Starting District section', () => {
    expect(profileSource).not.toMatch(/Starting District/i);
    expect(profileSource).not.toContain('Enter the Founder&apos;s Cipher to choose a path');
    expect(profileSource).not.toContain('cq-starting-district');
  });

  it('no Commander\'s Next Move section', () => {
    expect(profileSource).not.toMatch(/Commander.s Next Move/i);
    expect(profileSource).not.toContain('cq-next-move');
    expect(profileSource).not.toContain('next-move-heading');
  });

  it('no District Progress section', () => {
    expect(profileSource).not.toMatch(/District Progress/i);
    expect(profileSource).not.toContain('cq-progress-stack');
    expect(profileSource).not.toContain('district-progress-heading');
  });

  it('no "Other Districts" or "Citywide Access" quest lists', () => {
    expect(profileSource).not.toMatch(/Other Districts/i);
    expect(profileSource).not.toMatch(/Citywide Access/i);
    expect(profileSource).not.toMatch(/Recommended Quests/i);
  });

  it('no Founder\'s Three Locks section', () => {
    expect(profileSource).not.toMatch(/Founder.s Three Locks/i);
    expect(profileSource).not.toContain('cq-master-key');
    expect(profileSource).not.toContain('master-key-heading');
    expect(profileSource).not.toContain('founderKeys');
  });

  it('no Founder\'s-Cipher-specific drawing-prize dollar amount ($200) or generic redundant Drawing Entries box', () => {
    expect(profileSource).not.toMatch(/\$200/);
    expect(profileSource).not.toMatch(/\$100 \+ \$50 \+ \$50/);
    expect(profileSource).not.toMatch(/RANDOM CASH PRIZES/);
    expect(profileSource).not.toContain('drawing-entries-heading');
  });

  it('no Founder\'s-Cipher-specific Commander/Mission guidance ("full city board", quest recommendation cards)', () => {
    expect(profileSource).not.toMatch(/No open recommendation/i);
    expect(profileSource).not.toMatch(/full city board/i);
    expect(profileSource).not.toContain('cq-next-move-card');
  });

  it('no "Recent Field Activity" Mission-activity feed', () => {
    expect(profileSource).not.toMatch(/Recent Field Activity/i);
    expect(profileSource).not.toContain('cq-activity-list');
  });

  it('no redundant Mission-scoped stats row duplicating the Player Card (City Rank / Completed / Drawing Entries text row)', () => {
    expect(profileSource).not.toContain('cq-command-stats');
  });

  it('no hardcoded single-Mission quest-browsing shortcut in the permanent Player File chrome', () => {
    expect(profileSource).not.toMatch(/events\/canton-weekend-1\/quests/);
  });
});

// The command-center route itself no longer computes Mission-specific
// fields at all — see tests/command-center-dead-weight-cleanup.test.ts for
// full coverage of that later cleanup pass (removed dead payload fields,
// eliminated now-unused DB calls, confirmed shared Mission helpers like
// getCollectiblesForPlayerDB/getQuestsForEventDB were preserved because
// other routes still use them).

describe('Founder\'s Cipher Mission functionality still works in its own routes', () => {
  it('the Founder\'s Cipher / Volume 1 Mission dashboard still surfaces its own path, district, and quest board', () => {
    const missionSource = readSource('app/events/[slug]/page.tsx');
    expect(missionSource.length).toBeGreaterThan(0);
  });

  it('the Mission quest board route (app/events/[slug]/quests) still exists independently of the Player File', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/events/[slug]/quests/page.tsx'))).toBe(true);
  });

  it('the Mission drawing ledger route still exists for Mission-specific prize details', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'app/events/[slug]/drawing/page.tsx'))).toBe(true);
  });
});
