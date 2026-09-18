import { describe, expect, it } from 'vitest';
import { cantonFoundingSeasonPackage } from '../lib/grid/cities/canton/founding-season';
import { buildGridMapFrame, type GridMapFrame } from '../lib/grid/map/frame';
import { buildGridMapMotionPlan } from '../lib/grid/map/motion';
import { buildGridWorldProjection } from '../lib/grid/server/world-projection';

function animatedFrame(): GridMapFrame {
  const projection = buildGridWorldProjection(cantonFoundingSeasonPackage);
  const frame = buildGridMapFrame(projection, { zoom: 12 });
  const territory = frame.packet.territories.features[0];
  territory.properties.pulse = true;
  return {
    ...frame,
    layers: [
      ...frame.layers,
      {
        id: 'contest-front',
        source: 'contestFronts',
        kind: 'line',
        order: 60,
        interactive: false,
        animated: true,
      },
    ],
    effects: [{
      id: 'contest-started:contest-1',
      kind: 'contest-started',
      entityId: 'contest-1',
      intensity: 'strong',
    }],
  };
}
describe('Grid map motion accessibility plan', () => {
  it('allows cinematic motion when reduced motion is not requested', () => {
    const plan = buildGridMapMotionPlan(animatedFrame(), {
      reducedMotion: false,
    });

    expect(plan.mode).toBe('full');
    expect(plan.cameraTransitionMs).toBeGreaterThan(0);
    expect(plan.animatedLayerIds).toContain('contest-front');
    expect(plan.pulsingTerritorySlugs.length).toBeGreaterThan(0);
    expect(plan.effectTimings).toEqual([
      expect.objectContaining({
        effectId: 'contest-started:contest-1',
        durationMs: expect.any(Number),
      }),
    ]);
    expect(plan.effectTimings[0].durationMs).toBeGreaterThan(0);
  });

  it('removes nonessential motion while preserving state-change cues', () => {
    const plan = buildGridMapMotionPlan(animatedFrame(), {
      reducedMotion: true,
    });

    expect(plan.mode).toBe('reduced');
    expect(plan.cameraTransitionMs).toBe(0);
    expect(plan.animatedLayerIds).toEqual([]);
    expect(plan.pulsingTerritorySlugs).toEqual([]);
    expect(plan.effectTimings).toEqual([{
      effectId: 'contest-started:contest-1',
      durationMs: 0,
    }]);
  });
  it('uses shorter timing for soft cues than strong cues', () => {
    const frame = animatedFrame();
    frame.effects.push({
      id: 'contest-ended:contest-2',
      kind: 'contest-ended',
      entityId: 'contest-2',
      intensity: 'soft',
    });

    const plan = buildGridMapMotionPlan(frame, { reducedMotion: false });
    const strong = plan.effectTimings.find(
      (timing) => timing.effectId === 'contest-started:contest-1',
    )!;
    const soft = plan.effectTimings.find(
      (timing) => timing.effectId === 'contest-ended:contest-2',
    )!;

    expect(strong.durationMs).toBeGreaterThan(soft.durationMs);
  });

  it('is deterministic and does not mutate the renderer frame', () => {
    const frame = animatedFrame();
    const before = JSON.stringify(frame);
    const first = buildGridMapMotionPlan(frame, { reducedMotion: false });
    const second = buildGridMapMotionPlan(frame, { reducedMotion: false });

    expect(first).toEqual(second);
    expect(JSON.stringify(frame)).toBe(before);
  });
});
