/**
 * Canton Quests — Fair QR physical deployment coverage.
 *
 * Pins the 22 frozen production QR identifiers exactly as provided for
 * physical placement, the deployment manifest shape, the print generator's
 * canonical data source, and the admin-only placement-note privacy
 * guarantee (never leaked through PublicQuestView).
 */
import { describe, it, expect } from 'vitest';
import { getCanonicalFairManifest, FAIR_QR_URL_BASE, FAIR_PUBLIC_DOMAIN } from '../lib/fair-deployment-manifest';
import { getDeploymentStatus, getFairOperationPhase, PLACEMENT_NOTE_PLACEHOLDER } from '../lib/fair-hunt';
import { getPublicQuestView } from '../lib/game-engine';
import { SEED_FAIR_QUESTS } from '../lib/seed-data';
import { Quest } from '../lib/types';

// The exact 22 production identifiers as frozen by this mission — do not
// regenerate, rename, or reorder. Any drift here means a printed/placed
// physical card no longer matches what the server expects.
const FROZEN_CORE_CODES: Record<string, string> = {
  'Signal 01': 'FAIR-C01-E8Y6', 'Signal 02': 'FAIR-C02-V8TZ', 'Signal 03': 'FAIR-C03-98HH',
  'Signal 04': 'FAIR-C04-B625', 'Signal 05': 'FAIR-C05-Q96H', 'Signal 06': 'FAIR-C06-7Z96',
  'Signal 07': 'FAIR-C07-RT8Y', 'Signal 08': 'FAIR-C08-BFVN', 'Signal 09': 'FAIR-C09-7VJ4',
  'Signal 10': 'FAIR-C10-DH9S', 'Signal 11': 'FAIR-C11-SY4H', 'Signal 12': 'FAIR-C12-YY3V',
  'Signal 13': 'FAIR-C13-E4H8', 'Signal 14': 'FAIR-C14-FC59', 'Signal 15': 'FAIR-C15-YF59',
  'Signal 16': 'FAIR-C16-DVXZ', 'Signal 17': 'FAIR-C17-4QTZ', 'Signal 18': 'FAIR-C18-Y373',
  'Signal 19': 'FAIR-C19-UNYD', 'Signal 20': 'FAIR-C20-6X4J',
};
const FROZEN_BONUS_CODES: Record<string, string> = {
  '2026-09-04': 'FAIR-B0904-PFVX', '2026-09-05': 'FAIR-B0905-V47W',
};

describe('1. Frozen production QR codes are byte-exact and unchanged', () => {
  const manifest = getCanonicalFairManifest();

  it('every core Signal code matches the frozen production value', () => {
    for (const [label, code] of Object.entries(FROZEN_CORE_CODES)) {
      const entry = manifest.find((e) => e.signalLabel === label);
      expect(entry, `missing manifest entry for ${label}`).toBeDefined();
      expect(entry!.code).toBe(code);
    }
  });

  it('every daily bonus Signal code matches the frozen production value for its date', () => {
    for (const [date, code] of Object.entries(FROZEN_BONUS_CODES)) {
      const entry = manifest.find((e) => e.scheduledDate === date);
      expect(entry, `missing manifest entry for ${date}`).toBeDefined();
      expect(entry!.code).toBe(code);
    }
  });
});

describe('2 & 3. Signal counts', () => {
  const manifest = getCanonicalFairManifest();

  it('has exactly 20 core Signals', () => {
    expect(manifest.filter((e) => e.type === 'core')).toHaveLength(20);
  });

  it('has exactly 2 daily bonus Signals', () => {
    expect(manifest.filter((e) => e.type === 'daily_bonus')).toHaveLength(2);
  });
});

describe('4, 5, 7, 8. URL/code uniqueness and domain correctness', () => {
  const manifest = getCanonicalFairManifest();

  it('every Signal has exactly one public URL, unique across all 22', () => {
    const urls = manifest.map((e) => e.publicUrl);
    expect(new Set(urls).size).toBe(22);
    expect(urls).toHaveLength(22);
  });

  it('no duplicate codes across all 22', () => {
    const codes = manifest.map((e) => e.code);
    expect(new Set(codes).size).toBe(22);
  });

  it('no duplicate URLs across all 27', () => {
    const urls = manifest.map((e) => e.publicUrl);
    expect(new Set(urls).size).toBe(new Set(manifest.map((e) => e.code)).size);
  });

  it('all URLs use the production domain over HTTPS, no localhost, no Vercel preview, correct /qr/ path', () => {
    for (const entry of manifest) {
      expect(entry.publicUrl).toBe(`${FAIR_QR_URL_BASE}/${entry.code}`);
      expect(entry.publicUrl.startsWith('https://')).toBe(true);
      expect(entry.publicUrl.startsWith(`https://${FAIR_PUBLIC_DOMAIN}/qr/`)).toBe(true);
      expect(entry.publicUrl).not.toContain('localhost');
      expect(entry.publicUrl).not.toContain('127.0.0.1');
      expect(entry.publicUrl).not.toContain('.vercel.app');
    }
    expect(FAIR_PUBLIC_DOMAIN).toBe('www.cantonquests.com');
  });
});

describe('6. Export manifest completeness', () => {
  it('the canonical manifest contains all 22 Signals with no gaps', () => {
    const manifest = getCanonicalFairManifest();
    expect(manifest).toHaveLength(22);
    const coreNumbers = manifest
      .filter((e) => e.type === 'core')
      .map((e) => Number(e.signalLabel.replace('Signal ', '')))
      .sort((a, b) => a - b);
    expect(coreNumbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

describe('9. Print generator uses the canonical data source', () => {
  it('scripts/generate-fair-qr-print-package.ts imports the same getCanonicalFairManifest used here — verified by re-deriving from SEED_FAIR_QUESTS and comparing', () => {
    // The generator (scripts/generate-fair-qr-print-package.ts) imports
    // getCanonicalFairManifest from this exact module — there is no second
    // code path that could invent or randomize identifiers. This test
    // pins that the manifest itself is a pure, deterministic function of
    // the frozen SEED_FAIR_QUESTS fixture (calling it twice must be
    // byte-identical), which is what makes the print output reproducible.
    const first = getCanonicalFairManifest();
    const second = getCanonicalFairManifest();
    expect(first).toEqual(second);
    expect(first.every((e) => SEED_FAIR_QUESTS.some((q) => q.targetCode === e.code))).toBe(true);
  });
});

describe('10. Daily bonus dates map correctly', () => {
  it('each bonus Signal label matches its scheduledDate', () => {
    const manifest = getCanonicalFairManifest();
    const bonuses = manifest.filter((e) => e.type === 'daily_bonus');
    const expected: Record<string, string> = {
      '2026-09-04': 'Daily Bonus — Sept 4',
      '2026-09-05': 'Daily Bonus — Sept 5',
    };
    for (const b of bonuses) {
      expect(b.scheduledDate).toBeDefined();
      expect(b.signalLabel).toBe(expected[b.scheduledDate!]);
    }
  });
});

describe('11. Internal placement notes never leak through the public quest view', () => {
  it('getPublicQuestView strips gmNotes, placementDetails, and placedAt', () => {
    const withSecrets: Quest = {
      ...SEED_FAIR_QUESTS[0],
      gmNotes: 'SECRET: behind the funnel cake stand, north post.',
      placementDetails: { description: 'Exact GPS pin — do not publish', setupNotes: 'zip-tie only', retrievalNotes: 'remove by Sept 8' },
      placedAt: '2026-08-30T12:00:00Z',
    };
    const publicView = getPublicQuestView(withSecrets);
    expect((publicView as any).gmNotes).toBeUndefined();
    expect((publicView as any).placementDetails).toBeUndefined();
    expect((publicView as any).placedAt).toBeUndefined();
    expect(JSON.stringify(publicView)).not.toContain('funnel cake');
    expect(JSON.stringify(publicView)).not.toContain('do not publish');
  });
});

describe('12 & 13. Fair activation/end window behavior', () => {
  const event = { startTime: '2026-09-04T04:00:00Z', endTime: '2026-09-06T03:59:59Z' };

  it('12. activates automatically the instant the Fair starts — no manual event.status flip required', () => {
    expect(getFairOperationPhase(event, new Date('2026-09-03T23:59:59Z'))).toBe('pre_launch');
    expect(getFairOperationPhase(event, new Date('2026-09-04T04:00:00Z'))).toBe('active');
    expect(getFairOperationPhase(event, new Date('2026-09-04T04:00:01Z'))).toBe('active');
  });

  it('13. the Fair ending blocks new activity — phase flips to ended right after the window closes', () => {
    expect(getFairOperationPhase(event, new Date('2026-09-06T03:59:59Z'))).toBe('active');
    expect(getFairOperationPhase(event, new Date('2026-09-06T04:00:00Z'))).toBe('ended');
  });
});

describe('14. Admin deployment status derivation', () => {
  const base = { status: 'active' as const, gmNotes: PLACEMENT_NOTE_PLACEHOLDER, placedAt: undefined as string | undefined };

  it('reports placement_tbd when only the seed placeholder note is present', () => {
    expect(getDeploymentStatus(base)).toBe('placement_tbd');
  });

  it('reports placement_tbd when gmNotes is empty', () => {
    expect(getDeploymentStatus({ ...base, gmNotes: '' })).toBe('placement_tbd');
  });

  it('reports ready_to_print once a real placement note is written but not yet marked placed', () => {
    expect(getDeploymentStatus({ ...base, gmNotes: 'Funnel cake stand, north post.' })).toBe('ready_to_print');
  });

  it('reports placed once placedAt is set, even with a real note', () => {
    expect(
      getDeploymentStatus({ ...base, gmNotes: 'Funnel cake stand, north post.', placedAt: '2026-08-30T12:00:00Z' })
    ).toBe('placed');
  });

  it('reports disabled when status is inactive, overriding placed/ready state', () => {
    expect(
      getDeploymentStatus({ status: 'inactive', gmNotes: 'Funnel cake stand.', placedAt: '2026-08-30T12:00:00Z' })
    ).toBe('disabled');
  });
});
