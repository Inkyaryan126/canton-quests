# Canton downtown source snapshot

This directory contains the first real-geography slice for THE GRID City Compiler.

## Scope

- Full Canton, Ohio municipal boundary from the U.S. Census Bureau TIGER/Line 2025 Ohio Places shapefile, incorporated place GEOID `3912000`.
- One real downtown district boundary: 2020 Census Block Group `391517001002`.
- 20 connected real Census blocks inside that block group, used as GRID territories.
- 11 named public/commercial/civic/cultural property candidates from OpenStreetMap.
- 6 named public/civic/cultural/park landmarks from OpenStreetMap.
- No private-owner names or residential properties are included.

## Sources and licensing

Census TIGER/Line and TIGERweb geometry are U.S. Government public-domain data. OpenStreetMap data is licensed under ODbL 1.0 and must retain the attribution: **© OpenStreetMap contributors**.

No Google Maps, Google Places, or other commercial map-provider geometry/place data was used. See `provenance.json` for exact service endpoints, retrieval date, transformations, attribution, and confidence.

## Transformations

Census Polygon features were converted to GeoJSON MultiPolygon without simplification. The municipal boundary was selected from the official 2025 Ohio Places TIGER/Line shapefile and topology-cleaned with mapshaper without simplification; the downtown district and territory snapshots come from TIGERweb. The territory slice was selected from real 2020 Census blocks and kept connected by geometric intersection.

The OSM snapshot was queried from Overpass for named elements in the downtown Canton bounding box `40.794,-81.382,40.805,-81.367`. Nodes use their source point. Ways and relations use the center returned by Overpass; these point representations are intentionally not claimed to be building footprints.

OSM assets were spatially matched to the selected Census territories. Historical dates, ownership, demolished structures, and unsupported boundary claims are deliberately omitted rather than guessed.

## Files

`canton-boundary.geojson`, `canton-downtown-districts.geojson`, `canton-downtown-territories.geojson`, `canton-downtown-properties.geojson`, and `canton-downtown-landmarks.geojson` are checked-in source snapshots. Every feature carries `properties.sourceRefs` resolving to `provenance.json`.
