/**
 * Canton Quests — Fair QR Hunt deployment manifest
 * ===================================================
 * The canonical, frozen source of truth for the 27 Fair Signal identifiers
 * (public code, public URL, points, scheduled date). Derived directly from
 * SEED_FAIR_QUESTS (lib/seed-data.ts) — the exact same data that seeded
 * production (supabase/migrations/20260826140000_fair_qr_hunt_core_and_bonus_quests.sql)
 * — so this can never drift from the real, already-printed-and-placed
 * identifiers. Nothing in this file invents or regenerates a code.
 *
 * Admin-only fields (placement note, deployment status, claim counts) are
 * NOT part of this static manifest — those are live, mutable, and fetched
 * separately (scripts/generate-fair-qr-print-package.ts merges them in from
 * production when building the full deployment manifest export). This file
 * never leaks that data because it never touches it.
 */

import { SEED_FAIR_QUESTS } from './seed-data';
import { FAIR_BONUS_CATEGORY, FAIR_CORE_CATEGORY } from './fair-hunt';

export const FAIR_PUBLIC_DOMAIN = 'www.cantonquests.com';
export const FAIR_QR_URL_BASE = `https://${FAIR_PUBLIC_DOMAIN}/qr`;

export interface FairManifestEntry {
  type: 'core' | 'daily_bonus';
  /** Public Signal label, e.g. "Signal 01" or "Daily Bonus — Sept 1". */
  signalLabel: string;
  questSlug: string;
  code: string;
  publicUrl: string;
  points: number;
  /** YYYY-MM-DD, daily_bonus only. */
  scheduledDate?: string;
  printFilename: string;
}

function toPrintFilename(slug: string): string {
  return `${slug}.png`;
}

/**
 * The 27 canonical Fair Signal identifiers, in stable Signal order
 * (core 01–20, then daily bonus Sept 1–7). Pure function of frozen source
 * data — calling this twice always returns byte-identical results.
 */
export function getCanonicalFairManifest(): FairManifestEntry[] {
  return SEED_FAIR_QUESTS.filter((q) => q.targetCode).map((q) => {
    const isBonus = q.category === FAIR_BONUS_CATEGORY;
    const isCore = q.category === FAIR_CORE_CATEGORY;
    if (!isBonus && !isCore) {
      throw new Error(`Unexpected non-Fair quest in SEED_FAIR_QUESTS: ${q.slug}`);
    }
    const dateMatch = isBonus ? q.slug.match(/^fair-bonus-(\d{4}-\d{2}-\d{2})$/) : null;

    return {
      type: isBonus ? 'daily_bonus' : 'core',
      signalLabel: q.title,
      questSlug: q.slug,
      code: q.targetCode!,
      publicUrl: `${FAIR_QR_URL_BASE}/${q.targetCode}`,
      points: q.pointValue,
      scheduledDate: dateMatch ? dateMatch[1] : undefined,
      printFilename: toPrintFilename(q.slug),
    };
  });
}
