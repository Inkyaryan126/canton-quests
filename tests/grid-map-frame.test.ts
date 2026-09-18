import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import {
  buildGridMapFrame,
  resolveGridMapFrameInteraction,
} from '../lib/grid/map/frame';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

describe('Grid map renderer frame', () => {
  it('assembles scene, render packet, and ordered layers through one entry point', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const frame = buildGridMapFrame(projection, { zoom: 9 });

    expect(frame.version).toBe(1);
    expect(frame.scene.zoomBand).toBe('city');
    expect(frame.packet.zoomBand).toBe('city');
    expect(frame.layers.length).toBeGreaterThan(0);
    expect(frame.layers.map((layer) => layer.order))
      .toEqual([...frame.layers.map((layer) => layer.order)].sort((a, b) => a - b));
    expect(frame.delta).toBeNull();
    expect(frame.effects).toEqual([]);
  });
  it('produces an incremental delta against the previous renderer packet', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const cityFrame = buildGridMapFrame(projection, { zoom: 9 });
    const districtSlug = projection.territories[0].districtSlug;
    const districtFrame = buildGridMapFrame(
      projection,
      { zoom: 12, focusDistrictSlug: districtSlug },
      cityFrame.packet,
    );

    expect(districtFrame.delta).not.toBeNull();
    expect(districtFrame.delta?.cameraChanged).toBe(true);
    expect(districtFrame.delta?.zoomBandChanged).toBe(true);
    expect(districtFrame.delta?.territories.added.length).toBeGreaterThan(0);
    expect(districtFrame.effects).toEqual([]);
  });

  it('reports no entity work for a byte-equivalent subsequent frame', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const first = buildGridMapFrame(projection, { zoom: 9 });
    const second = buildGridMapFrame(projection, { zoom: 9 }, first.packet);

    expect(second.delta).not.toBeNull();
    expect(second.delta?.cameraChanged).toBe(false);
    expect(second.effects).toEqual([]);
    expect(second.delta?.districts).toEqual({
      added: [],
      removed: [],
      changed: [],
    });
  });
  it('resolves a selectable district into safe details and a camera plan', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const frame = buildGridMapFrame(projection, { zoom: 9 });
    const target = frame.packet.interactionTargets.find(
      (candidate) => candidate.kind === 'district',
    );
    expect(target).toBeDefined();

    const interaction = resolveGridMapFrameInteraction(frame, target!);

    expect(interaction.selection.kind).toBe('district');
    expect(interaction.selection.slug).toBe(target!.slug);
    expect(interaction.camera.navigation).toMatchObject({
      zoom: 11,
      focusDistrictSlug: target!.districtSlug,
    });
    expect(interaction.camera.fitBounds).not.toBeNull();
  });

  it('rejects targets that do not exist in the frame', () => {
    const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
    const frame = buildGridMapFrame(projection, { zoom: 9 });

    expect(() => resolveGridMapFrameInteraction(frame, {
      kind: 'district',
      slug: 'missing-district',
      districtSlug: 'missing-district',
      territorySlug: null,
      propertySlug: null,
    })).toThrow(/not present/i);
  });
});
