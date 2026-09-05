/**
 * Canton Quests — Fair QR Hunt Print Package Generator ($300 Mystery Money Hunt)
 * ==============================================================================
 * Produces the final production-ready physical deployment package for the
 * 20 Stark County Fair Mystery Money Signals.
 *
 * Requirements:
 * - Exactly 20 physical QR Signals (Signals 01–20)
 * - $300 total Mystery Money pool ($5 to $50 per Signal)
 * - NO bonus Signals (all daily bonus cards removed)
 * - NO old point system / XP / leaderboard language
 * - NO old $100 top-hunter language
 * - Player-facing cards never reveal hidden cash value, target code text, or placement info
 * - High-contrast, 300dpi QR cards with quiet zone for reliable mobile phone scanning
 * - 5 US Letter cut sheets (4 cards per sheet = 20 cards), matching the 4x5 board
 * - Private Admin Master Deployment Sheet with locked cash values, placement details, and live claim status
 * - README with field deployment instructions for Dustin
 * - Programmatic round-trip QR validation via jsQR
 *
 * Run with:
 *   npx tsx --env-file=.env.local scripts/generate-fair-qr-print-package.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp, { OverlayOptions } from 'sharp';
import jsQR from 'jsqr';
import { getCanonicalFairManifest, FAIR_PUBLIC_DOMAIN } from '../lib/fair-deployment-manifest';
import { PLACEMENT_NOTE_PLACEHOLDER, getDeploymentStatus, fairCoreQuestSlug } from '../lib/fair-hunt';

const OUTPUT_ROOT = path.resolve(__dirname, '../output/fair-qr-print');
const CARDS_DIR = path.join(OUTPUT_ROOT, 'cards');
const SHEETS_DIR = path.join(OUTPUT_ROOT, 'sheets');

// Permanent, locked private cash mapping ($300 total)
export const LOCKED_CASH_VALUES: Record<number, number> = {
  1: 50,
  2: 5,
  3: 20,
  4: 5,
  5: 10,
  6: 15,
  7: 20,
  8: 30,
  9: 10,
  10: 15,
  11: 30,
  12: 15,
  13: 5,
  14: 15,
  15: 5,
  16: 20,
  17: 10,
  18: 10,
  19: 5,
  20: 5,
};

const COLOR = {
  inkNavy: '#0a3270',
  inkRoyal: '#1b4f8a',
  inkAccent: '#2f6bb0',
  guideLight: '#b4cce8',
  white: '#ffffff',
};

// Geometry: 3.5in x 5.0in cards on US Letter (8.5in x 11in)
const CARD_W_IN = 3.5;
const CARD_H_IN = 5.0;
const SHEET_DPI = 300;
const CARDS_PER_ROW = 2;
const CARDS_PER_COL = 2;
const CARDS_PER_SHEET = CARDS_PER_ROW * CARDS_PER_COL; // 4 cards per sheet
const SHEET_MARGIN_X_PX = 150;
const SHEET_MARGIN_Y_PX = 100;
const SHEET_GAP_X_PX = 150;
const SHEET_GAP_Y_PX = 100;

interface AdminOverlay {
  questId?: string;
  gmNotes?: string;
  placementDetails?: { description?: string; setupNotes?: string; retrievalNotes?: string };
  placedAt?: string | null;
  status?: 'active' | 'inactive' | 'draft';
  cashValueCents?: number;
  isClaimed?: boolean;
  finderDisplayName?: string;
  claimedAt?: string | null;
}

async function fetchLiveAdminOverlay(): Promise<Record<string, AdminOverlay>> {
  try {
    const { supabaseAdmin, isSupabaseAdminConfigured } = await import('../lib/supabase');
    if (!isSupabaseAdminConfigured || !supabaseAdmin) return {};

    const { data: event } = await supabaseAdmin.from('events').select('id').eq('slug', 'fair-qr-hunt').single();
    if (!event) return {};

    const { data: quests } = await supabaseAdmin
      .from('quests')
      .select('id, slug, gm_notes, placement_details, placed_at, status')
      .eq('event_id', event.id)
      .like('slug', 'fair-core-%');

    if (!quests || quests.length === 0) return {};

    const questIds = quests.map((q) => q.id);

    const [{ data: prizeRows }, { data: claimRows }] = await Promise.all([
      supabaseAdmin.from('fair_signal_prizes').select('quest_id, cash_value_cents').in('quest_id', questIds),
      supabaseAdmin.from('fair_signal_claims').select('quest_id, player_id, claimed_at').in('quest_id', questIds),
    ]);

    const prizeMap = new Map((prizeRows || []).map((p) => [p.quest_id, p.cash_value_cents]));
    const claimMap = new Map((claimRows || []).map((c) => [c.quest_id, c]));

    const finderIds = Array.from(new Set((claimRows || []).map((c) => c.player_id)));
    const finderNameMap = new Map<string, string>();
    if (finderIds.length > 0) {
      const { data: players } = await supabaseAdmin.from('players').select('id, display_name').in('id', finderIds);
      for (const p of players || []) finderNameMap.set(p.id, p.display_name);
    }

    const overlay: Record<string, AdminOverlay> = {};
    for (const q of quests) {
      const claim = claimMap.get(q.id);
      overlay[q.slug] = {
        questId: q.id,
        gmNotes: q.gm_notes || undefined,
        placementDetails: q.placement_details || undefined,
        placedAt: q.placed_at || undefined,
        status: q.status,
        cashValueCents: prizeMap.get(q.id),
        isClaimed: Boolean(claim),
        finderDisplayName: claim ? finderNameMap.get(claim.player_id) || 'Unknown Player' : undefined,
        claimedAt: claim ? claim.claimed_at : undefined,
      };
    }
    return overlay;
  } catch (err) {
    console.warn('[fair-qr-print] Live Supabase unreachable, using local fallback:', (err as Error).message);
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
    color: { dark: COLOR.inkNavy, light: COLOR.white },
  });
  return { buffer, dataUri: `data:image/png;base64,${buffer.toString('base64')}` };
}

async function decodeQrPng(buffer: Buffer): Promise<string | null> {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return result?.data ?? null;
}

function buildFlourish(y: number, flip = false): string {
  const transform = flip ? `translate(525, ${y}) scale(1, -1)` : `translate(525, ${y})`;
  return `
  <g transform="${transform}" stroke="${COLOR.inkNavy}" fill="none" stroke-linecap="round">
    <!-- Central Fleur / Diamond -->
    <polygon points="0,-12 7,0 0,12 -7,0" fill="${COLOR.inkNavy}" stroke="none" />
    <circle cx="-18" cy="0" r="2.5" fill="${COLOR.inkNavy}" stroke="none" />
    <circle cx="18" cy="0" r="2.5" fill="${COLOR.inkNavy}" stroke="none" />
    
    <!-- Left Wing Swirls -->
    <path d="M -24,0 C -60,-18 -100,16 -140,-4 C -155,-12 -165,-2 -160,8 C -155,16 -140,14 -142,4 C -144,-4 -154,-2 -156,2" stroke-width="1.5" />
    <path d="M -45,-3 C -80,-20 -115,0 -130,-2" stroke-width="0.8" stroke="${COLOR.inkRoyal}" />
    
    <!-- Right Wing Swirls -->
    <path d="M 24,0 C 60,-18 100,16 140,-4 C 155,-12 165,-2 160,8 C 155,16 140,14 142,4 C 144,-4 154,-2 156,2" stroke-width="1.5" />
    <path d="M 45,-3 C 80,-20 115,0 130,-2" stroke-width="0.8" stroke="${COLOR.inkRoyal}" />
  </g>
  `.trim();
}

function buildCornerFlourish(x: number, y: number, scaleX = 1, scaleY = 1): string {
  return `
  <g transform="translate(${x}, ${y}) scale(${scaleX}, ${scaleY})" stroke="${COLOR.inkRoyal}" stroke-width="1" fill="none" opacity="0.75">
    <path d="M 0,40 C 0,15 15,0 40,0" />
    <path d="M 6,34 C 6,18 18,6 34,6" stroke-width="0.6" />
    <circle cx="8" cy="42" r="2" fill="${COLOR.inkNavy}" stroke="none" />
    <circle cx="42" cy="8" r="2" fill="${COLOR.inkNavy}" stroke="none" />
  </g>
  `.trim();
}

/**
 * Builds the player-facing physical card SVG (3.5 x 5 in @ 300dpi = 1050 x 1500 px).
 * 
 * Elegant Invitation Style:
 * - Plain white paper background
 * - Blue ink only (NO black ink anywhere)
 * - Refined Georgia serif invitation typography and delicate calligraphic flourishes
 * - High-contrast blue QR code on white plate with generous quiet zone
 * - Guaranteed to NEVER reveal hidden dollar value, target code text, or placement info
 */
function buildMysteryCardSvg(signalNum: number, signalLabel: string, qrDataUri: string): string {
  const w = 1050;
  const h = 1500;
  const numStr = String(signalNum).padStart(2, '0');

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <!-- Plain White Background -->
  <rect width="${w}" height="${h}" fill="${COLOR.white}" />
  
  <!-- Outer Elegant Invitation Double Border (Blue Ink) -->
  <rect x="44" y="44" width="962" height="1412" rx="6" fill="none" stroke="${COLOR.inkNavy}" stroke-width="2.5" />
  <rect x="56" y="56" width="938" height="1388" rx="4" fill="none" stroke="${COLOR.inkRoyal}" stroke-width="0.8" opacity="0.6" />
  
  <!-- Four Corner Flourishes -->
  ${buildCornerFlourish(64, 64, 1, 1)}
  ${buildCornerFlourish(986, 64, -1, 1)}
  ${buildCornerFlourish(64, 1436, 1, -1)}
  ${buildCornerFlourish(986, 1436, -1, -1)}
  
  <!-- Top Calligraphic Flourish -->
  ${buildFlourish(112, false)}
  
  <!-- Top Organization Header -->
  <text x="525" y="162" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="20" font-weight="bold" letter-spacing="4" fill="${COLOR.inkRoyal}">CANTON QUESTS</text>
  
  <!-- Delicate Divider -->
  <g stroke="${COLOR.inkRoyal}" stroke-width="0.8" opacity="0.5">
    <line x1="380" y1="185" x2="485" y2="185" />
    <polygon points="525,181 529,185 525,189 521,185" fill="${COLOR.inkNavy}" stroke="none" />
    <line x1="565" y1="185" x2="670" y2="185" />
  </g>
  
  <!-- Invitation Continuing Headline -->
  <text x="525" y="230" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="bold" letter-spacing="3" fill="${COLOR.inkNavy}">YOUR INVITATION</text>
  <text x="525" y="270" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="34" font-weight="bold" letter-spacing="4" fill="${COLOR.inkNavy}">CONTINUES</text>
  <text x="525" y="312" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="21" font-style="italic" letter-spacing="1.5" fill="${COLOR.inkRoyal}">Welcome, Cantonians</text>
  
  <!-- Signal Identifier Cartouche -->
  <rect x="295" y="345" width="460" height="48" rx="24" fill="${COLOR.white}" stroke="${COLOR.inkNavy}" stroke-width="1.5" />
  <text x="525" y="378" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="23" font-weight="bold" letter-spacing="2.5" fill="${COLOR.inkNavy}">MYSTERY MONEY SIGNAL ${numStr}</text>
  
  <!-- Invitation Prompt -->
  <text x="525" y="438" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="23" fill="${COLOR.inkNavy}">Scan to enter the Stark County Fair</text>
  <text x="525" y="472" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="26" font-style="italic" font-weight="bold" fill="${COLOR.inkNavy}">Mystery Money Hunt</text>
  <text x="525" y="508" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="18" fill="${COLOR.inkRoyal}">First player to scan claims the secret cash reward.</text>
  
  <!-- QR Plate & Image (White Plate, Blue Modules, Crisp Quiet Zone) -->
  <rect x="270" y="535" width="510" height="510" rx="10" fill="${COLOR.white}" stroke="${COLOR.inkRoyal}" stroke-width="1.5" />
  <rect x="278" y="543" width="494" height="494" rx="8" fill="none" stroke="${COLOR.inkAccent}" stroke-width="0.6" opacity="0.4" />
  <image x="290" y="555" width="470" height="470" href="${qrDataUri}" />
  
  <!-- Future-facing Lore & Adventure Call -->
  <text x="525" y="1105" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="28" font-style="italic" font-weight="bold" fill="${COLOR.inkNavy}">This is only the beginning.</text>
  <text x="525" y="1150" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="${COLOR.inkNavy}">Join Canton Quests for future missions,</text>
  <text x="525" y="1182" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="${COLOR.inkNavy}">secret drops, and live adventures.</text>
  
  <!-- Mid-lower Calligraphic Swirl -->
  <g transform="translate(525, 1228) scale(0.7)" stroke="${COLOR.inkRoyal}" stroke-width="1.2" fill="none">
    <path d="M -80,0 C -50,-12 -25,12 0,0 C 25,-12 50,12 80,0" />
    <polygon points="0,-5 4,0 0,5 -4,0" fill="${COLOR.inkNavy}" stroke="none" />
  </g>
  
  <!-- Domain -->
  <text x="525" y="1290" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="24" font-weight="bold" letter-spacing="4" fill="${COLOR.inkNavy}">${FAIR_PUBLIC_DOMAIN.toUpperCase()}</text>
  
  <!-- Bottom Symmetrical Flourish -->
  ${buildFlourish(1350, true)}
</svg>`.trim();
}

/**
 * Composites 4 cards onto a US Letter sheet (8.5in x 11in @ 300dpi = 2550 x 3300 px)
 * with delicate light blue dashed cut guides.
 */
async function renderSheetPng(
  signalNums: number[],
  cardBuffers: Record<number, Buffer>,
  cardW: number,
  cardH: number,
  outputPath: string,
  sheetNumber: number
) {
  const pageW = Math.round(8.5 * SHEET_DPI); // 2550
  const pageH = Math.round(11.0 * SHEET_DPI); // 3300
  const marginX = SHEET_MARGIN_X_PX; // 150
  const marginY = SHEET_MARGIN_Y_PX; // 100
  const gapX = SHEET_GAP_X_PX; // 150
  const gapY = SHEET_GAP_Y_PX; // 100

  const startNumStr = String(signalNums[0]).padStart(2, '0');
  const endNumStr = String(signalNums[signalNums.length - 1]).padStart(2, '0');

  const cutGuidesSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="${pageW}" height="${pageH}">
    <text x="${pageW / 2}" y="48" text-anchor="middle" font-family="Georgia, serif" font-size="24" font-weight="bold" letter-spacing="3" fill="${COLOR.inkRoyal}">CANTON QUESTS • $300 MYSTERY MONEY HUNT (SHEET ${sheetNumber} OF 5)</text>
    <text x="${pageW / 2}" y="78" text-anchor="middle" font-family="Georgia, serif" font-size="18" font-style="italic" fill="${COLOR.inkAccent}">SIGNALS ${startNumStr}–${endNumStr} • PRINT AT 100% SCALE / ACTUAL SIZE (3.5" × 5" CARDS)</text>
    
    <!-- Outer crop marks and dashed cut lines in delicate light blue -->
    <g stroke="${COLOR.guideLight}" stroke-width="1.5" stroke-dasharray="10,10">
      <!-- Vertical cut line between columns -->
      <line x1="${marginX + cardW + gapX / 2}" y1="88" x2="${marginX + cardW + gapX / 2}" y2="${pageH - 25}" />
      <!-- Horizontal cut line between rows -->
      <line x1="25" y1="${marginY + cardH + gapY / 2}" x2="${pageW - 25}" y2="${marginY + cardH + gapY / 2}" />
      <!-- Left cut guide -->
      <line x1="${marginX}" y1="88" x2="${marginX}" y2="${pageH - 25}" opacity="0.4" />
      <!-- Right cut guide -->
      <line x1="${marginX + 2 * cardW + gapX}" y1="88" x2="${marginX + 2 * cardW + gapX}" y2="${pageH - 25}" opacity="0.4" />
      <!-- Top cut guide -->
      <line x1="25" y1="${marginY}" x2="${pageW - 25}" y2="${marginY}" opacity="0.4" />
      <!-- Bottom cut guide -->
      <line x1="25" y1="${marginY + 2 * cardH + gapY}" x2="${pageW - 25}" y2="${marginY + 2 * cardH + gapY}" opacity="0.4" />
    </g>
  </svg>
  `.trim();

  const composites: OverlayOptions[] = signalNums.map((num, i) => {
    const col = i % CARDS_PER_ROW;
    const row = Math.floor(i / CARDS_PER_ROW);
    return {
      input: cardBuffers[num],
      left: marginX + col * (cardW + gapX),
      top: marginY + row * (cardH + gapY),
    };
  });
  composites.push({ input: Buffer.from(cutGuidesSvg), left: 0, top: 0 });

  await sharp({ create: { width: pageW, height: pageH, channels: 3, background: COLOR.white } })
    .composite(composites)
    .withMetadata({ density: 300 })
    .png()
    .toFile(outputPath);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function main() {
  console.log('===============================================================');
  console.log('CANTON QUESTS — FINAL FAIR PRINT & FIELD DEPLOYMENT GENERATOR');
  console.log('===============================================================');

  // Clean / prepare output directory
  fs.mkdirSync(CARDS_DIR, { recursive: true });
  fs.mkdirSync(SHEETS_DIR, { recursive: true });

  // Clean stale files
  for (const f of fs.readdirSync(CARDS_DIR)) fs.unlinkSync(path.join(CARDS_DIR, f));
  for (const f of fs.readdirSync(SHEETS_DIR)) fs.unlinkSync(path.join(SHEETS_DIR, f));

  // 1. Get canonical manifest filtered strictly to the 20 core signals
  const allCanonical = getCanonicalFairManifest();
  const coreManifest = allCanonical.filter((e) => e.type === 'core');

  if (coreManifest.length !== 20) {
    throw new Error(`Expected exactly 20 core signals, found ${coreManifest.length}`);
  }

  // 2. Fetch live admin overlay (placement notes, claim status)
  const overlay = await fetchLiveAdminOverlay();
  const hasLive = Object.keys(overlay).length > 0;
  console.log(`Loaded 20 Core Signals. Live Supabase Admin Data: ${hasLive ? 'MERGED' : 'LOCAL FALLBACK'}.`);

  // 3. Generate cards, decode verify via jsQR
  const verification: Array<{
    signalNumber: number;
    slug: string;
    targetCode: string;
    expectedUrl: string;
    decodedUrl: string | null;
    roundTripOk: boolean;
    cashValue: number;
  }> = [];

  const cardRasterW = Math.round(CARD_W_IN * SHEET_DPI);
  const cardRasterH = Math.round(CARD_H_IN * SHEET_DPI);
  const cardBuffers: Record<number, Buffer> = {};

  for (let i = 1; i <= 20; i++) {
    const slug = fairCoreQuestSlug(i);
    const entry = coreManifest.find((e) => e.questSlug === slug);
    if (!entry) throw new Error(`Missing canonical entry for ${slug}`);

    const expectedCash = LOCKED_CASH_VALUES[i];
    if (!expectedCash) throw new Error(`Missing locked cash value for Signal ${i}`);

    // Generate QR
    const { buffer: qrBuffer, dataUri: qrDataUri } = await generateQrPngBase64(entry.publicUrl);

    // Round-trip decode verification via jsQR
    const decodedUrl = await decodeQrPng(qrBuffer);
    const roundTripOk = decodedUrl === entry.publicUrl;

    verification.push({
      signalNumber: i,
      slug: entry.questSlug,
      targetCode: entry.code,
      expectedUrl: entry.publicUrl,
      decodedUrl,
      roundTripOk,
      cashValue: expectedCash,
    });

    if (!roundTripOk) {
      throw new Error(`QR verification FAILED for Signal ${i} (${entry.questSlug})! Expected: ${entry.publicUrl}, Decoded: ${decodedUrl}`);
    }

    // Build player-facing card SVG
    const cardSvg = buildMysteryCardSvg(i, entry.signalLabel, qrDataUri);

    // Rasterize high-res card PNG
    const cardPng = await sharp(Buffer.from(cardSvg), { density: SHEET_DPI })
      .resize(cardRasterW, cardRasterH)
      .png()
      .toBuffer();

    cardBuffers[i] = cardPng;

    // Save individual card named signal-01.png ... signal-20.png
    const cardFileName = `signal-${String(i).padStart(2, '0')}.png`;
    fs.writeFileSync(path.join(CARDS_DIR, cardFileName), cardPng);

    // Verify direct decoding from the final card PNG itself
    const directCardDecoded = await decodeQrPng(cardPng);
    if (directCardDecoded !== entry.publicUrl) {
      throw new Error(`Direct card PNG decode FAILED for Signal ${i}! Expected: ${entry.publicUrl}, Decoded: ${directCardDecoded}`);
    }
  }

  console.log(`Generated 20 individual Signal cards in output/fair-qr-print/cards/ (all QR decodes verified: 20/20 PASS).`);

  // 4. Generate 5 Sheets (4 cards per sheet = 20 cards), matching the 4x5 board layout
  const signalNumbers = Array.from({ length: 20 }, (_, i) => i + 1);
  const sheetPages = chunk(signalNumbers, CARDS_PER_SHEET); // 5 sheets of 4 cards

  for (let s = 0; s < sheetPages.length; s++) {
    const sheetNum = s + 1;
    const pageSignals = sheetPages[s];
    const sheetPath = path.join(SHEETS_DIR, `sheet-${sheetNum}.png`);
    await renderSheetPng(pageSignals, cardBuffers, cardRasterW, cardRasterH, sheetPath, sheetNum);
  }
  console.log(`Generated 5 printable US Letter cut sheets in output/fair-qr-print/sheets/ (4 cards/sheet, 300dpi).`);

  // 5. Generate Private Admin Master Deployment Sheet (Fixed 4x5 Board + Details Table)
  const masterData = signalNumbers.map((num) => {
    const slug = fairCoreQuestSlug(num);
    const entry = coreManifest.find((e) => e.questSlug === slug)!;
    const live = overlay[slug];
    const cashValue = LOCKED_CASH_VALUES[num];

    const gmNotes = (live?.gmNotes || '').trim();
    const placementNote = gmNotes || PLACEMENT_NOTE_PLACEHOLDER;
    const status = live?.status || 'active';
    const placedAt = live?.placedAt || undefined;
    const depStatus = getDeploymentStatus({ status, gmNotes, placedAt });

    return {
      number: num,
      numStr: String(num).padStart(2, '0'),
      slug,
      targetCode: entry.code,
      publicUrl: entry.publicUrl,
      cashValue,
      deploymentStatus: depStatus,
      placementNote,
      placementDetails: live?.placementDetails || null,
      placedAt,
      isClaimed: live?.isClaimed ?? false,
      finder: live?.finderDisplayName || '—',
      claimedAt: live?.claimedAt || '—',
    };
  });

  // Write ADMIN-MASTER-DEPLOYMENT-SHEET.md
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'ADMIN-MASTER-DEPLOYMENT-SHEET.md'), buildAdminMasterMarkdown(masterData));

  // Write admin-master-deployment-sheet.html (formatted for print or offline tablet use)
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'admin-master-deployment-sheet.html'), buildAdminMasterHtml(masterData));

  // Write verification-report.json
  fs.writeFileSync(
    path.join(OUTPUT_ROOT, 'verification-report.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalCards: 20,
        totalPool: '$300.00',
        totalPoolCents: 30000,
        bonusCardsIncluded: 0,
        allUniqueCodes: new Set(masterData.map((d) => d.targetCode)).size === 20,
        allUniqueUrls: new Set(masterData.map((d) => d.publicUrl)).size === 20,
        allUrlsValidProductionHttps: masterData.every((d) => d.publicUrl.startsWith(`https://${FAIR_PUBLIC_DOMAIN}/qr/`)),
        noLocalhost: masterData.every((d) => !d.publicUrl.includes('localhost')),
        noVercelPreview: masterData.every((d) => !d.publicUrl.includes('.vercel.app')),
        roundTripDecodes: verification,
      },
      null,
      2
    )
  );

  // Write README.md with field instructions
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'README.md'), buildReadmeMarkdown());

  console.log('===============================================================');
  console.log('PRINT PACKAGE REGENERATION COMPLETE.');
  console.log(`Output Directory: ${OUTPUT_ROOT}`);
  console.log('===============================================================');
}

function buildAdminMasterMarkdown(signals: Array<any>): string {
  const lines: string[] = [];
  lines.push('# Canton Quests — Stark County Fair $300 Mystery Money Hunt');
  lines.push('## PRIVATE ADMIN MASTER DEPLOYMENT SHEET');
  lines.push('');
  lines.push('> **STRICTLY CONFIDENTIAL — FOR GAME MASTER & DEPLOYMENT STAFF ONLY.**');
  lines.push('> Never show or share this sheet with players. Cash values must remain hidden until claimed.');
  lines.push('');
  lines.push(`- **Total Cash Pool**: $300.00 across 20 Signals`);
  lines.push(`- **Event**: Canton Quests: Fair QR Hunt (\`fair-qr-hunt\`)`);
  lines.push(`- **Generated**: ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### 4x5 Board Overview (Fixed Arrangement & Values)');
  lines.push('');
  lines.push('| Col 1 | Col 2 | Col 3 | Col 4 |');
  lines.push('|:---:|:---:|:---:|:---:|');

  const rows = chunk(signals, 4);
  for (const r of rows) {
    lines.push(`| **Signal ${r[0].numStr}**<br/>\`$${r[0].cashValue}\` | **Signal ${r[1].numStr}**<br/>\`$${r[1].cashValue}\` | **Signal ${r[2].numStr}**<br/>\`$${r[2].cashValue}\` | **Signal ${r[3].numStr}**<br/>\`$${r[3].cashValue}\` |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### Field Deployment Checklist & Verification Table');
  lines.push('');
  lines.push('| Sig # | Prize | Target Code | Quest Slug | Deployment | Placed At | Physical Placement Location / GM Notes | Status | Winner |');
  lines.push('|:---:|:---:|:---:|:---:|:---:|:---:|:---|:---:|:---:|');

  for (const s of signals) {
    const loc = s.placementDetails?.description || s.placementNote;
    const placed = s.placedAt ? s.placedAt.slice(11, 16) : 'TBD';
    const claimStatus = s.isClaimed ? 'FOUND' : 'UNFOUND';
    lines.push(`| **${s.numStr}** | **$${s.cashValue}** | \`${s.targetCode}\` | \`${s.slug}\` | \`${s.deploymentStatus}\` | ${placed} | ${loc} | **${claimStatus}** | ${s.finder} |`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('### Production QR Destination Proofs');
  lines.push('');
  for (const s of signals) {
    lines.push(`- **Signal ${s.numStr}** (\`$${s.cashValue}\`): \`${s.publicUrl}\` -> maps to \`${s.slug}\` (\`${s.targetCode}\`)`);
  }

  return lines.join('\n');
}

function buildAdminMasterHtml(signals: Array<any>): string {
  const rows = chunk(signals, 4);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Canton Quests — Fair Mystery Money Master Sheet</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #111; color: #eee; padding: 24px; margin: 0; }
    h1 { color: #d9a44c; margin: 0 0 4px 0; font-size: 24px; }
    h2 { color: #22d3ee; margin: 0 0 16px 0; font-size: 16px; font-weight: normal; }
    .banner { background: #2a1b04; border: 1px solid #d9a44c; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; font-size: 13px; color: #f5c97a; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .tile { background: #1c1f22; border: 1px solid #333; border-radius: 8px; padding: 12px; text-align: center; }
    .tile-num { font-size: 14px; font-weight: bold; color: #fff; margin-bottom: 4px; }
    .tile-val { font-size: 20px; font-weight: 900; color: #22c55e; }
    .tile-code { font-size: 10px; font-family: monospace; color: #888; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 16px; }
    th { background: #222; color: #d9a44c; text-align: left; padding: 8px 10px; border-bottom: 2px solid #444; }
    td { padding: 8px 10px; border-bottom: 1px solid #282828; }
    tr:nth-child(even) { background: #16181a; }
    .unfound { color: #f59e0b; font-weight: bold; }
    .found { color: #10b981; font-weight: bold; }
    @media print {
      body { background: #fff; color: #000; padding: 10px; }
      .tile { background: #f9f9f9; border-color: #ccc; }
      .tile-num { color: #000; }
      .tile-val { color: #059669; }
      th { background: #f0f0f0; color: #000; border-color: #000; }
      td { border-color: #ddd; }
      tr:nth-child(even) { background: #fafafa; }
    }
  </style>
</head>
<body>
  <h1>CANTON QUESTS — $300 MYSTERY MONEY HUNT</h1>
  <h2>PRIVATE ADMIN FIELD DEPLOYMENT & VERIFICATION MASTER SHEET</h2>
  <div class="banner">
    <strong>CONFIDENTIAL:</strong> Admin-only deployment reference for Stark County Fair. Shows locked hidden values and target codes. Never share with players.
  </div>

  <div class="grid">
    ${signals
      .map(
        (s) => `
      <div class="tile">
        <div class="tile-num">SIGNAL ${s.numStr}</div>
        <div class="tile-val">$${s.cashValue}</div>
        <div class="tile-code">${s.targetCode}</div>
      </div>`
      )
      .join('')}
  </div>

  <table>
    <thead>
      <tr>
        <th>Signal</th>
        <th>Prize</th>
        <th>Target Code</th>
        <th>Deployment Status</th>
        <th>Physical Placement Notes</th>
        <th>State</th>
        <th>Finder</th>
      </tr>
    </thead>
    <tbody>
      ${signals
        .map(
          (s) => `
      <tr>
        <td><strong>Signal ${s.numStr}</strong></td>
        <td style="color: #22c55e; font-weight: bold;">$${s.cashValue}</td>
        <td><code>${s.targetCode}</code></td>
        <td>${s.deploymentStatus}</td>
        <td>${s.placementDetails?.description || s.placementNote}</td>
        <td class="${s.isClaimed ? 'found' : 'unfound'}">${s.isClaimed ? 'FOUND' : 'UNFOUND'}</td>
        <td>${s.finder}</td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
</body>
</html>`;
}

function buildReadmeMarkdown(): string {
  return `# Canton Quests — Stark County Fair Mystery Money Print & Field Package

This directory contains the **FINAL production-ready physical QR package** for the **$300 Mystery Money Hunt** at the Stark County Fair.

---

## Package Contents

\`\`\`
output/fair-qr-print/
├── cards/
│   ├── signal-01.png          # Individual high-res 300dpi card (Signal 01)
│   ├── ...
│   └── signal-20.png          # Individual high-res 300dpi card (Signal 20)
├── sheets/
│   ├── sheet-1.png            # Cut Sheet 1 (Signals 01–04) — US Letter @ 300dpi
│   ├── sheet-2.png            # Cut Sheet 2 (Signals 05–08) — US Letter @ 300dpi
│   ├── sheet-3.png            # Cut Sheet 3 (Signals 09–12) — US Letter @ 300dpi
│   ├── sheet-4.png            # Cut Sheet 4 (Signals 13–16) — US Letter @ 300dpi
│   └── sheet-5.png            # Cut Sheet 5 (Signals 17–20) — US Letter @ 300dpi
├── ADMIN-MASTER-DEPLOYMENT-SHEET.md   # Private GM reference (locked values + locations)
├── admin-master-deployment-sheet.html # Printable private reference table
├── verification-report.json           # Automated 20/20 round-trip QR decode validation
└── README.md                          # This deployment guide
\`\`\`

---

## Locked Prize Structure ($300 Total)

The 20 Signals have fixed, locked cash prizes in a 4x5 board layout:

\`\`\`
01: $50  |  02: $5   |  03: $20  |  04: $5
05: $10  |  06: $15  |  07: $20  |  08: $30
09: $10  |  10: $15  |  11: $30  |  12: $15
13: $5   |  14: $15  |  15: $5   |  16: $20
17: $10  |  18: $10  |  19: $5   |  20: $5
\`\`\`

- **6 x $5** ($30)
- **4 x $10** ($40)
- **4 x $15** ($60)
- **3 x $20** ($60)
- **2 x $30** ($60)
- **1 x $50** ($50)
- **Total: $300.00**

---

## Field Deployment Checklist (For Dustin)

1. **Print All 5 Sheets**:
   - Open \`sheets/sheet-1.png\` through \`sheets/sheet-5.png\`.
   - Print at **Actual Size / 100% Scale** on standard US Letter cardstock.
   - Do **NOT** select "Fit to Page" (this prevents QR shrinking).
   - Cut along dashed lines to produce exactly 20 cards (3.7" x 4.75" each).

2. **Camera Scan-Test Each Card (WITHOUT Claiming)**:
   - Use your smartphone camera to point at each printed card.
   - Confirm it prompts to open \`https://www.cantonquests.com/qr/FAIR-C...\`.
   - **DO NOT tap Claim** or authenticate during testing so Signals remain unfound.

3. **Match Card Number to Private Master Sheet**:
   - Keep \`ADMIN-MASTER-DEPLOYMENT-SHEET.md\` or \`admin-master-deployment-sheet.html\` on your phone or clipboard.
   - Confirm you are placing the intended Signal number in its designated physical zone.

4. **Record Physical Placement**:
   - Place card securely in fairground public areas (under posted rules, on partner booths, railings, etc.).
   - Note exact location details.

5. **Mark PLACED in GM Control Room**:
   - On \`https://www.cantonquests.com/admin/fair-qr\`, confirm each Signal is marked **PLACED**.

6. **Strict Operational Security**:
   - **NEVER** photograph or post unclaimed QR cards online or to social media.
   - Anyone scanning a photo will instantly win and retire that Signal from the field.

7. **Verify Public Board**:
   - Open \`https://www.cantonquests.com/events/fair-qr-hunt\`.
   - Verify the board displays **20 Unfound Signals** ($???), **$300 Total Cash Pool**, and **0 Found**.

8. **Keep Master Sheet Confidential**:
   - Never show the dollar values sheet to anyone outside the operations team!
`;
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith('generate-fair-qr-print-package.ts') ||
    process.argv[1].endsWith('generate-fair-qr-print-package.js'))
) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
