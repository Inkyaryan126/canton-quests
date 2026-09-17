import { describe, expect, it } from 'vitest';
import {
  planGridNpcFaction,
  projectGridNpcFactionPressure,
  validateGridNpcFactionConfig,
} from '../lib/grid/core/npc-factions';
import type {
  GridNpcFactionConfig,
  GridNpcFactionContext,
} from '../lib/grid/core/npc-faction-types';

const config: GridNpcFactionConfig = {
  factionId: 'neutral-guardians',
  basePressureBps: 1_000,
  maxPressureBps: 9_000,
  dominanceHeatResponseBps: 5_000,
  eventPressureResponseBps: 4_000,
  baseObjectiveSlots: 1,
  maxObjectiveSlots: 4,
  objectiveWeights: {
    neutralExpansionBps: 2_500,
    landmarkDefenseBps: 2_500,
    dominantOwnerPressureBps: 2_500,
    eventResponseBps: 1_500,
    tutorialOpponentBps: 1_000,
  },
};

const context: GridNpcFactionContext = {
  dominanceHeatBps: 6_000,
  eventPressureBps: 5_000,
  territories: [
    {
      territorySlug: 'neutral-high',
      control: 'neutral',
      strategicValue: 100,
      containsLandmark: false,
    },
    {
      territorySlug: 'npc-landmark',
      control: 'npc',
      strategicValue: 60,
      containsLandmark: true,
      tutorialOpponentEligible: true,
    },
    {
      territorySlug: 'dominant-rival',
      control: 'player',
      strategicValue: 80,
      containsLandmark: false,
      ownerDominanceBps: 8_000,
      eventPriorityBps: 6_000,
    },
    {
      territorySlug: 'quiet-npc',
      control: 'npc',
      strategicValue: 20,
      containsLandmark: false,
    },
  ],
};

describe('Grid NPC factions', () => {
  it('raises pressure from Dominance Heat and active city-event pressure', () => {
    const projection = projectGridNpcFactionPressure(config, context);

    expect(projection).toEqual({
      factionId: 'neutral-guardians',
      pressureBps: 6_000,
      objectiveSlots: 3,
      capped: false,
    });
  });

  it('caps pressure and reaches the configured objective-slot ceiling', () => {
    const projection = projectGridNpcFactionPressure(config, {
      dominanceHeatBps: 10_000,
      eventPressureBps: 10_000,
    });

    expect(projection.pressureBps).toBe(9_000);
    expect(projection.objectiveSlots).toBe(4);
    expect(projection.capped).toBe(true);
  });

  it('plans neutral expansion, landmark defense, and anti-dominance pressure deterministically', () => {
    const plan = planGridNpcFaction(config, context);

    expect(plan.pressure.objectiveSlots).toBe(3);
    expect(plan.objectives).toEqual([
      {
        territorySlug: 'npc-landmark',
        kind: 'defend-landmark',
        scoreBps: 3_500,
        strategicValueBps: 6_000,
      },
      {
        territorySlug: 'dominant-rival',
        kind: 'pressure-dominant-owner',
        scoreBps: 2_900,
        strategicValueBps: 8_000,
      },
      {
        territorySlug: 'neutral-high',
        kind: 'occupy-neutral',
        scoreBps: 2_500,
        strategicValueBps: 10_000,
      },
    ]);
  });

  it('uses event response as the objective kind when its weighted signal is strongest', () => {
    const plan = planGridNpcFaction(config, {
      dominanceHeatBps: 0,
      eventPressureBps: 10_000,
      territories: [
        {
          territorySlug: 'event-zone',
          control: 'npc',
          strategicValue: 10,
          containsLandmark: false,
          eventPriorityBps: 10_000,
        },
      ],
    });

    expect(plan.objectives).toEqual([
      {
        territorySlug: 'event-zone',
        kind: 'event-response',
        scoreBps: 1_500,
        strategicValueBps: 10_000,
      },
    ]);
  });

  it('can expose a dedicated NPC tutorial opponent without touching live player control', () => {
    const tutorialConfig: GridNpcFactionConfig = {
      ...config,
      basePressureBps: 0,
      maxPressureBps: 0,
      baseObjectiveSlots: 1,
      maxObjectiveSlots: 1,
    };
    const plan = planGridNpcFaction(tutorialConfig, {
      dominanceHeatBps: 0,
      eventPressureBps: 0,
      territories: [
        {
          territorySlug: 'tutorial-yard',
          control: 'npc',
          strategicValue: 1,
          containsLandmark: false,
          tutorialOpponentEligible: true,
        },
      ],
    });

    expect(plan.objectives).toEqual([
      {
        territorySlug: 'tutorial-yard',
        kind: 'tutorial-opponent',
        scoreBps: 1_000,
        strategicValueBps: 10_000,
      },
    ]);
  });

  it('breaks equal objective scores by territory slug', () => {
    const plan = planGridNpcFaction(
      {
        ...config,
        basePressureBps: 9_000,
        maxPressureBps: 9_000,
        baseObjectiveSlots: 4,
        maxObjectiveSlots: 4,
      },
      {
        dominanceHeatBps: 0,
        eventPressureBps: 0,
        territories: [
          {
            territorySlug: 'b-zone',
            control: 'neutral',
            strategicValue: 100,
            containsLandmark: false,
          },
          {
            territorySlug: 'a-zone',
            control: 'neutral',
            strategicValue: 100,
            containsLandmark: false,
          },
        ],
      },
    );

    expect(plan.objectives.map((item) => item.territorySlug)).toEqual([
      'a-zone',
      'b-zone',
    ]);
  });

  it('rejects tutorial opponents that are not NPC controlled', () => {
    expect(() =>
      planGridNpcFaction(config, {
        dominanceHeatBps: 0,
        eventPressureBps: 0,
        territories: [
          {
            territorySlug: 'bad-tutorial',
            control: 'neutral',
            strategicValue: 10,
            containsLandmark: false,
            tutorialOpponentEligible: true,
          },
        ],
      }),
    ).toThrow(/tutorial opponent must be NPC controlled/);
  });
  it('rejects malformed faction tuning and duplicate candidates', () => {
    expect(() =>
      validateGridNpcFactionConfig({
        ...config,
        objectiveWeights: {
          ...config.objectiveWeights,
          tutorialOpponentBps: 999,
        },
      }),
    ).toThrow(/must total exactly 10000/);

    expect(() =>
      validateGridNpcFactionConfig({
        ...config,
        maxObjectiveSlots: 0,
      }),
    ).toThrow(/maxObjectiveSlots cannot be below baseObjectiveSlots/);

    expect(() =>
      planGridNpcFaction(config, {
        dominanceHeatBps: 0,
        eventPressureBps: 0,
        territories: [
          {
            territorySlug: 'dupe',
            control: 'neutral',
            strategicValue: 1,
            containsLandmark: false,
          },
          {
            territorySlug: 'dupe',
            control: 'neutral',
            strategicValue: 2,
            containsLandmark: false,
          },
        ],
      }),
    ).toThrow(/duplicate NPC territory candidate/);
  });
  it('rejects impossible dominance metadata and invalid pressure input', () => {
    expect(() =>
      planGridNpcFaction(config, {
        dominanceHeatBps: 0,
        eventPressureBps: 0,
        territories: [
          {
            territorySlug: 'neutral-with-owner-heat',
            control: 'neutral',
            strategicValue: 1,
            containsLandmark: false,
            ownerDominanceBps: 5_000,
          },
        ],
      }),
    ).toThrow(/ownerDominanceBps requires player or alliance control/);

    expect(() =>
      projectGridNpcFactionPressure(config, {
        dominanceHeatBps: 10_001,
        eventPressureBps: 0,
      }),
    ).toThrow(/dominanceHeatBps cannot exceed 10000 basis points/);
  });
});
