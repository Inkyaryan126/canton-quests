# QR Campaign Operations

Use `/admin/qr-campaigns` after Game Master authentication.

1. Create a campaign, for example `STARK COUNTY FAIR 2026`, and confirm the destination path such as `/quests`.
2. Add the flyer variants you plan to print, such as `Flyer A`, `Flyer B`, and `Flyer C`.
3. Add distributors, such as each person or placement team handling flyer batches.
4. Select the three flyer variants and three distributors, then generate the batch. The system creates one unique tracking URL for every Flyer x Distributor combination.
5. Print or download the QR sheet. Match each printed QR to the exact campaign, flyer, and distributor label shown in the admin sheet.
6. Use the analytics panels to compare total visits and unique visitors by flyer, distributor, and exact combination.

Promotional tracking QR codes use `/go/[slug]` and are separate from quest-proof QR codes under `/qr/[code]`. Scan totals are trackable visits; they cannot perfectly prove that every visit came from a physical scan instead of a copied link.
