import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { findCampaignByNameOrId, getCampaignBundle } from './qr-campaigns';
import { CampaignDistributor, CampaignFlyerVariant, CampaignQrCode, QrCampaign } from './types';

export type FlyerMasterType = 'family' | 'challenge' | 'secret';

export interface FlyerPlacementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlyerPlacementConfig {
  type: FlyerMasterType;
  displayName: string;
  box: FlyerPlacementBox;
  qrSize: number;
  qrLeft: number;
  qrTop: number;
  expectedMasterBasename: string;
}

/**
 * Deterministic QR placement configurations for the three master flyers.
 * Dimensions and coordinates correspond directly to the solid white placement boxes
 * located on the master artwork:
 * - Challenge: 500x728 (white box: left=313, top=504, width=155, height=143, center=(390, 575))
 * - Family:    500x729 (white box: left=343, top=514, width=127, height=129, center=(406, 578))
 * - Secret:    500x729 (white box: left=305, top=484, width=138, height=138, center=(374, 553))
 */
export const FLYER_PLACEMENT_CONFIGS: Record<FlyerMasterType, FlyerPlacementConfig> = {
  family: {
    type: 'family',
    displayName: 'Family',
    box: { left: 343, top: 514, width: 127, height: 129 },
    qrSize: 121,
    qrLeft: 346,
    qrTop: 518,
    expectedMasterBasename: 'Family_Flyer_Master',
  },
  challenge: {
    type: 'challenge',
    displayName: 'Challenge',
    box: { left: 313, top: 504, width: 155, height: 143 },
    qrSize: 138,
    qrLeft: 321,
    qrTop: 506,
    expectedMasterBasename: 'Challenge_Flyer_Master',
  },
  secret: {
    type: 'secret',
    displayName: 'Secret',
    box: { left: 305, top: 484, width: 138, height: 138 },
    qrSize: 132,
    qrLeft: 308,
    qrTop: 487,
    expectedMasterBasename: 'Secret_Flyer_Master',
  },
};

export function expandPath(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (trimmed === '~' || trimmed.startsWith('~/')) {
    return path.resolve(os.homedir(), trimmed.slice(2));
  }
  return path.resolve(trimmed);
}

export function slugifyText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'assignment';
}

export function classifyFlyerType(flyerName: string): FlyerMasterType {
  const normalized = flyerName.trim().toLowerCase();
  if (/\b(a|family)\b/.test(normalized) || normalized.includes('family')) {
    return 'family';
  }
  if (/\b(b|challenge)\b/.test(normalized) || normalized.includes('challenge')) {
    return 'challenge';
  }
  if (/\b(c|secret)\b/.test(normalized) || normalized.includes('secret')) {
    return 'secret';
  }
  throw new Error(
    `Unknown flyer type for flyer variant "${flyerName}". Cannot route to master artwork. Allowed types: Family, Challenge, Secret.`
  );
}

export function findMasterFile(mastersDir: string, type: FlyerMasterType): string {
  const resolvedDir = expandPath(mastersDir);
  if (!fs.existsSync(resolvedDir) || !fs.statSync(resolvedDir).isDirectory()) {
    throw new Error(`Master artwork directory not found: ${mastersDir} (resolved to ${resolvedDir})`);
  }

  const files = fs.readdirSync(resolvedDir);
  const config = FLYER_PLACEMENT_CONFIGS[type];
  const targetPattern = new RegExp(`^${config.expectedMasterBasename}(\\.(png|jpg|jpeg|webp))?$`, 'i');

  const matched = files.find((file) => targetPattern.test(file));
  if (!matched) {
    throw new Error(
      `Missing master flyer artwork for type "${config.displayName}" in ${mastersDir}. Expected file matching "${config.expectedMasterBasename}.png". Available files: ${files.join(', ') || '(empty directory)'}`
    );
  }

  return path.join(resolvedDir, matched);
}

export function formatFlyerFilename(index: number, flyerType: string, distributorName: string): string {
  const paddedIndex = String(index).padStart(2, '0');
  const safeType = slugifyText(flyerType);
  const safeDistributor = slugifyText(distributorName);
  return `${paddedIndex}-${safeType}-${safeDistributor}.png`;
}

export async function generateQrCodeBuffer(url: string, size: number): Promise<Buffer> {
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    throw new Error('Cannot generate QR code from empty URL.');
  }

  return QRCode.toBuffer(cleanUrl, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: size,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}

export interface ActiveQrAssignment {
  campaign: QrCampaign;
  flyerVariant: CampaignFlyerVariant;
  distributor: CampaignDistributor;
  qrCode: CampaignQrCode;
  flyerType: FlyerMasterType;
  canonicalUrl: string;
}

export interface GenerateCampaignFlyersOptions {
  campaignIdentifier: string;
  mastersDir: string;
  outputDir: string;
}

export interface GeneratedFlyerRecord {
  index: number;
  campaign: string;
  qrId: string;
  status: string;
  type: string;
  distributorName: string;
  slug: string;
  url: string;
  masterFilename: string;
  outputFilename: string;
  outputPath: string;
}

export interface GenerateCampaignFlyersResult {
  campaignName: string;
  activeAssignmentsCount: number;
  flyersGeneratedCount: number;
  countsByType: Record<FlyerMasterType, number>;
  outputDirectory: string;
  manifestPath: string;
  flyers: GeneratedFlyerRecord[];
}

function toCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function getActiveCampaignAssignments(campaignIdentifier: string): Promise<ActiveQrAssignment[]> {
  const campaign = await findCampaignByNameOrId(campaignIdentifier);
  if (!campaign) {
    throw new Error(`Campaign not found: ${campaignIdentifier}`);
  }

  const bundle = await getCampaignBundle();
  const flyerMap = new Map(
    bundle.flyerVariants.filter((f) => f.campaignId === campaign.id).map((f) => [f.id, f])
  );
  const distributorMap = new Map(
    bundle.distributors.filter((d) => d.campaignId === campaign.id).map((d) => [d.id, d])
  );

  const activeQrs = bundle.qrCodes.filter(
    (qr) => qr.campaignId === campaign.id && qr.status === 'active'
  );

  const assignments: ActiveQrAssignment[] = [];

  for (const qr of activeQrs) {
    const flyerVariant = flyerMap.get(qr.flyerVariantId);
    if (!flyerVariant || flyerVariant.status !== 'active') {
      continue;
    }

    const distributor = distributorMap.get(qr.distributorId);
    if (!distributor || distributor.status !== 'active') {
      continue;
    }

    const flyerType = classifyFlyerType(flyerVariant.name);
    const canonicalUrl = qr.trackingUrl || `https://www.divinedesigndestinations.com/go/${qr.trackingSlug}`;

    if (!canonicalUrl || !canonicalUrl.startsWith('http')) {
      throw new Error(
        `Invalid or missing canonical tracking URL for QR code ${qr.id} (${flyerVariant.name} / ${distributor.name}).`
      );
    }

    assignments.push({
      campaign,
      flyerVariant,
      distributor,
      qrCode: qr,
      flyerType,
      canonicalUrl,
    });
  }

  return assignments;
}

export async function generateCampaignFlyers(
  options: GenerateCampaignFlyersOptions
): Promise<GenerateCampaignFlyersResult> {
  const assignments = await getActiveCampaignAssignments(options.campaignIdentifier);
  if (assignments.length === 0) {
    throw new Error(`No active QR assignments found for campaign "${options.campaignIdentifier}".`);
  }

  const campaign = assignments[0].campaign;
  const resolvedMastersDir = expandPath(options.mastersDir);
  const resolvedOutputDir = expandPath(options.outputDir);

  // Validate that all required master artworks exist before generating anything (Fail Closed)
  const masterPathsByType: Record<FlyerMasterType, string> = {
    family: findMasterFile(resolvedMastersDir, 'family'),
    challenge: findMasterFile(resolvedMastersDir, 'challenge'),
    secret: findMasterFile(resolvedMastersDir, 'secret'),
  };

  // Create output directory automatically
  fs.mkdirSync(resolvedOutputDir, { recursive: true });

  const generatedRecords: GeneratedFlyerRecord[] = [];
  const countsByType: Record<FlyerMasterType, number> = {
    family: 0,
    challenge: 0,
    secret: 0,
  };

  for (let idx = 0; idx < assignments.length; idx += 1) {
    const assignment = assignments[idx];
    const index = idx + 1;
    const flyerType = assignment.flyerType;
    const config = FLYER_PLACEMENT_CONFIGS[flyerType];
    const masterPath = masterPathsByType[flyerType];
    const masterFilename = path.basename(masterPath);

    const outputFilename = formatFlyerFilename(index, config.displayName, assignment.distributor.name);
    const outputPath = path.join(resolvedOutputDir, outputFilename);

    // 1. Generate crisp high-error-correction QR code buffer
    const qrBuffer = await generateQrCodeBuffer(assignment.canonicalUrl, config.qrSize);

    // 2. Composite QR code onto the deterministic white placeholder box
    try {
      await sharp(masterPath)
        .composite([
          {
            input: qrBuffer,
            top: config.qrTop,
            left: config.qrLeft,
          },
        ])
        .toFile(outputPath);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to composite flyer for assignment ${assignment.qrCode.id} (${assignment.flyerVariant.name} / ${assignment.distributor.name}): ${message}`
      );
    }

    countsByType[flyerType] += 1;

    generatedRecords.push({
      index,
      campaign: campaign.name,
      qrId: assignment.qrCode.id,
      status: assignment.qrCode.status,
      type: config.displayName,
      distributorName: assignment.distributor.name,
      slug: assignment.qrCode.trackingSlug,
      url: assignment.canonicalUrl,
      masterFilename,
      outputFilename,
      outputPath,
    });
  }

  // Generate manifest.csv in output directory
  const manifestHeader = 'index,campaign,qr_id,status,type,label/name,slug,url,master,output_file';
  const manifestRows = generatedRecords.map((r) =>
    [
      String(r.index),
      r.campaign,
      r.qrId,
      r.status,
      r.type,
      r.distributorName,
      r.slug,
      r.url,
      r.masterFilename,
      r.outputFilename,
    ]
      .map(toCsvValue)
      .join(',')
  );

  const manifestPath = path.join(resolvedOutputDir, 'manifest.csv');
  fs.writeFileSync(manifestPath, [manifestHeader, ...manifestRows].join('\n') + '\n', 'utf-8');

  return {
    campaignName: campaign.name,
    activeAssignmentsCount: assignments.length,
    flyersGeneratedCount: generatedRecords.length,
    countsByType,
    outputDirectory: resolvedOutputDir,
    manifestPath,
    flyers: generatedRecords,
  };
}
