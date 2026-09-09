// Canton Quests — Launch Blocker: Mission Hub Roster, Imagery, Contrast, Collapse
//
// Live production screenshots exposed four concrete problems on the
// Founder's Cipher mission hub:
//
//  1. ALL QUESTS (33) — GET /api/game/events/[slug] returned every quest
//     row sharing this event's event_id (36 in the local seed data — a
//     long tail of prototype/legacy/superseded records), not just the
//     canonical 14-quest September launch roster already defined in
//     lib/finale.ts's LAUNCH_DISTRICT_QUESTS (5 Family + 5 Challenge + 4
//     Secret). Fixed by filtering to that roster (by slug, independent of
//     each row's own status) at the public gameplay API boundary only —
//     getQuestsForEventDB itself stays unfiltered for admin/audit callers.
//     QuestCard was also made fail-closed: a 'hidden' (draft/inactive)
//     state now renders nothing instead of a half-finished card.
//
//  2. PALACE IMAGE REPEATS — getQuestImage(quest) defaulted its index
//     parameter to 0, and questImagePool[0] is Palace Theatre — so any
//     quest without a slug/location mapping silently became Palace. Fixed
//     by deriving a stable per-quest hash index instead of a hardcoded 0
//     when no explicit index is given.
//
//  3. LOW CONTRAST CONTROLS — the tab bar, category filter chips, and sort
//     control used `bg-obsidian`, `bg-card`, and `text-obsidian` as bare
//     Tailwind utility classes. Those are raw CSS custom properties
//     (--bg-obsidian, --bg-card), never registered as Tailwind @theme
//     color tokens, so the classes are invalid/no-op — the elements
//     rendered with no real background at all. Fixed with real, guaranteed
//     -dark Tailwind classes and an unambiguous amber/gold selected state.
//
//  4. PAGE TOO LONG BY DEFAULT — activeTab defaulted to 'quests', so the
//     full 14-card grid rendered immediately under the simplified NEXT
//     ASSIGNMENT panel, defeating the whole point of the earlier
//     simplification pass. Fixed: activeTab now defaults to null (no panel
//     open) unless a deep link (?tab=quests / ?tab=map / ?tab=intel)
//     explicitly requests one.

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { initializeGameEngine, resetGameEngineStore } from '../lib/game-engine';
import { SEED_EVENT } from '../lib/seed-data';
import { LAUNCH_DISTRICT_QUESTS, isLaunchDistrictQuestSlug } from '../lib/finale';
import { GET as eventsRoute } from '../app/api/game/events/[slug]/route';
import { getQuestImage, cqImages, questImagePool } from '../lib/marketing-assets';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import QuestCard from '../components/QuestCard';
import type { PublicQuestView } from '../lib/types';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

const HUB_SOURCE = readSource('app/events/[slug]/page.tsx');
const ALL_14_SLUGS = Object.values(LAUNCH_DISTRICT_QUESTS).flat();
const VALID_ADMIN_KEY = 'canton-gm-2026';

function baseQuest(overrides: Partial<PublicQuestView> = {}): PublicQuestView {
  return {
    id: 'qst-test-generic',
    eventId: SEED_EVENT.id,
    title: 'Generic Test Quest',
    slug: 'unmapped-generic-test-quest',
    description: 'A quest with no slug/location image mapping.',
    instructions: 'Do the thing.',
    pointValue: 100,
    xpReward: 100,
    drawingEntryReward: 1,
    difficulty: 'easy',
    category: 'exploration',
    startingPath: 'family',
    verificationType: 'checkin',
    isFlash: false,
    status: 'active',
    ...overrides,
  } as PublicQuestView;
}

describe('Problem 1 — the Founder\'s Cipher API exposes exactly the canonical 14 launch quests', () => {
  beforeEach(() => {
    resetGameEngineStore();
    initializeGameEngine();
  });

  it('LAUNCH_DISTRICT_QUESTS is exactly 5 Family + 5 Challenge + 4 Secret = 14', () => {
    expect(LAUNCH_DISTRICT_QUESTS.family).toHaveLength(5);
    expect(LAUNCH_DISTRICT_QUESTS.challenge).toHaveLength(5);
    expect(LAUNCH_DISTRICT_QUESTS.secret).toHaveLength(4);
    expect(ALL_14_SLUGS).toHaveLength(14);
  });

  it('isLaunchDistrictQuestSlug recognizes all 14 canonical slugs and rejects unrelated ones', () => {
    for (const slug of ALL_14_SLUGS) {
      expect(isLaunchDistrictQuestSlug(slug)).toBe(true);
    }
    expect(isLaunchDistrictQuestSlug('challenge-blue-signal')).toBe(false);
    expect(isLaunchDistrictQuestSlug('the-tower')).toBe(false);
    expect(isLaunchDistrictQuestSlug(undefined)).toBe(false);
    expect(isLaunchDistrictQuestSlug(null)).toBe(false);
  });

  it('GET /api/game/events/canton-weekend-1 (admin field test, real event data) returns exactly the 14 canonical quests, not the full ~36-row raw roster', async () => {
    const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}?fieldTest=1`, {
      headers: { 'x-admin-key': VALID_ADMIN_KEY },
    });
    const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();

    expect(data.fieldTestActive).toBe(true);
    expect(Array.isArray(data.quests)).toBe(true);
    expect(data.quests).toHaveLength(14);

    const returnedSlugs = data.quests.map((q: { slug: string }) => q.slug).sort();
    expect(returnedSlugs).toEqual([...ALL_14_SLUGS].sort());
  });

  it('stale/prototype/legacy quest slugs sharing the same event never reach the response', async () => {
    const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}?fieldTest=1`, {
      headers: { 'x-admin-key': VALID_ADMIN_KEY },
    });
    const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();
    const returnedSlugs = new Set(data.quests.map((q: { slug: string }) => q.slug));

    // A representative sample of known non-canonical records that share
    // this event's event_id in lib/seed-data.ts but are not part of the
    // launch roster (legacy/superseded/not-yet-built).
    const knownStaleSlugs = [
      'challenge-blue-signal',
      'challenge-storybook-witness',
      'challenge-what-survived',
      'challenge-the-lost-page',
      'the-mural',
      'the-tower',
      'the-open-ground',
    ];
    for (const slug of knownStaleSlugs) {
      expect(returnedSlugs.has(slug), `expected stale slug "${slug}" to be filtered out`).toBe(false);
    }
  });

  it('getQuestsForEventDB itself stays unfiltered (admin/audit tooling still sees the full raw roster)', () => {
    const routeSource = readSource('app/api/game/events/[slug]/route.ts');
    expect(routeSource).toContain('const quests = await getQuestsForEventDB(event.id);');
    expect(routeSource).toContain('const rosterFilteredQuests = isKnownCantonLaunchSlug(slug)');
    expect(routeSource).toContain('quests.filter((q) => isLaunchDistrictQuestSlug(q.slug))');
  });

  it('the hub label reads "All Quests (N)" driven by the (now roster-filtered) quests array length', () => {
    expect(HUB_SOURCE).toMatch(/All Quests \(\{quests\.length\}\)/);
  });
});

describe('Problem 1b — QuestCard fails closed on a hidden (draft/inactive) quest', () => {
  it('renders nothing for a draft-status quest', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(QuestCard, {
        quest: baseQuest({ status: 'draft' }),
        eventSlug: SEED_EVENT.slug,
      })
    );
    expect(html).toBe('');
  });

  it('renders nothing for an inactive-status quest', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(QuestCard, {
        quest: baseQuest({ status: 'inactive' }),
        eventSlug: SEED_EVENT.slug,
      })
    );
    expect(html).toBe('');
  });

  it('still renders normally for an active quest (the fail-closed guard does not over-hide)', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(QuestCard, {
        quest: baseQuest({ status: 'active' }),
        eventSlug: SEED_EVENT.slug,
      })
    );
    expect(html).not.toBe('');
    expect(html).toContain('Generic Test Quest');
  });

  it('the source explicitly returns null for state === hidden, after all hooks have run', () => {
    const cardSource = readSource('components/QuestCard.tsx');
    expect(cardSource).toContain("if (state === 'hidden') return null;");
    // The guard sits after the useEffect (timer) hook, never before it.
    expect(cardSource.indexOf('useEffect(')).toBeLessThan(cardSource.indexOf("if (state === 'hidden') return null;"));
  });
});

describe('Problem 2 — an unmapped quest never automatically becomes Palace Theatre', () => {
  it('a quest with no slug/location mapping does not resolve to palaceCinematic', () => {
    const img = getQuestImage(baseQuest({ slug: 'totally-unmapped-slug-xyz', locationId: undefined }) as any);
    expect(img).not.toBe(cqImages.palaceCinematic);
  });

  it('two different unmapped quests can resolve to different fallback images (not both forced to Palace)', () => {
    const imgA = getQuestImage(baseQuest({ id: 'qst-unmapped-aaa', slug: 'unmapped-aaa' }) as any);
    const imgB = getQuestImage(baseQuest({ id: 'qst-unmapped-zzz-different', slug: 'unmapped-zzz-different' }) as any);
    // Not asserting they must differ (hash collisions are possible), but
    // neither may be the old universal default.
    expect(imgA).not.toBe(cqImages.palaceCinematic);
    expect(imgB).not.toBe(cqImages.palaceCinematic);
  });

  it('an explicitly passed index is still honored as-is (backward compatible)', () => {
    const img = getQuestImage(baseQuest({ slug: 'totally-unmapped-slug-explicit-index' }) as any, 0);
    // Explicit index=0 intentionally still resolves to pool[0] (Palace) —
    // only the *default* (no index passed) must avoid it.
    expect(img).toBe(questImagePool[0]);
  });

  it('every one of the 14 canonical launch slugs resolves to its own real, non-Palace image', () => {
    for (const [path_, slugs] of Object.entries(LAUNCH_DISTRICT_QUESTS)) {
      for (const slug of slugs) {
        const img = getQuestImage(baseQuest({ slug, startingPath: path_ as any }) as any);
        expect(img, `expected ${slug} to resolve to a real (non-Palace) image`).not.toBe(cqImages.palaceCinematic);
      }
    }
  });

  it('the fallback source no longer hardcodes a 0 default for the index parameter', () => {
    const assetsSource = readSource('lib/marketing-assets.ts');
    expect(assetsSource).not.toContain('export function getQuestImage(quest: Quest, index = 0)');
    expect(assetsSource).toContain('export function getQuestImage(quest: Quest, index?: number)');
  });
});

describe('Problem 3 — mission-hub interactive controls are high-contrast', () => {
  it('the secondary nav (All Quests / Map / Mission Intel) uses a real dark background and an unambiguous amber selected state', () => {
    const navBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('data-testid="mission-secondary-nav"'),
      HUB_SOURCE.indexOf('TAB 1: QUESTS LIST')
    );
    expect(navBlock).toContain('bg-stone-950');
    expect(navBlock).toContain('bg-amber-500 text-stone-950');
    expect(navBlock).not.toMatch(/[^-]\bbg-obsidian\b/);
    expect(navBlock).not.toMatch(/[^-]\bbg-card\b/);
    expect(navBlock).not.toMatch(/[^-]\btext-obsidian\b/);
  });

  it('the category filter bar and chips use real dark backgrounds, not the broken bg-obsidian/bg-card/text-obsidian classes', () => {
    const filterBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('data-testid="quest-filter-bar"'),
      HUB_SOURCE.indexOf('TAB 2: CANTON MAP')
    );
    expect(filterBlock).not.toMatch(/[^-]\bbg-obsidian\b/);
    expect(filterBlock).not.toMatch(/[^-]\bbg-card\b/);
    expect(filterBlock).not.toMatch(/[^-]\btext-obsidian\b/);
    expect(filterBlock).toContain('bg-amber-500 text-stone-950');
    expect(filterBlock).toContain('bg-stone-900 text-stone-200');
  });

  it('the sort control uses a real dark background', () => {
    const filterBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('data-testid="quest-filter-bar"'),
      HUB_SOURCE.indexOf('TAB 2: CANTON MAP')
    );
    expect(filterBlock).toMatch(/<select[\s\S]*?className="bg-stone-900 text-amber-400/);
  });

  it('no bare (unbracketed) bg-obsidian / bg-card / text-obsidian classes remain anywhere on the hub page', () => {
    // The correct, working form is the bracketed CSS-variable reference
    // (e.g. bg-[var(--bg-obsidian)]), used elsewhere in this same file —
    // this asserts no *bare* (invalid, no-op) usages slipped back in.
    const bareBroken = HUB_SOURCE.match(/[^[-]\b(bg-obsidian|bg-card|text-obsidian)\b/g) || [];
    expect(bareBroken).toEqual([]);
  });
});

describe('Problem 4 — the default mission-hub state stays short: no panel open until deliberately chosen', () => {
  it('activeTab is typed nullable and defaults to null when no ?tab= param is present', () => {
    expect(HUB_SOURCE).toContain('const [activeTab, setActiveTab] = useState<DashboardTab | null>(initialTab);');
    expect(HUB_SOURCE).toMatch(
      /const initialTab: DashboardTab \| null = VALID_TABS\.includes\(requestedTab as DashboardTab\) \? \(requestedTab as DashboardTab\) : null;/
    );
  });

  it('none of the three secondary panels (Quests/Map/Intel) render unless activeTab is explicitly set', () => {
    expect(HUB_SOURCE).toContain("{activeTab === 'quests' && (");
    expect(HUB_SOURCE).toContain("{activeTab === 'map' && (");
    expect(HUB_SOURCE).toContain("{activeTab === 'intel' && (");
    // None of these render unconditionally (no bare `{quests.length > 0 &&`
    // style override that would force the grid open regardless of tab).
    expect(HUB_SOURCE).not.toMatch(/activeTab \? .* : true/);
  });

  it('clicking the All Quests button explicitly opens the quests tab', () => {
    const navBlock = HUB_SOURCE.slice(
      HUB_SOURCE.indexOf('data-testid="mission-secondary-nav"'),
      HUB_SOURCE.indexOf('TAB 1: QUESTS LIST')
    );
    expect(navBlock).toContain("onClick={() => setActiveTab('quests')}");
    expect(navBlock).toContain("onClick={() => setActiveTab('map')}");
    expect(navBlock).toContain("onClick={() => setActiveTab('intel')}");
  });

  it('?tab=quests and ?tab=map still deep-link directly into their panels via VALID_TABS', () => {
    expect(HUB_SOURCE).toContain("const VALID_TABS: DashboardTab[] = ['quests', 'map', 'intel'];");
    expect(HUB_SOURCE).toContain("const requestedTab = searchParams.get('tab');");
  });

  it('the post-login redirect preserves an explicitly-requested tab, and no longer special-cases "quests" as the assumed default', () => {
    expect(HUB_SOURCE).toContain(
      "activeTab ? `/events/${eventSlug}?tab=${activeTab}` : `/events/${eventSlug}`"
    );
    expect(HUB_SOURCE).not.toContain("activeTab !== 'quests' ? `/events/${eventSlug}?tab=${activeTab}`");
  });
});

describe('Field test propagation is unaffected by the roster/collapse changes', () => {
  it('buildQuestHref is still the single source of quest-link hrefs on the hub', () => {
    expect(HUB_SOURCE).toContain(
      "const buildQuestHref = (questId: string) =>\n    `/events/${eventSlug}/quests/${questId}${fieldTestActive ? '?fieldTest=1' : ''}`;"
    );
  });

  it('a verified admin field-test session still receives the real 14-quest roster before launch (already proven above); an unauthorized request still gets none', async () => {
    const req = new Request(`http://localhost:3000/api/game/events/${SEED_EVENT.slug}`);
    const res = await eventsRoute(req, { params: { slug: SEED_EVENT.slug } });
    const data = await res.json();
    expect(data.fieldTestActive).toBe(false);
    expect(data.quests).toEqual([]);
  });
});
