# THE GRID — Visual Direction + Asset System

**Status:** ACTIVE DIRECTION — 2026-09-17

## 1. Visual promise

THE GRID should look like a premium city-strategy game built on top of the real city, not like a scavenger-hunt dashboard with a dark theme.

The player should immediately read three layers:

1. **REAL CITY** — present-day Canton streets, districts, public/commercial properties, landmarks.
2. **LIVE GAME STATE** — control, contests, routes, signals, economy, factions, events.
3. **PLAYER-CREATED FUTURE** — development, upgraded properties, Skylines, strongholds, influence and city power.

History belongs underneath those layers as optional lore / Echo content; it is not the base visual timeline.

## 2. Core look

- dark graphite / near-black city floor
- electric cyan for player/system energy
- warm gold/amber for opportunity/economy
- magenta/fuchsia for rival control
- restrained red for danger/contested fronts only
- emerald for valid starter/onboarding state
- glass + metal HUD surfaces, not generic rounded SaaS cards
- subtle fog, bloom, scan light and depth where useful
- real map geometry must remain readable under effects

Effects must communicate game state. Glow with no meaning is decoration and should be removed.

## 3. Zoom hierarchy

### City view
Show the whole city as a living strategic board:
- district silhouettes
- dominant player/faction control
- Skyline silhouettes
- Surge / event energy
- major contested fronts
- major landmarks

### District view
Show tactical control:
- territory borders
- connected ownership networks
- roads and routes
- properties
- strongholds
- active contest links

### Territory / property view
Show the asset as something the player can understand and care about:
- property photo/key art when available
- real name when public-safe
- current owner state
- development branch and level
- condition
- income / influence contribution
- defense / contest state
- connected Skyline relationship

## 4. Artwork the project needs

### A. City key art
One canonical 16:9 Canton Grid hero using recognizable downtown Canton, not a fictional metropolis and not a waterfront city.

Needed variants:
- night / dormant Grid
- awakened Grid
- contested city
- Founding Season promotional version

### B. District key art
Each meaningful district should eventually have one recognizable cinematic establishing image using real local landmarks/street character.

### C. Property imagery
Public/commercial/civic properties should have consistent thumbnail/key-art treatment.

Preferred pipeline:
- real photo when legally usable / supplied by project owner
- otherwise approved generated/stylized interpretation based on supplied reference
- never invent an entirely different building and present it as the real property

### D. Development branch identity
Each branch needs a distinct icon + architectural language:
- Commerce — gold / market / vertical light
- Influence — signal / broadcast / civic projection
- Fortress — armor / reinforced geometry
- Intel — scanning / network / data
- Prestige — premium monument / luminous crown language

### E. Game-state effects
Reusable visuals for:
- neutral claim
- successful capture
- contested territory
- Signal Dice
- defense
- upgrade
- Skyline qualification
- Surge
- NPC stronghold
- dynamic city event

## 5. Required asset standards

For new Grid-specific art, prefer:
- hero/key art: 16:9, at least 1920×1080
- property/district cards: 3:2 or 16:9, at least 1200 px wide
- square icons/badges: 1:1, at least 512×512
- transparent state/effect overlays: PNG/WebP with alpha
- avoid text baked into reusable background art unless it is intentionally a poster

Store approved Grid art under `public/grid/` using stable descriptive names rather than ChatGPT/export filenames.

## 6. UI hierarchy rules

- The map is the hero. Side panels support it rather than overpower it.
- A selected territory/property must visually become the focus.
- Important state should have one strong signal, not three competing badges.
- Dense data belongs behind drill-down, not all visible at once.
- The first screen should answer: **Where am I? What do I control? What can I do next? What is happening right now?**
- The board should feel alive even when nothing is moving: layered light, clear depth, purposeful hierarchy.

## 7. Present-day → future rule

The visual progression is not historical reconstruction.

The base layer remains recognizable present-day Canton. Player development appears as a stylized digital/virtual future growing from real current properties and territories. A player should be able to look at the board and understand both:

- **this is Canton**
- **this is what players have done to Canton inside The Grid**

## 8. Historical Echo treatment

Historical content can temporarily overlay the modern board using:
- archival-photo portals
- ghosted vanished-building footprints
- old street labels/routes
- monochrome/sepia Echo layers
- time-limited history missions
- location-specific lore reveals

Echoes never silently delete the modern economy/property board. They are content layered onto it.

## 9. Immediate visual cleanup order

1. Make the City Board selectable and focused rather than passive.
2. Establish consistent present-day → player-future framing.
3. Add map depth/glow only where state warrants it.
4. Bring in the Map Scene camera/layer engine as it stabilizes.
5. Replace generic markers with a coherent Grid icon set.
6. Add approved Canton city/district/property art.
7. Add development/contest/Skyline effects.
8. Tune mobile hierarchy after the desktop visual language is stable.
