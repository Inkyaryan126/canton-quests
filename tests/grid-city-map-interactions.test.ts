import { readFileSync } from 'fs';
import { join } from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GridCityMap, propertyMarkerRadii } from '../app/grid/grid-city-map';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { buildGridMapLabelPlan, buildGridMapRenderPacket, buildGridMapScene } from '../lib/grid/map';
import {
  resolveGridMapSelection,
  toggleGridMapSelection,
} from '../lib/grid/map/selection';
import type { GridMapInteractionTarget } from '../lib/grid/map/render-packet';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

const ROOT = join(__dirname, '..');

function target(
  kind: GridMapInteractionTarget['kind'],
  slug: string,
): GridMapInteractionTarget {
  return {
    kind,
    slug,
    districtSlug: kind === 'district' ? slug : null,
    territorySlug: kind === 'territory' ? slug : null,
    propertySlug: kind === 'property' ? slug : null,
  };
}

describe('Grid city map interaction state', () => {
  it('switches to a different target and clears when the same target is tapped again', () => {
    const district = target('district', 'downtown');
    const territory = target('territory', 'downtown-core');

    expect(toggleGridMapSelection(null, district)).toEqual(district);
    expect(toggleGridMapSelection(district, territory)).toEqual(territory);
    expect(toggleGridMapSelection(territory, territory)).toBeNull();
  });

  it('treats an unavailable target as an empty selection detail rather than inventing data', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 16 }));

    expect(resolveGridMapSelection(packet, target('property', 'not-in-world'))).toBeNull();
  });

  it('keeps the empty and action states wired into the player-facing map', () => {
    const source = readFileSync(join(ROOT, 'app/grid/grid-city-map.tsx'), 'utf8');

    expect(source).toContain('No map targets are available at this zoom level.');
    expect(source).toContain('That map target is no longer available in this world update.');
    expect(source).toContain('data-selected');
    expect(source).toContain('onClaimTerritory');
    expect(source).toContain('onAcquireProperty');
    expect(source).toContain('onDevelopProperty');
    expect(source).toContain('Clear selection');
  });

  it('passes the authoritative economy action handlers from the world client into the map', () => {
    const source = readFileSync(join(ROOT, 'app/grid/grid-world-client.tsx'), 'utf8');

    expect(source).toContain('economyWriteEnabled={economyWriteEnabled}');
    expect(source).toContain('busyClaim={busyClaim}');
    expect(source).toContain('busyPropertyAction={busyPropertyAction}');
    expect(source).toContain('onClaimTerritory={(territorySlug) => void claimTerritory(territorySlug)}');
    expect(source).toContain('onAcquireProperty={(propertySlug) => void acquireProperty(propertySlug)}');
    expect(source).toContain('void developProperty(propertySlug, branch)');
  });
});

// ── Rendered map: visible labels, valid SVG tooltips, touch-friendly hit areas ─

describe('Grid city map rendered output', () => {
  it('renders SVG <title> tooltips as a single text node, not an array of children', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const warnings: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };
    try {
      ReactDOMServer.renderToStaticMarkup(React.createElement(GridCityMap, { projection }));
    } finally {
      console.error = originalError;
    }
    expect(warnings.some((message) => message.includes('title'))).toBe(false);
  });

  it('renders visible on-map labels for the current zoom band, not just invisible tooltips', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    // GridCityMap defaults to zoom 10 (city band) on first render.
    const packet = buildGridMapRenderPacket(buildGridMapScene(projection, { zoom: 10 }));
    const expectedLabels = buildGridMapLabelPlan(packet);
    expect(expectedLabels.length).toBeGreaterThan(0);

    const html = ReactDOMServer.renderToStaticMarkup(React.createElement(GridCityMap, { projection }));
    expect(html).toContain('<text');
    for (const label of expectedLabels) {
      expect(html).toContain(`>${label.text}<`);
    }
  });

  it('gives property markers a touch-friendly hit radius well beyond their small visual dot', () => {
    const undeveloped = propertyMarkerRadii(0);
    const developed = propertyMarkerRadii(3);

    expect(undeveloped.hit).toBeGreaterThanOrEqual(undeveloped.visual * 2);
    expect(developed.hit).toBeGreaterThanOrEqual(developed.visual * 1.5);
    expect(undeveloped.hit).toBeGreaterThanOrEqual(10);
  });
});
