import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { cqBrand, cqImages, CQ_BRAND_PATH } from '@/lib/marketing-assets';

describe('Canton Quests — Official Brand Identity Standardization', () => {
  const rootDir = process.cwd();
  const brandDir = path.join(rootDir, 'public', 'brand');

  it('verifies that the canonical master logo exists and is non-empty', () => {
    const masterPath = path.join(brandDir, 'canton-quests-master-logo.png');
    expect(fs.existsSync(masterPath)).toBe(true);
    const stats = fs.statSync(masterPath);
    expect(stats.size).toBeGreaterThan(100000); // Master image is high-resolution (>100KB)
  });

  it('verifies all required deterministic derived assets exist in public/brand', () => {
    const requiredAssets = [
      'canton-quests-master-logo.png',
      'canton-quests-mark.png',
      'canton-quests-mark-512.png',
      'canton-quests-mark-192.png',
      'canton-quests-apple-touch-icon.png',
      'favicon.ico',
      'canton-quests-og.png',
    ];

    for (const assetName of requiredAssets) {
      const assetPath = path.join(brandDir, assetName);
      expect(fs.existsSync(assetPath), `Missing brand asset: ${assetName}`).toBe(true);
      const stats = fs.statSync(assetPath);
      expect(stats.size).toBeGreaterThan(0);
    }
  });

  it('verifies root favicon.ico exists and is non-empty', () => {
    const rootFavicon = path.join(rootDir, 'public', 'favicon.ico');
    expect(fs.existsSync(rootFavicon)).toBe(true);
    expect(fs.statSync(rootFavicon).size).toBeGreaterThan(0);
  });

  it('verifies cqBrand in marketing-assets.ts points to canonical paths', () => {
    expect(CQ_BRAND_PATH).toBe('/brand');
    expect(cqBrand.masterLogo).toBe('/brand/canton-quests-master-logo.png');
    expect(cqBrand.mark).toBe('/brand/canton-quests-mark.png');
    expect(cqBrand.mark512).toBe('/brand/canton-quests-mark-512.png');
    expect(cqBrand.mark192).toBe('/brand/canton-quests-mark-192.png');
    expect(cqBrand.appleTouchIcon).toBe('/brand/canton-quests-apple-touch-icon.png');
    expect(cqBrand.favicon).toBe('/brand/favicon.ico');
    expect(cqBrand.ogImage).toBe('/brand/canton-quests-og.png');

    // Legacy helpers should also route to canonical brand assets
    expect(cqImages.logoNav).toBe(cqBrand.masterLogo);
    expect(cqImages.badge).toBe(cqBrand.mark);
  });

  it('verifies public/manifest.json is valid and uses brand mark icons', () => {
    const manifestPath = path.join(rootDir, 'public', 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(content.name).toBe('Canton Quests');
    expect(content.icons).toBeInstanceOf(Array);
    expect(content.icons.length).toBeGreaterThanOrEqual(2);

    const iconSrcs = content.icons.map((icon: { src: string }) => icon.src);
    expect(iconSrcs).toContain('/brand/canton-quests-mark-192.png');
    expect(iconSrcs).toContain('/brand/canton-quests-mark-512.png');
  });

  it('verifies legacy placeholder logo files are not in public/canton-quests', () => {
    const legacyFiles = [
      path.join(rootDir, 'public', 'canton-quests', '01b_primary_logo_transparent.png'),
      path.join(rootDir, 'public', 'canton-quests', '02b_round_badge_transparent.png'),
      path.join(rootDir, 'public', 'canton-quests', '03b_navbar_logo_transparent.png'),
    ];

    for (const legacyPath of legacyFiles) {
      expect(fs.existsSync(legacyPath), `Legacy file still in active directory: ${legacyPath}`).toBe(false);
    }
  });

  it('verifies PROJECT-BRAIN.md and DECISIONS.md document the official brand rule', () => {
    const brainContent = fs.readFileSync(path.join(rootDir, 'PROJECT-BRAIN.md'), 'utf-8');
    expect(brainContent).toContain('public/brand/canton-quests-master-logo.png');
    expect(brainContent).toContain('Canonical Brand Rule');

    const decisionsContent = fs.readFileSync(path.join(rootDir, 'DECISIONS.md'), 'utf-8');
    expect(decisionsContent).toContain('ADR-019');
    expect(decisionsContent).toContain('canton-quests-master-logo.png');
  });
});
