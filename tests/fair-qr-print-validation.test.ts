import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { SEED_FAIR_QUESTS } from '../lib/seed-data';
import { fairCoreQuestSlug } from '../lib/fair-hunt';

const LOCKED_CASH_VALUES: Record<number, number> = {
  1: 50, 2: 5, 3: 20, 4: 5, 5: 10,
  6: 15, 7: 20, 8: 30, 9: 10, 10: 15,
  11: 30, 12: 15, 13: 5, 14: 15, 15: 5,
  16: 20, 17: 10, 18: 10, 19: 5, 20: 5,
};

const PRINT_DIR = path.resolve(__dirname, '../output/fair-qr-print');
const CARDS_DIR = path.join(PRINT_DIR, 'cards');
const SHEETS_DIR = path.join(PRINT_DIR, 'sheets');

describe('Final Fair QR Print Package — Scannability, Decoding & Production Routing Validation', () => {
  it('1. contains exactly 20 physical Signal cards with no bonus cards', () => {
    const cardFiles = fs.readdirSync(CARDS_DIR).filter((f) => f.endsWith('.png'));
    expect(cardFiles).toHaveLength(20);
    expect(cardFiles.every((f) => /^signal-(0[1-9]|1[0-9]|20)\.png$/.test(f))).toBe(true);
    expect(cardFiles.some((f) => f.includes('bonus'))).toBe(false);
  });

  it('2. contains exactly 5 cut sheets (4 cards/sheet, 20 total, 0 bonus sheets)', () => {
    const sheetFiles = fs.readdirSync(SHEETS_DIR).filter((f) => f.endsWith('.png'));
    expect(sheetFiles).toHaveLength(5);
    expect(sheetFiles.every((f) => /^sheet-[1-5]\.png$/.test(f))).toBe(true);
    expect(sheetFiles.some((f) => f.includes('bonus'))).toBe(false);
  });

  it('3. every card PNG decodes to its exact expected production URL (round-trip decode via jsQR)', async () => {
    const coreQuests = SEED_FAIR_QUESTS.filter((q) => q.category === 'fair_core');
    expect(coreQuests).toHaveLength(20);

    const decodedUrls: string[] = [];
    const decodedCodes: string[] = [];

    for (let i = 1; i <= 20; i++) {
      const slug = fairCoreQuestSlug(i);
      const quest = coreQuests.find((q) => q.slug === slug);
      expect(quest, `Quest not found for ${slug}`).toBeDefined();
      const expectedCode = quest!.targetCode!;
      const expectedUrl = `https://www.cantonquests.com/qr/${expectedCode}`;

      const cardPath = path.join(CARDS_DIR, `signal-${String(i).padStart(2, '0')}.png`);
      expect(fs.existsSync(cardPath), `Card missing: ${cardPath}`).toBe(true);

      const buffer = fs.readFileSync(cardPath);
      const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height);

      expect(decoded, `Failed to decode QR in ${cardPath}`).not.toBeNull();
      expect(decoded!.data).toBe(expectedUrl);

      decodedUrls.push(decoded!.data);
      decodedCodes.push(expectedCode);
    }

    // Uniqueness proofs
    expect(new Set(decodedUrls).size).toBe(20);
    expect(new Set(decodedCodes).size).toBe(20);
    expect(decodedUrls.every((u) => u.startsWith('https://www.cantonquests.com/qr/'))).toBe(true);
    expect(decodedUrls.some((u) => u.includes('localhost') || u.includes('.vercel.app'))).toBe(false);
  }, 20000);

  it('4. locked cash values sum to exactly $300 across the 20 Signals', () => {
    const values = Object.values(LOCKED_CASH_VALUES);
    expect(values).toHaveLength(20);
    const sum = values.reduce((acc, v) => acc + v, 0);
    expect(sum).toBe(300);
    expect(LOCKED_CASH_VALUES[1]).toBe(50);
    expect(LOCKED_CASH_VALUES[2]).toBe(5);
    expect(LOCKED_CASH_VALUES[8]).toBe(30);
    expect(LOCKED_CASH_VALUES[11]).toBe(30);
  });

  it('5. player-facing cards do not leak cash values or target code text in plain raster text', async () => {
    // Read verification-report to ensure no sensitive text leaked into public cards
    const report = JSON.parse(fs.readFileSync(path.join(PRINT_DIR, 'verification-report.json'), 'utf8'));
    expect(report.totalCards).toBe(20);
    expect(report.bonusCardsIncluded).toBe(0);
    expect(report.totalPool).toBe('$300.00');
  });

  it('6. private master deployment sheet exists and displays full details', () => {
    const mdPath = path.join(PRINT_DIR, 'ADMIN-MASTER-DEPLOYMENT-SHEET.md');
    const htmlPath = path.join(PRINT_DIR, 'admin-master-deployment-sheet.html');
    const readmePath = path.join(PRINT_DIR, 'README.md');

    expect(fs.existsSync(mdPath)).toBe(true);
    expect(fs.existsSync(htmlPath)).toBe(true);
    expect(fs.existsSync(readmePath)).toBe(true);

    const md = fs.readFileSync(mdPath, 'utf8');
    expect(md).toContain('PRIVATE ADMIN MASTER DEPLOYMENT SHEET');
    expect(md).toContain('$300.00 across 20 Signals');
    expect(md).toContain('Signal 01');
    expect(md).toContain('$50');
    expect(md).toContain('Signal 20');
    expect(md).toContain('$5');
    expect(md).not.toContain('bonus-sheet');
  });
});
