import fs from 'node:fs';
import path from 'node:path';
import {
  archiveCampaign,
  createCampaignDistributor,
  createCampaignFlyerVariant,
  deleteOrDeactivateDistributor,
  deleteOrDeactivateFlyer,
  deleteOrDeactivateQrCode,
  deleteUnusedCampaign,
  findCampaignByNameOrId,
  generateCampaignQrCodes,
  getAbcDestinationForFlyerName,
  getCampaignBundle,
  setCampaignQrCodeStatus,
  setupStreetTeamCampaign,
} from '../lib/qr-campaigns';
import { CampaignDistributor, CampaignFlyerVariant, CampaignQrCode, QrCampaign } from '../lib/types';

type CliCommand =
  | 'setup'
  | 'campaigns'
  | 'flyers'
  | 'distributors'
  | 'qrs'
  | 'generate'
  | 'archive-campaign'
  | 'delete-campaign'
  | 'delete-flyer'
  | 'delete-distributor'
  | 'deactivate-qr'
  | 'delete-qr'
  | 'export'
  | 'help';

interface ParsedArgs {
  command: CliCommand;
  flags: Record<string, string | boolean>;
}

interface CliIo {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const DEFAULT_IO: CliIo = {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
};

function parseArgs(argv: string[]): ParsedArgs {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    index += 1;
  }
  return { command: command as CliCommand, flags };
}

function requireString(flags: Record<string, string | boolean>, name: string): string {
  const value = flags[name];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required --${name}.`);
  return value.trim();
}

function optionalList(flags: Record<string, string | boolean>, name: string): string[] {
  const value = flags[name];
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isYes(flags: Record<string, string | boolean>): boolean {
  return flags.yes === true;
}

function printHelp(io: CliIo): void {
  io.stdout(`QR campaign CLI

Fast path:
  npm run qr:campaign -- setup --campaign "Canton Quests Street Team 2026" --flyers "Family,Challenge,Secret" --distributors "Dustin,Employee 1,Employee 2" --abc-start-destinations

Read:
  npm run qr:campaign -- campaigns
  npm run qr:campaign -- flyers --campaign "<name or id>"
  npm run qr:campaign -- distributors --campaign "<name or id>"
  npm run qr:campaign -- qrs --campaign "<name or id>"

Generate:
  npm run qr:campaign -- generate --campaign "<name or id>" --all --abc-start-destinations
  npm run qr:campaign -- generate --campaign "<name or id>" --flyers "Flyer A,Flyer B" --distributors "Dustin"

Remove mistakes:
  npm run qr:campaign -- archive-campaign --campaign "<id>"
  npm run qr:campaign -- delete-campaign --campaign "<id>" --yes
  npm run qr:campaign -- delete-flyer --id "<id>" --yes
  npm run qr:campaign -- delete-distributor --id "<id>" --yes
  npm run qr:campaign -- deactivate-qr --id "<id>"
  npm run qr:campaign -- delete-qr --id "<id>" --yes`);
}

function printQrRecords(records: Array<{ campaign: QrCampaign; flyer: CampaignFlyerVariant; distributor: CampaignDistributor; qrCode: CampaignQrCode }>, io: CliIo): void {
  for (const record of records) {
    io.stdout(
      [
        `campaign=${record.campaign.name}`,
        `flyer=${record.flyer.name}`,
        `distributor=${record.distributor.name}`,
        `destination=${record.qrCode.destinationUrl}`,
        `trackingSlug=${record.qrCode.trackingSlug}`,
        `trackingUrl=${record.qrCode.trackingUrl}`,
      ].join(' | ')
    );
  }
}

function printCampaigns(campaigns: QrCampaign[], io: CliIo): void {
  if (campaigns.length === 0) {
    io.stdout('No QR campaigns found.');
    return;
  }
  for (const campaign of campaigns) {
    io.stdout(`${campaign.id} | ${campaign.status.toUpperCase()} | ${campaign.name} | ${campaign.destinationUrl}`);
  }
}

async function resolveCampaign(identifier: string): Promise<QrCampaign> {
  const campaign = await findCampaignByNameOrId(identifier);
  if (!campaign) throw new Error(`Campaign not found: ${identifier}`);
  return campaign;
}

async function listCampaignChildren(command: CliCommand, campaignIdentifier: string, io: CliIo): Promise<void> {
  const campaign = await resolveCampaign(campaignIdentifier);
  const bundle = await getCampaignBundle();
  if (command === 'flyers') {
    const flyers = bundle.flyerVariants.filter((flyer) => flyer.campaignId === campaign.id);
    if (flyers.length === 0) io.stdout('No flyer variants found.');
    flyers.forEach((flyer) => io.stdout(`${flyer.id} | ${flyer.status.toUpperCase()} | ${flyer.name}`));
    return;
  }
  if (command === 'distributors') {
    const distributors = bundle.distributors.filter((distributor) => distributor.campaignId === campaign.id);
    if (distributors.length === 0) io.stdout('No distributors found.');
    distributors.forEach((distributor) => io.stdout(`${distributor.id} | ${distributor.status.toUpperCase()} | ${distributor.name}`));
    return;
  }

  const flyers = bundle.flyerVariants.filter((flyer) => flyer.campaignId === campaign.id);
  const distributors = bundle.distributors.filter((distributor) => distributor.campaignId === campaign.id);
  const qrs = bundle.qrCodes.filter((qr) => qr.campaignId === campaign.id);
  if (qrs.length === 0) io.stdout('No QR codes found.');
  qrs.forEach((qr) => {
    const flyer = flyers.find((item) => item.id === qr.flyerVariantId);
    const distributor = distributors.find((item) => item.id === qr.distributorId);
    io.stdout(`${qr.id} | ${qr.status.toUpperCase()} | ${flyer?.name || 'Unknown Flyer'} | ${distributor?.name || 'Unknown Distributor'} | ${qr.destinationUrl} | ${qr.trackingSlug} | ${qr.trackingUrl}`);
  });
}

async function createMissingChildren(campaignId: string, names: string[], type: 'flyer' | 'distributor') {
  const bundle = await getCampaignBundle();
  if (type === 'flyer') {
    const existing = bundle.flyerVariants.filter((flyer) => flyer.campaignId === campaignId);
    const children = [];
    for (const name of names) {
      children.push(existing.find((flyer) => flyer.name.toLowerCase() === name.toLowerCase()) || await createCampaignFlyerVariant({ campaignId, name }));
    }
    return children;
  }

  const existing = bundle.distributors.filter((distributor) => distributor.campaignId === campaignId);
  const children = [];
  for (const name of names) {
    children.push(existing.find((distributor) => distributor.name.toLowerCase() === name.toLowerCase()) || await createCampaignDistributor({ campaignId, name }));
  }
  return children;
}

function toCsvValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function exportCampaign(campaignIdentifier: string, io: CliIo, outputPath?: string): Promise<void> {
  const campaign = await resolveCampaign(campaignIdentifier);
  const bundle = await getCampaignBundle();
  const flyers = bundle.flyerVariants.filter((flyer) => flyer.campaignId === campaign.id);
  const distributors = bundle.distributors.filter((distributor) => distributor.campaignId === campaign.id);
  const rows = bundle.qrCodes
    .filter((qr) => qr.campaignId === campaign.id)
    .map((qr) => {
      const flyer = flyers.find((item) => item.id === qr.flyerVariantId);
      const distributor = distributors.find((item) => item.id === qr.distributorId);
      return {
        campaign: campaign.name,
        flyer: flyer?.name || 'Unknown Flyer',
        distributor: distributor?.name || 'Unknown Distributor',
        destination: qr.destinationUrl,
        trackingSlug: qr.trackingSlug,
        trackingUrl: qr.trackingUrl,
      };
    });
  const csv = [
    'campaign,flyer,distributor,destination,trackingSlug,trackingUrl',
    ...rows.map((row) => [row.campaign, row.flyer, row.distributor, row.destination, row.trackingSlug, row.trackingUrl].map(toCsvValue).join(',')),
  ].join('\n');

  if (outputPath) {
    fs.writeFileSync(path.resolve(outputPath), `${csv}\n`);
    io.stdout(`Exported ${rows.length} QR records to ${outputPath}.`);
    return;
  }
  io.stdout(csv);
}

export async function runQrCampaignCli(argv: string[], io: CliIo = DEFAULT_IO): Promise<number> {
  const { command, flags } = parseArgs(argv);

  if (command === 'help') {
    printHelp(io);
    return 0;
  }

  if (command === 'setup') {
    const records = await setupStreetTeamCampaign({
      campaignName: requireString(flags, 'campaign'),
      flyerNames: optionalList(flags, 'flyers'),
      distributorNames: optionalList(flags, 'distributors'),
      abcStartDestinations: flags['abc-start-destinations'] === true,
    });
    io.stdout(`Created ${records.length} QR campaign tracking record(s).`);
    printQrRecords(records, io);
    return 0;
  }

  if (command === 'campaigns') {
    const bundle = await getCampaignBundle();
    printCampaigns(bundle.campaigns, io);
    return 0;
  }

  if (command === 'flyers' || command === 'distributors' || command === 'qrs') {
    await listCampaignChildren(command, requireString(flags, 'campaign'), io);
    return 0;
  }

  if (command === 'generate') {
    const campaign = await resolveCampaign(requireString(flags, 'campaign'));
    const bundle = await getCampaignBundle();
    const allFlyers = bundle.flyerVariants.filter((flyer) => flyer.campaignId === campaign.id && flyer.status === 'active');
    const allDistributors = bundle.distributors.filter((distributor) => distributor.campaignId === campaign.id && distributor.status === 'active');
    const flyerNames = optionalList(flags, 'flyers');
    const distributorNames = optionalList(flags, 'distributors');
    const flyers = flags.all === true || flyerNames.length === 0 ? allFlyers : await createMissingChildren(campaign.id, flyerNames, 'flyer') as CampaignFlyerVariant[];
    const distributors = flags.all === true || distributorNames.length === 0 ? allDistributors : await createMissingChildren(campaign.id, distributorNames, 'distributor') as CampaignDistributor[];
    const destinationUrlByFlyerVariantId = flags['abc-start-destinations'] === true
      ? Object.fromEntries(
          flyers
            .map((flyer, index) => [flyer.id, getAbcDestinationForFlyerName(flyer.name, index)])
            .filter((entry): entry is [string, string] => Boolean(entry[1]))
        )
      : undefined;
    const qrCodes = await generateCampaignQrCodes({
      campaignId: campaign.id,
      flyerVariantIds: flyers.map((flyer) => flyer.id),
      distributorIds: distributors.map((distributor) => distributor.id),
      destinationUrlByFlyerVariantId,
    });
    printQrRecords(qrCodes.map((qrCode) => ({
      campaign,
      qrCode,
      flyer: flyers.find((flyer) => flyer.id === qrCode.flyerVariantId)!,
      distributor: distributors.find((distributor) => distributor.id === qrCode.distributorId)!,
    })), io);
    return 0;
  }

  if (command === 'archive-campaign') {
    const campaign = await resolveCampaign(requireString(flags, 'campaign'));
    io.stdout((await archiveCampaign(campaign.id)).message);
    return 0;
  }

  if (command === 'delete-campaign') {
    const campaign = await resolveCampaign(requireString(flags, 'campaign'));
    const result = await deleteUnusedCampaign(campaign.id, isYes(flags));
    io.stdout(result.message);
    return result.kind === 'blocked' ? 1 : 0;
  }

  if (command === 'delete-flyer') {
    const result = await deleteOrDeactivateFlyer(requireString(flags, 'id'), isYes(flags));
    io.stdout(result.message);
    return result.kind === 'blocked' ? 1 : 0;
  }

  if (command === 'delete-distributor') {
    const result = await deleteOrDeactivateDistributor(requireString(flags, 'id'), isYes(flags));
    io.stdout(result.message);
    return result.kind === 'blocked' ? 1 : 0;
  }

  if (command === 'deactivate-qr') {
    const qrCode = await setCampaignQrCodeStatus(requireString(flags, 'id'), 'inactive');
    if (!qrCode) {
      io.stdout('QR code not found.');
      return 1;
    }
    io.stdout(`QR code deactivated: ${qrCode.trackingSlug}. Attribution history is preserved.`);
    return 0;
  }

  if (command === 'delete-qr') {
    const result = await deleteOrDeactivateQrCode(requireString(flags, 'id'), isYes(flags));
    io.stdout(result.message);
    return result.kind === 'blocked' ? 1 : 0;
  }

  if (command === 'export') {
    await exportCampaign(requireString(flags, 'campaign'), io, typeof flags.output === 'string' ? flags.output : undefined);
    return 0;
  }

  io.stderr(`Unknown command: ${command}`);
  printHelp(io);
  return 1;
}

if (!process.env.VITEST) {
  runQrCampaignCli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  }).catch((error: Error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
