import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import jsQR from 'jsqr';
import {
  createCampaignDistributor,
  createCampaignFlyerVariant,
  createQrCampaign,
  generateCampaignQrCodes,
  resetCampaignStore,
  setCampaignQrCodeStatus,
} from '../lib/qr-campaigns';
import {
  classifyFlyerType,
  findMasterFile,
  formatFlyerFilename,
  generateCampaignFlyers,
  generateQrCodeBuffer,
  getActiveCampaignAssignments,
  FLYER_PLACEMENT_CONFIGS,
} from '../lib/qr-flyer-generator';
import { runQrCampaignCli } from '../scripts/qr-campaign-cli';

describe('QR Campaign Promotional Flyer Generator', () => {
  let tempDir: string;
  let mockMastersDir: string;
  let mockOutputDir: string;

  beforeEach(async () => {
    resetCampaignStore();
    delete process.env.NEXT_PUBLIC_SITE_URL;

    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cq-flyer-test-'));
    mockMastersDir = path.join(tempDir, 'masters');
    mockOutputDir = path.join(tempDir, 'output');

    fs.mkdirSync(mockMastersDir, { recursive: true });

    // Create mock master images matching dimensions of real artwork
    await sharp({
      create: {
        width: 500,
        height: 729,
        channels: 4,
        background: { r: 20, g: 100, b: 40, alpha: 1 },
      },
    })
      .png()
      .toFile(path.join(mockMastersDir, 'Family_Flyer_Master.png'));

    await sharp({
      create: {
        width: 500,
        height: 728,
        channels: 4,
        background: { r: 180, g: 30, b: 30, alpha: 1 },
      },
    })
      .png()
      .toFile(path.join(mockMastersDir, 'Challenge_Flyer_Master.png'));

    await sharp({
      create: {
        width: 500,
        height: 729,
        channels: 4,
        background: { r: 80, g: 40, b: 120, alpha: 1 },
      },
    })
      .png()
      .toFile(path.join(mockMastersDir, 'Secret_Flyer_Master.png'));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  async function createTestCampaignWith9Qrs() {
    const campaign = await createQrCampaign({
      name: 'Test Street Team 2026',
      destinationUrl: '/start/family',
    });

    const flyers = await Promise.all([
      createCampaignFlyerVariant({ campaignId: campaign.id, name: 'Family' }),
      createCampaignFlyerVariant({ campaignId: campaign.id, name: 'Challenge' }),
      createCampaignFlyerVariant({ campaignId: campaign.id, name: 'Secret' }),
    ]);

    const distributors = await Promise.all([
      createCampaignDistributor({ campaignId: campaign.id, name: 'Dustin' }),
      createCampaignDistributor({ campaignId: campaign.id, name: 'Employee 1' }),
      createCampaignDistributor({ campaignId: campaign.id, name: 'Employee 2' }),
    ]);

    const destinationUrlByFlyerVariantId: Record<string, string> = {
      [flyers[0].id]: '/start/family',
      [flyers[1].id]: '/start/challenge',
      [flyers[2].id]: '/start/secret',
    };

    const qrCodes = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: flyers.map((f) => f.id),
      distributorIds: distributors.map((d) => d.id),
      destinationUrlByFlyerVariantId,
    });

    return { campaign, flyers, distributors, qrCodes };
  }

  it('1. Family master routing routes Family variant names correctly', () => {
    expect(classifyFlyerType('Family')).toBe('family');
    expect(classifyFlyerType('family-edition')).toBe('family');
    expect(classifyFlyerType('Flyer A (Family)')).toBe('family');

    const masterPath = findMasterFile(mockMastersDir, 'family');
    expect(path.basename(masterPath)).toBe('Family_Flyer_Master.png');
    expect(FLYER_PLACEMENT_CONFIGS.family.displayName).toBe('Family');
    expect(FLYER_PLACEMENT_CONFIGS.family.box).toEqual({ left: 343, top: 514, width: 127, height: 129 });
  });

  it('2. Challenge master routing routes Challenge variant names correctly', () => {
    expect(classifyFlyerType('Challenge')).toBe('challenge');
    expect(classifyFlyerType('Downtown Challenge')).toBe('challenge');
    expect(classifyFlyerType('Flyer B - Challenge')).toBe('challenge');

    const masterPath = findMasterFile(mockMastersDir, 'challenge');
    expect(path.basename(masterPath)).toBe('Challenge_Flyer_Master.png');
    expect(FLYER_PLACEMENT_CONFIGS.challenge.displayName).toBe('Challenge');
    expect(FLYER_PLACEMENT_CONFIGS.challenge.box).toEqual({ left: 313, top: 504, width: 155, height: 143 });
  });

  it('3. Secret master routing routes Secret variant names correctly', () => {
    expect(classifyFlyerType('Secret')).toBe('secret');
    expect(classifyFlyerType('Secret Quest Variant')).toBe('secret');
    expect(classifyFlyerType('Flyer C (Secret) ')).toBe('secret');

    const masterPath = findMasterFile(mockMastersDir, 'secret');
    expect(path.basename(masterPath)).toBe('Secret_Flyer_Master.png');
    expect(FLYER_PLACEMENT_CONFIGS.secret.displayName).toBe('Secret');
    expect(FLYER_PLACEMENT_CONFIGS.secret.box).toEqual({ left: 305, top: 484, width: 138, height: 138 });
  });

  it('4. URL -> QR generation produces high quality scanable QR code buffers', async () => {
    const testUrl = 'https://www.divinedesigndestinations.com/go/canton-quests-street-team-2026-family-dustin-9ad7f4';
    const qrBuffer = await generateQrCodeBuffer(testUrl, 150);

    expect(qrBuffer).toBeInstanceOf(Buffer);
    expect(qrBuffer.length).toBeGreaterThan(100);

    const image = sharp(qrBuffer);
    const metadata = await image.metadata();
    expect(metadata.width).toBe(150);
    expect(metadata.height).toBe(150);

    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const clamped = new Uint8ClampedArray(data);
    const decoded = jsQR(clamped, info.width, info.height);

    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(testUrl);
  });

  it('5. output naming generates deterministic, clean, filesystem-safe filenames', () => {
    expect(formatFlyerFilename(1, 'Family', 'Dustin')).toBe('01-family-dustin.png');
    expect(formatFlyerFilename(2, 'Challenge', 'Steve / Partner #1')).toBe('02-challenge-steve-partner-1.png');
    expect(formatFlyerFilename(3, 'Secret', 'Employee 2')).toBe('03-secret-employee-2.png');
    expect(formatFlyerFilename(12, 'Family', 'Special & Character')).toBe('12-family-special-character.png');
  });

  it('6. unknown flyer type fails closed', () => {
    expect(() => classifyFlyerType('Mystery Box')).toThrow(/Unknown flyer type/i);
    expect(() => classifyFlyerType('Random 123')).toThrow(/Unknown flyer type/i);
  });

  it('7. missing master artwork file fails closed', () => {
    const emptyDir = path.join(tempDir, 'empty_masters');
    fs.mkdirSync(emptyDir);

    expect(() => findMasterFile(emptyDir, 'family')).toThrow(/Missing master flyer artwork/i);
    expect(() => findMasterFile(path.join(tempDir, 'non_existent_dir'), 'family')).toThrow(/directory not found/i);
  });

  it('8. number of exported flyers equals number of active campaign QR assignments', async () => {
    const { campaign } = await createTestCampaignWith9Qrs();

    const result = await generateCampaignFlyers({
      campaignIdentifier: campaign.id,
      mastersDir: mockMastersDir,
      outputDir: mockOutputDir,
    });

    expect(result.activeAssignmentsCount).toBe(9);
    expect(result.flyersGeneratedCount).toBe(9);
    expect(result.countsByType.family).toBe(3);
    expect(result.countsByType.challenge).toBe(3);
    expect(result.countsByType.secret).toBe(3);

    const generatedFiles = fs.readdirSync(mockOutputDir);
    const pngs = generatedFiles.filter((f) => f.endsWith('.png'));
    expect(pngs).toHaveLength(9);
    expect(generatedFiles).toContain('manifest.csv');
  });

  it('9. deactivating a QR code reduces the number of exported flyers accordingly', async () => {
    const { campaign, qrCodes } = await createTestCampaignWith9Qrs();

    // Deactivate 2 QR codes
    await setCampaignQrCodeStatus(qrCodes[0].id, 'inactive');
    await setCampaignQrCodeStatus(qrCodes[1].id, 'inactive');

    const activeAssignments = await getActiveCampaignAssignments(campaign.id);
    expect(activeAssignments).toHaveLength(7);

    const result = await generateCampaignFlyers({
      campaignIdentifier: campaign.id,
      mastersDir: mockMastersDir,
      outputDir: mockOutputDir,
    });

    expect(result.activeAssignmentsCount).toBe(7);
    expect(result.flyersGeneratedCount).toBe(7);
    const pngs = fs.readdirSync(mockOutputDir).filter((f) => f.endsWith('.png'));
    expect(pngs).toHaveLength(7);
  });

  it('10. manifest.csv is properly formatted and contains all required columns and rows', async () => {
    const { campaign } = await createTestCampaignWith9Qrs();

    const result = await generateCampaignFlyers({
      campaignIdentifier: campaign.id,
      mastersDir: mockMastersDir,
      outputDir: mockOutputDir,
    });

    const manifestContent = fs.readFileSync(result.manifestPath, 'utf-8');
    const lines = manifestContent.trim().split('\n');

    expect(lines[0]).toBe('index,campaign,qr_id,status,type,label/name,slug,url,master,output_file');
    expect(lines).toHaveLength(10); // 1 header + 9 rows

    // Check first data line contains valid values
    expect(lines[1]).toContain(campaign.name);
    expect(lines[1]).toContain('Family');
    expect(lines[1]).toContain('Dustin');
    expect(lines[1]).toContain('01-family-dustin.png');
  });

  it('11. master artwork dimensions are strictly preserved in exported flyers', async () => {
    const { campaign } = await createTestCampaignWith9Qrs();

    await generateCampaignFlyers({
      campaignIdentifier: campaign.id,
      mastersDir: mockMastersDir,
      outputDir: mockOutputDir,
    });

    const familyMeta = await sharp(path.join(mockOutputDir, '01-family-dustin.png')).metadata();
    expect(familyMeta.width).toBe(500);
    expect(familyMeta.height).toBe(729);

    const challengeMeta = await sharp(path.join(mockOutputDir, '04-challenge-dustin.png')).metadata();
    expect(challengeMeta.width).toBe(500);
    expect(challengeMeta.height).toBe(728);

    const secretMeta = await sharp(path.join(mockOutputDir, '07-secret-dustin.png')).metadata();
    expect(secretMeta.width).toBe(500);
    expect(secretMeta.height).toBe(729);
  });

  it('12. CLI command generates flyers and prints the expected summary output', async () => {
    await createTestCampaignWith9Qrs();
    const lines: string[] = [];

    const exitCode = await runQrCampaignCli(
      [
        'flyers',
        '--campaign',
        'Test Street Team 2026',
        '--masters',
        mockMastersDir,
        '--output',
        mockOutputDir,
      ],
      { stdout: (line) => lines.push(line), stderr: (line) => lines.push(line) }
    );

    expect(exitCode).toBe(0);
    const output = lines.join('\n');
    expect(output).toContain('===== FLYER GENERATION COMPLETE =====');
    expect(output).toContain('Campaign: Test Street Team 2026');
    expect(output).toContain('Active QR assignments: 9');
    expect(output).toContain('Flyers generated: 9');
    expect(output).toContain('Family: 3');
    expect(output).toContain('Challenge: 3');
    expect(output).toContain('Secret: 3');
    expect(output).toContain(mockOutputDir);
  });
});
