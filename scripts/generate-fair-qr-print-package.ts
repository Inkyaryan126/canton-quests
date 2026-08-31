/**
 * Canton Quests — Fair QR Hunt print package generator
 * =======================================================
 * Produces the physical deployment package for all 22 Fair Signals from
 * the canonical, frozen manifest (lib/fair-deployment-manifest.ts) —
 * never hand-typed URLs. Run with:
 *
 *   node --env-file=.env.local ./node_modules/vite-node/vite-node.mjs scripts/generate-fair-qr-print-package.ts
 *
 * Output (git-ignored, regeneratable):
 *   output/fair-qr-print/cards/<slug>.png            one high-res card per Signal
 *   output/fair-qr-print/sheets/core-sheet-N.png      6-up cut sheets, core Signals, US Letter @ 300dpi
 *   output/fair-qr-print/sheets/bonus-sheet-N.png     daily bonus Signals, own sheet(s)
 *   output/fair-qr-print/manifest.json                full deployment manifest (admin-only fields included)
 *   output/fair-qr-print/manifest.md                  human-readable version
 *   output/fair-qr-print/verification-report.json     QR round-trip + integrity checks
 *   output/fair-qr-print/PRINT-INSTRUCTIONS.md         how to actually print the sheets
 *
 * Sheets are high-resolution PNGs (300dpi US Letter), not PDF: Playwright's
 * Chromium/WebKit cannot be installed on this build environment's macOS
 * version ("Playwright does not support chromium/webkit on mac13"), so per
 * the documented fallback this uses sharp (already a project dependency,
 * already used for QR/image compositing in lib/qr-flyer-generator.ts) to
 * rasterize each sheet directly from SVG — no headless browser needed. See
 * PRINT-INSTRUCTIONS.md in the output for the manual print step.
 *
 * The .env.local Supabase credentials are optional here — if reachable,
 * live placement notes/deployment status/claim counts are merged into the
 * manifest; otherwise it falls back to canonical-only data (every Signal
 * shown as "Placement TBD."). Either way, the printed codes/URLs
 * themselves come only from the frozen canonical manifest.
 */
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp, { OverlayOptions } from 'sharp';
import jsQR from 'jsqr';
import { getCanonicalFairManifest, FairManifestEntry, FAIR_PUBLIC_DOMAIN } from '../lib/fair-deployment-manifest';
import { PLACEMENT_NOTE_PLACEHOLDER, getDeploymentStatus } from '../lib/fair-hunt';

const OUTPUT_ROOT = path.resolve(__dirname, '../output/fair-qr-print');
const CARDS_DIR = path.join(OUTPUT_ROOT, 'cards');
const SHEETS_DIR = path.join(OUTPUT_ROOT, 'sheets');

const COLOR = {
  charcoal: '#0d0f10',
  charcoalDeep: '#08090a',
  gold: '#d9a44c',
  cyan: '#22d3ee',
  white: '#f4f1ea',
};

// Print card geometry — points @ 72/in. 3.7in x 4.75in gives a generous
// ~2.3in QR (well above reliable-scan minimums) with room for branding,
// the Signal label, and the instruction line, without cramming.
const CARD_W_IN = 3.7;
const CARD_H_IN = 4.75;
const SHEET_DPI = 300;
const CARDS_PER_ROW = 2;
const CARDS_PER_COL = 2;
const CARDS_PER_SHEET = CARDS_PER_ROW * CARDS_PER_COL;
const SHEET_MARGIN_IN = 0.4;
const SHEET_GAP_IN = 0.2;

interface AdminOverlay {
  gmNotes?: string;
  placementDetails?: { description?: string; setupNotes?: string; retrievalNotes?: string };
  placedAt?: string | null;
  status?: 'active' | 'inactive' | 'draft';
  uniqueClaimCount?: number;
  lastClaimedAt?: string | null;
}

async function tryFetchLiveOverlay(): Promise<Record<string, AdminOverlay>> {
  try {
    // Local import kept inside try/catch: Supabase env vars are optional
    // for this script, and lib/supabase throws nothing on missing env, but
    // network reachability is not guaranteed in every run context.
    const { supabaseAdmin, isSupabaseAdminConfigured } = await import('../lib/supabase');
    if (!isSupabaseAdminConfigured || !supabaseAdmin) return {};

    const { data: event } = await supabaseAdmin.from('events').select('id').eq('slug', 'fair-qr-hunt').single();
    if (!event) return {};

    const { data: quests } = await supabaseAdmin
      .from('quests')
      .select('id, slug, gm_notes, placement_details, placed_at, status')
      .eq('event_id', event.id);

    const questIdToSlug = new Map((quests || []).map((q) => [q.id, q.slug]));

    const { data: submissions } = await supabaseAdmin
      .from('quest_submissions')
      .select('quest_id, submitted_at')
      .eq('event_id', event.id)
      .eq('status', 'verified')
      .order('submitted_at', { ascending: true });

    const claimCounts: Record<string, number> = {};
    const lastClaimed: Record<string, string> = {};
    for (const row of submissions || []) {
      const slug = questIdToSlug.get(row.quest_id);
      if (!slug) continue;
      claimCounts[slug] = (claimCounts[slug] || 0) + 1;
      lastClaimed[slug] = row.submitted_at;
    }

    const overlay: Record<string, AdminOverlay> = {};
    for (const q of quests || []) {
      overlay[q.slug] = {
        gmNotes: q.gm_notes || undefined,
        placementDetails: q.placement_details || undefined,
        placedAt: q.placed_at || undefined,
        status: q.status,
        uniqueClaimCount: claimCounts[q.slug] || 0,
        lastClaimedAt: lastClaimed[q.slug] || undefined,
      };
    }
    return overlay;
  } catch (err) {
    console.warn('[fair-qr-print] Live admin data unavailable, falling back to canonical-only manifest:', (err as Error).message);
    return {};
  }
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function generateQrPngBase64(url: string): Promise<{ buffer: Buffer; dataUri: string }> {
  const buffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 900,
    color: { dark: '#000000', light: '#ffffff' },
  });
  return { buffer, dataUri: `data:image/png;base64,${buffer.toString('base64')}` };
}

/** Decodes a generated QR PNG buffer back to text — the actual round-trip proof, not just a string comparison. */
async function decodeQrPng(buffer: Buffer): Promise<string | null> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return result?.data ?? null;
}

function buildCardSvg(entry: FairManifestEntry, qrDataUri: string): string {
  const wIn = CARD_W_IN;
  const hIn = CARD_H_IN;
  const wPt = wIn * 72;
  const hPt = hIn * 72;
  const isBonus = entry.type === 'daily_bonus';
  const qrSizePt = 2.15 * 72;
  const qrX = (wPt - qrSizePt) / 2;
  const qrY = 1.75 * 72;
  const platePad = 12;
  const plateBottom = qrY + qrSizePt + platePad;

  const dateLine = isBonus && entry.scheduledDate
    ? new Date(`${entry.scheduledDate}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' })
    : '';

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${wPt}" height="${hPt}" viewBox="0 0 ${wPt} ${hPt}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${COLOR.charcoal}" />
      <stop offset="100%" stop-color="${COLOR.charcoalDeep}" />
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${wPt}" height="${hPt}" fill="url(#bg)" />
  <rect x="6" y="6" width="${wPt - 12}" height="${hPt - 12}" rx="14" fill="none" stroke="${COLOR.gold}" stroke-width="2" opacity="0.85" />

  <text x="${wPt / 2}" y="30" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10.5" font-weight="700" letter-spacing="3" fill="${COLOR.gold}">CANTON QUESTS</text>
  <text x="${wPt / 2}" y="47" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8.5" font-weight="600" letter-spacing="2" fill="${COLOR.cyan}">FAIR QR HUNT</text>

  ${isBonus ? `
  <rect x="${wPt / 2 - 76}" y="60" width="152" height="19" rx="9.5" fill="none" stroke="${COLOR.cyan}" stroke-width="1.5" />
  <text x="${wPt / 2}" y="73" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="800" letter-spacing="1.5" fill="${COLOR.cyan}">DAILY BONUS SIGNAL</text>
  <text x="${wPt / 2}" y="99" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="800" fill="${COLOR.white}">${escapeXml(dateLine)}</text>
  ` : `
  <text x="${wPt / 2}" y="99" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="900" fill="${COLOR.white}">${escapeXml(entry.signalLabel.toUpperCase())}</text>
  `}

  <rect x="${qrX - platePad}" y="${qrY - platePad}" width="${qrSizePt + platePad * 2}" height="${qrSizePt + platePad * 2}" rx="10" fill="#ffffff" />
  <image x="${qrX}" y="${qrY}" width="${qrSizePt}" height="${qrSizePt}" href="${qrDataUri}" />

  <text x="${wPt / 2}" y="${plateBottom + 24}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="800" letter-spacing="1" fill="${COLOR.white}">SCAN TO SECURE SIGNAL</text>
  <text x="${wPt / 2}" y="${hPt - 14}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8" letter-spacing="0.5" fill="${COLOR.gold}" opacity="0.75">${FAIR_PUBLIC_DOMAIN}</text>
</svg>`.trim();
}

async function main() {
  fs.mkdirSync(CARDS_DIR, { recursive: true });
  fs.mkdirSync(SHEETS_DIR, { recursive: true });

  const manifest = getCanonicalFairManifest();
  const overlay = await tryFetchLiveOverlay();
  const usedLiveData = Object.keys(overlay).length > 0;

  console.log(`Canonical Signals: ${manifest.length}. Live admin overlay: ${usedLiveData ? 'merged' : 'unavailable — canonical-only fallback'}.`);

  // ---- Generate each card: QR -> round-trip decode -> SVG -> raster PNG ----
  const verification: Array<{ slug: string; code: string; expectedUrl: string; decodedUrl: string | null; roundTripOk: boolean }> = [];

  const cardRasterWidth = Math.round(CARD_W_IN * SHEET_DPI);
  const cardRasterHeight = Math.round(CARD_H_IN * SHEET_DPI);
  const cardPngBuffers: Record<string, Buffer> = {};

  for (const entry of manifest) {
    const { buffer, dataUri } = await generateQrPngBase64(entry.publicUrl);
    const decoded = await decodeQrPng(buffer);
    verification.push({
      slug: entry.questSlug,
      code: entry.code,
      expectedUrl: entry.publicUrl,
      decodedUrl: decoded,
      roundTripOk: decoded === entry.publicUrl,
    });

    const svg = buildCardSvg(entry, dataUri);
    const cardPng = await sharp(Buffer.from(svg), { density: SHEET_DPI })
      .resize(cardRasterWidth, cardRasterHeight)
      .png()
      .toBuffer();
    cardPngBuffers[entry.questSlug] = cardPng;
    fs.writeFileSync(path.join(CARDS_DIR, entry.printFilename), cardPng);
  }

  const failedRoundTrips = verification.filter((v) => !v.roundTripOk);
  if (failedRoundTrips.length > 0) {
    console.error('QR round-trip verification FAILED for:', failedRoundTrips);
    throw new Error(`${failedRoundTrips.length} generated QR code(s) failed round-trip decode verification.`);
  }
  console.log(`QR round-trip verification: ${verification.length}/${verification.length} passed.`);

  // ---- Integrity checks across the full set ----
  const codes = manifest.map((e) => e.code);
  const urls = manifest.map((e) => e.publicUrl);
  const uniqueCodes = new Set(codes);
  const uniqueUrls = new Set(urls);
  const coreCount = manifest.filter((e) => e.type === 'core').length;
  const bonusCount = manifest.filter((e) => e.type === 'daily_bonus').length;
  const allHttps = urls.every((u) => u.startsWith('https://'));
  const allCorrectDomain = urls.every((u) => u.startsWith(`https://${FAIR_PUBLIC_DOMAIN}/qr/`));
  const noLocalhost = urls.every((u) => !u.includes('localhost') && !u.includes('127.0.0.1'));
  const noVercelPreview = urls.every((u) => !u.includes('.vercel.app'));

  const integrityOk =
    manifest.length === 22 &&
    coreCount === 20 &&
    bonusCount === 2 &&
    uniqueCodes.size === codes.length &&
    uniqueUrls.size === urls.length &&
    allHttps &&
    allCorrectDomain &&
    noLocalhost &&
    noVercelPreview;

  if (!integrityOk) {
    throw new Error('Manifest integrity check failed — see verification-report.json for details.');
  }
  console.log('Manifest integrity checks: PASS (22 total, 20 core, 2 bonus, all unique, all production HTTPS URLs).');

  // ---- Sheets: 2 columns x 2 rows per US Letter page @ 300dpi, core and bonus separate ----
  const coreEntries = manifest.filter((e) => e.type === 'core');
  const bonusEntries = manifest.filter((e) => e.type === 'daily_bonus');

  const corePages = chunk(coreEntries, CARDS_PER_SHEET);
  for (let i = 0; i < corePages.length; i++) {
    await renderSheetPng(corePages[i], cardPngBuffers, cardRasterWidth, cardRasterHeight, path.join(SHEETS_DIR, `core-sheet-${i + 1}.png`));
  }

  const bonusPages = chunk(bonusEntries, CARDS_PER_SHEET);
  for (let i = 0; i < bonusPages.length; i++) {
    await renderSheetPng(bonusPages[i], cardPngBuffers, cardRasterWidth, cardRasterHeight, path.join(SHEETS_DIR, `bonus-sheet-${i + 1}.png`));
  }
  console.log(`Sheets generated: ${corePages.length} core sheet(s), ${bonusPages.length} bonus sheet(s).`);

  // ---- Manifest export (admin-only fields included — this file is git-ignored, never served publicly) ----
  const fullManifest = manifest.map((entry) => {
    const live = overlay[entry.questSlug];
    const gmNotes = live?.gmNotes ?? PLACEMENT_NOTE_PLACEHOLDER;
    const status = live?.status ?? 'active';
    const placedAt = live?.placedAt ?? undefined;
    return {
      ...entry,
      placementNote: gmNotes,
      placementDetails: live?.placementDetails ?? null,
      deploymentStatus: getDeploymentStatus({ status, gmNotes, placedAt }),
      status,
      placedAt: placedAt ?? null,
      uniqueClaimCount: live?.uniqueClaimCount ?? 0,
      lastClaimedAt: live?.lastClaimedAt ?? null,
    };
  });

  fs.writeFileSync(
    path.join(OUTPUT_ROOT, 'manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), dataSource: usedLiveData ? 'production' : 'canonical-only', signals: fullManifest }, null, 2)
  );
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'manifest.md'), buildManifestMarkdown(fullManifest, usedLiveData));
  fs.writeFileSync(
    path.join(OUTPUT_ROOT, 'verification-report.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalSignals: manifest.length,
        coreCount,
        bonusCount,
        allUniqueCodes: uniqueCodes.size === codes.length,
        allUniqueUrls: uniqueUrls.size === urls.length,
        allHttps,
        allCorrectDomain,
        noLocalhost,
        noVercelPreview,
        roundTrip: verification,
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'PRINT-INSTRUCTIONS.md'), buildPrintInstructions(corePages.length, bonusPages.length));

  console.log(`\nDone. Output: ${OUTPUT_ROOT}`);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Composites up to CARDS_PER_SHEET pre-rasterized card PNGs onto a single
 * US-Letter-at-300dpi canvas with thin dashed cut-guides between cells —
 * the sharp-only replacement for the Playwright/HTML→PDF path that isn't
 * available in this build environment (see file header).
 */
async function renderSheetPng(
  entries: FairManifestEntry[],
  cardPngBuffers: Record<string, Buffer>,
  cardW: number,
  cardH: number,
  outputPath: string
) {
  const pageW = Math.round(8.5 * SHEET_DPI);
  const pageH = Math.round(11 * SHEET_DPI);
  const marginPx = Math.round(SHEET_MARGIN_IN * SHEET_DPI);
  const gapPx = Math.round(SHEET_GAP_IN * SHEET_DPI);

  const gridW = CARDS_PER_ROW * cardW + (CARDS_PER_ROW - 1) * gapPx;
  const gridH = CARDS_PER_COL * cardH + (CARDS_PER_COL - 1) * gapPx;
  const startX = Math.max(marginPx, Math.round((pageW - gridW) / 2));
  const startY = marginPx;

  const cutLines: string[] = [];
  for (let row = 0; row <= CARDS_PER_COL; row++) {
    const y = startY + row * (cardH + gapPx) - (row > 0 ? gapPx / 2 : 0);
    cutLines.push(`<line x1="${startX}" y1="${y}" x2="${startX + gridW}" y2="${y}" stroke="#999" stroke-width="2" stroke-dasharray="10,10" />`);
  }
  for (let col = 0; col <= CARDS_PER_ROW; col++) {
    const x = startX + col * (cardW + gapPx) - (col > 0 ? gapPx / 2 : 0);
    cutLines.push(`<line x1="${x}" y1="${startY}" x2="${x}" y2="${startY + gridH}" stroke="#999" stroke-width="2" stroke-dasharray="10,10" />`);
  }
  const guideSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}">${cutLines.join('')}</svg>`;

  const composites: OverlayOptions[] = entries.map((entry, i) => {
    const col = i % CARDS_PER_ROW;
    const row = Math.floor(i / CARDS_PER_ROW);
    return {
      input: cardPngBuffers[entry.questSlug],
      left: startX + col * (cardW + gapPx),
      top: startY + row * (cardH + gapPx),
    };
  });
  composites.push({ input: Buffer.from(guideSvg), left: 0, top: 0 });

  await sharp({ create: { width: pageW, height: pageH, channels: 3, background: '#ffffff' } })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

function buildPrintInstructions(coreSheetCount: number, bonusSheetCount: number): string {
  return `# Fair QR Hunt — Print Instructions

Sheets are 300dpi PNGs sized exactly for US Letter (8.5in x 11in) — not PDF,
because Playwright's Chromium/WebKit cannot be installed on this build
environment's macOS version. To print:

1. Open each sheet PNG (sheets/core-sheet-*.png, sheets/bonus-sheet-*.png)
   in Preview, Photos, or any image viewer/printer app.
2. Print at **Actual Size / 100% scale** — do NOT use "Fit to Page" or
   "Scale to Fit", which would shrink the QR codes.
3. Confirm paper size is set to **US Letter**.
4. Cut along the dashed guide lines.
5. Each card is ${CARD_W_IN}in x ${CARD_H_IN}in with a ~2.3in QR — reliable
   at normal fairground scanning distance.

If you'd rather have a single combined PDF, any "print to PDF" step from
your OS print dialog on these images (at actual size, US Letter) will
produce one without needing anything installed in this repo.

## Sheet counts
- Core Signals: ${coreSheetCount} sheet(s), ${CARDS_PER_SHEET} cards each (20 total)
- Daily Bonus Signals: ${bonusSheetCount} sheet(s), ${CARDS_PER_SHEET} cards each (7 total)

## Regenerating
Codes are frozen — regenerating never changes them. Re-run:

\`\`\`
node --env-file=.env.local ./node_modules/vite-node/vite-node.mjs scripts/generate-fair-qr-print-package.ts
\`\`\`
`;
}

function buildManifestMarkdown(entries: Array<FairManifestEntry & Record<string, any>>, usedLiveData: boolean): string {
  const lines: string[] = [];
  lines.push('# Canton Quests — Fair QR Hunt Deployment Manifest');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Placement/status data source: ${usedLiveData ? 'production (live)' : 'canonical-only (production unreachable at generation time)'}`);
  lines.push('');
  lines.push('**INTERNAL — placement notes below are admin-only. Do not publish this file.**');
  lines.push('');
  lines.push('## Core Signals');
  lines.push('');
  lines.push('| Signal | Code | Deployment | Points | Claims | Placement Note |');
  lines.push('|---|---|---|---|---|---|');
  for (const e of entries.filter((e) => e.type === 'core')) {
    lines.push(`| ${e.signalLabel} | \`${e.code}\` | ${e.deploymentStatus} | ${e.points} | ${e.uniqueClaimCount} | ${e.placementNote} |`);
  }
  lines.push('');
  lines.push('## Daily Bonus Signals');
  lines.push('');
  lines.push('| Signal | Date | Code | Deployment | Points | Claims | Placement Note |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const e of entries.filter((e) => e.type === 'daily_bonus')) {
    lines.push(`| ${e.signalLabel} | ${e.scheduledDate} | \`${e.code}\` | ${e.deploymentStatus} | ${e.points} | ${e.uniqueClaimCount} | ${e.placementNote} |`);
  }
  lines.push('');
  return lines.join('\n');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
