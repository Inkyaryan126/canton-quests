# QR Campaign Operations

Use `/admin/qr-campaigns` after Game Master authentication.

## Fast CLI Setup

Create the full street-team grid in one command:

```bash
npm run qr:campaign -- setup \
  --campaign "Canton Quests Street Team 2026" \
  --flyers "Family,Challenge,Secret" \
  --distributors "Dustin,Employee 1,Employee 2" \
  --abc-start-destinations
```

This creates one campaign, three flyer variants, three distributors, and all nine Flyer x Distributor tracking URLs. With `--abc-start-destinations`, Family routes to `/start/family`, Challenge routes to `/start/challenge`, and Secret routes to `/start/secret`.

Useful read commands:

```bash
npm run qr:campaign -- campaigns
npm run qr:campaign -- flyers --campaign "<name or id>"
npm run qr:campaign -- distributors --campaign "<name or id>"
npm run qr:campaign -- qrs --campaign "<name or id>"
npm run qr:campaign -- export --campaign "<name or id>" --output qr-campaign.csv
```

To generate combinations for an existing campaign:

```bash
npm run qr:campaign -- generate --campaign "<name or id>" --all --abc-start-destinations
```

## Admin Setup

1. Create a campaign, for example `STARK COUNTY FAIR 2026`, and confirm the destination path such as `/quests`.
2. Add the flyer variants you plan to print, such as `Flyer A`, `Flyer B`, and `Flyer C`.
3. Add distributors, such as each person or placement team handling flyer batches.
4. Select the three flyer variants and three distributors, then generate the batch. The system creates one unique tracking URL for every Flyer x Distributor combination.
5. Print or download the QR sheet. Match each printed QR to the exact campaign, flyer, and distributor label shown in the admin sheet.
6. Use the analytics panels to compare total visits and unique visitors by flyer, distributor, and exact combination.

## Removing Mistakes Safely

Use `ARCHIVE` for campaigns that already have QR codes or visits. It deactivates the campaign while preserving analytics.

Use `DELETE UNUSED` only for records with no attribution history. CLI hard deletes require `--yes`; without it, the CLI prints what would happen and exits safely.

```bash
npm run qr:campaign -- archive-campaign --campaign "<id>"
npm run qr:campaign -- delete-campaign --campaign "<id>" --yes
npm run qr:campaign -- delete-flyer --id "<id>" --yes
npm run qr:campaign -- delete-distributor --id "<id>" --yes
npm run qr:campaign -- deactivate-qr --id "<id>"
npm run qr:campaign -- delete-qr --id "<id>" --yes
```

Flyers, distributors, and QR codes with visit history are deactivated instead of destroyed so old scans remain attributable.

Promotional tracking QR codes use `/go/[slug]` and are separate from quest-proof QR codes under `/qr/[code]`. Scan totals are trackable visits; they cannot perfectly prove that every visit came from a physical scan instead of a copied link.
