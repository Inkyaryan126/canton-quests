/**
 * Canton Quests — /api/player/command-center dead-weight cleanup.
 *
 * The Player File cleanup (tests/player-file-mission-separation.test.ts)
 * stopped app/profile/page.tsx from READING several Mission-specific
 * response fields, but the route itself kept COMPUTING them — extra
 * Supabase round-trips and payload bytes for data nothing renders. This
 * pass removed those fields from the response, eliminated the now-unused
 * DB calls that only fed them, and deleted the helper functions/CSS/
 * components that had zero remaining consumers anywhere in the repo —
 * while leaving shared Mission logic (still used by other routes) intact.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it, beforeEach } from 'vitest';
import { GET as commandCenterRoute } from '../app/api/player/command-center/route';
import { registerPlayer, resetGameEngineStore, initializeGameEngine } from '../lib/game-engine';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function authedRequest(url: string, userId: string): Request {
  return new Request(url, { headers: { Authorization: `Bearer mock-jwt-${userId}` } });
}

const routeSource = readSource('app/api/player/command-center/route.ts');

describe('Response shape — removed Mission-specific fields are gone', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('the live response no longer contains startingDistrict, quests, districtProgress, founderKeys, recentActivity, progress, or eventId', async () => {
    registerPlayer({ displayName: 'DeadWeightAgent', email: 'deadweight@example.com', userId: 'usr-dead-weight' });
    const res = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-dead-weight'));
    const payload = await res.json();

    expect(payload).not.toHaveProperty('startingDistrict');
    expect(payload).not.toHaveProperty('quests');
    expect(payload).not.toHaveProperty('districtProgress');
    expect(payload).not.toHaveProperty('founderKeys');
    expect(payload).not.toHaveProperty('recentActivity');
    expect(payload).not.toHaveProperty('progress');
    expect(payload).not.toHaveProperty('eventId');
    expect(payload.stats).not.toHaveProperty('badgesEarned');
    expect(payload.badges).not.toHaveProperty('earned');
  });

  it('the live response still contains everything the Player File actually renders', async () => {
    registerPlayer({ displayName: 'KeptFieldsAgent', email: 'keptfields@example.com', userId: 'usr-kept-fields' });
    const res = await commandCenterRoute(authedRequest('http://localhost:3000/api/player/command-center', 'usr-kept-fields'));
    const payload = await res.json();

    expect(payload.success).toBe(true);
    expect(payload.player).toBeDefined();
    expect(payload.playerSignalStatus).toBeDefined();
    expect(payload.stats).toMatchObject({
      totalXp: expect.any(Number),
      cityRank: null,
      completedQuests: expect.any(Number),
      prizeEntries: expect.any(Number),
      participatedQuestCount: expect.any(Number),
    });
    expect(payload.badges).toMatchObject({
      catalog: expect.any(Array),
      featuredSlugs: expect.any(Array),
      maxFeatured: expect.any(Number),
    });
  });
});

describe('Source — the route no longer imports or calls the eliminated helpers', () => {
  it('no longer imports getQuestsForEventDB or getCollectiblesForPlayerDB', () => {
    expect(routeSource).not.toMatch(/getQuestsForEventDB/);
    expect(routeSource).not.toMatch(/getCollectiblesForPlayerDB/);
  });

  it('no longer imports the deleted player-command-center helpers', () => {
    expect(routeSource).not.toMatch(/getStartingDistrict/);
    expect(routeSource).not.toMatch(/recommendQuests/);
    expect(routeSource).not.toMatch(/computeDistrictProgress/);
    expect(routeSource).not.toMatch(/buildRecentActivity/);
  });

  it('has no leftover operationPath/completedQuests/recommendedQuests local variables', () => {
    expect(routeSource).not.toMatch(/const operationPath/);
    expect(routeSource).not.toMatch(/const completedQuests/);
    expect(routeSource).not.toMatch(/const recommendedQuests/);
  });
});

describe('Dead helper functions were deleted from lib/player-command-center.ts (zero consumers repo-wide)', () => {
  const centerSource = readSource('lib/player-command-center.ts');

  it('getStartingDistrict, recommendQuests, computeDistrictProgress, and buildRecentActivity no longer exist', () => {
    expect(centerSource).not.toMatch(/export function getStartingDistrict/);
    expect(centerSource).not.toMatch(/export function recommendQuests/);
    expect(centerSource).not.toMatch(/export function computeDistrictProgress/);
    expect(centerSource).not.toMatch(/export function buildRecentActivity/);
    expect(centerSource).not.toMatch(/STARTING_DISTRICTS/);
    expect(centerSource).not.toMatch(/interface DistrictProgress/);
    expect(centerSource).not.toMatch(/interface RecentFieldActivity/);
  });

  it('no other file in the repo still imports the deleted helpers', () => {
    const searchDirs = ['app', 'components', 'lib'];
    const deadNames = ['getStartingDistrict', 'recommendQuests', 'computeDistrictProgress', 'buildRecentActivity', 'STARTING_DISTRICTS'];

    function walk(dir: string): string[] {
      const full = path.join(process.cwd(), dir);
      if (!fs.existsSync(full)) return [];
      let results: string[] = [];
      for (const entry of fs.readdirSync(full)) {
        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(path.join(process.cwd(), entryPath));
        if (stat.isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue;
          results = results.concat(walk(entryPath));
        } else if (/\.(ts|tsx)$/.test(entry)) {
          results.push(entryPath);
        }
      }
      return results;
    }

    const allFiles = [...walk('app'), ...walk('components'), ...walk('lib')];
    for (const file of allFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      for (const name of deadNames) {
        expect(source, `${file} still references ${name}`).not.toContain(name);
      }
    }
  });
});

describe('Shared Mission logic used by OTHER routes was preserved, not deleted', () => {
  it('getQuestsForEventDB and getCollectiblesForPlayerDB still exist and are still used elsewhere', () => {
    const supabaseDbSource = readSource('lib/supabase-db.ts');
    expect(supabaseDbSource).toContain('export async function getQuestsForEventDB');
    expect(supabaseDbSource).toContain('export async function getCollectiblesForPlayerDB');

    // getCollectiblesForPlayerDB is still called internally for finale
    // qualification — a real, unrelated production consumer.
    const collectiblesCallSites = (supabaseDbSource.match(/getCollectiblesForPlayerDB\(/g) || []).length;
    expect(collectiblesCallSites).toBeGreaterThanOrEqual(2); // definition + at least one real call site

    // getQuestsForEventDB has real callers outside the command-center route.
    const otherQuestConsumers = [
      'app/api/admin/fair-qr/route.ts',
      'app/api/game/events/[slug]/route.ts',
      'app/api/fair/dashboard/route.ts',
    ];
    for (const file of otherQuestConsumers) {
      expect(readSource(file)).toContain('getQuestsForEventDB');
    }
  });

  it('the Founder\'s Cipher Mission dashboard still computes its own recommended quest independently', () => {
    const missionSource = readSource('app/events/[slug]/page.tsx');
    expect(missionSource).toContain('recommendedQuest');
  });
});

describe('Dead CSS classes removed from app/globals.css (zero JSX consumers repo-wide)', () => {
  const cssSource = readSource('app/globals.css');
  const deadClasses = [
    'cq-next-move',
    'cq-starting-district',
    'cq-command-stats',
    'cq-progress-stack',
    'cq-progress-row',
    'cq-command-quest-grid',
    'cq-command-quest-card',
    'cq-command-quest-meta',
    'cq-master-key-grid',
    'cq-master-key-slot',
    'cq-master-key-label',
    'cq-master-key-path',
    'cq-master-key-status',
    'cq-activity-list',
    'cq-open-city-copy',
  ];

  it('none of the dead Player File class names remain in globals.css', () => {
    for (const cls of deadClasses) {
      expect(cssSource, `globals.css still defines .${cls}`).not.toContain(cls);
    }
  });

  it('CSS braces stay balanced after the surgical block removals', () => {
    const opens = (cssSource.match(/\{/g) || []).length;
    const closes = (cssSource.match(/\}/g) || []).length;
    expect(opens).toBe(closes);
  });

  it('classes still used elsewhere on the Player File were NOT removed', () => {
    expect(cssSource).toContain('.cq-command-primary-link');
    expect(cssSource).toContain('.cq-empty-state');
    expect(cssSource).toContain('.cq-badge-button');
    expect(cssSource).toContain('.cq-command-section');
  });
});

describe('BriefingVideoModal.tsx was deleted (confirmed zero consumers before deletion)', () => {
  it('the file no longer exists', () => {
    expect(fs.existsSync(path.join(process.cwd(), 'components/BriefingVideoModal.tsx'))).toBe(false);
  });

  it('nothing in the repo still imports it', () => {
    function walk(dir: string): string[] {
      const full = path.join(process.cwd(), dir);
      if (!fs.existsSync(full)) return [];
      let results: string[] = [];
      for (const entry of fs.readdirSync(full)) {
        const entryPath = path.join(dir, entry);
        const stat = fs.statSync(path.join(process.cwd(), entryPath));
        if (stat.isDirectory()) {
          if (entry === 'node_modules' || entry === '.next') continue;
          results = results.concat(walk(entryPath));
        } else if (/\.(ts|tsx)$/.test(entry)) {
          results.push(entryPath);
        }
      }
      return results;
    }
    const allFiles = [...walk('app'), ...walk('components'), ...walk('lib')];
    for (const file of allFiles) {
      const source = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      expect(source, `${file} still references BriefingVideoModal`).not.toContain('BriefingVideoModal');
    }
  });
});

describe('Player File still fully works after the cleanup', () => {
  it('Player Card, Badge Selection, and Profile Settings all still render', () => {
    const profileSource = readSource('app/profile/page.tsx');
    expect(profileSource).toContain('<PlayerCard');
    expect(profileSource).toMatch(/id="badges-heading">BADGES</);
    expect(profileSource).toMatch(/id="settings-heading">Profile Settings</);
  });

  it('Motto still wires through to load and save', () => {
    const profileSource = readSource('app/profile/page.tsx');
    expect(profileSource).toContain("setMotto(nextData.player.tagline || '')");
    expect(profileSource).toContain('tagline: motto');
    expect(profileSource).toContain('motto={motto}');
  });

  it('Player Signal and Player Level still wire through to the card', () => {
    const profileSource = readSource('app/profile/page.tsx');
    expect(profileSource).toContain('signalStatusText={data.playerSignalStatus}');
    expect(profileSource).toContain('participatedQuestCount={data.stats.participatedQuestCount || 0}');
  });
});
