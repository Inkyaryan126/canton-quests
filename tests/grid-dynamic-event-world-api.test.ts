import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const route = fs.readFileSync(
  path.join(process.cwd(), 'app/api/grid/world/route.ts'),
  'utf8',
);
const projector = fs.readFileSync(
  path.join(process.cwd(), 'lib/grid/server/dynamic-event-world.ts'),
  'utf8',
);

describe('Grid dynamic events world API', () => {
  it('reads active server-side event instances and exposes a player-safe projection', () => {
    expect(route).toContain('listActiveGridDynamicEvents');
    expect(route).toContain('createSupabaseGridDynamicEventPort()');
    expect(route).toContain('buildGridDynamicEventWorldProjection');
    expect(route).toContain('dynamicEvents,');
  });

  it('uses one server timestamp for world and dynamic-event projections', () => {
    expect(route).toContain('const now = new Date().toISOString()');
    expect(route).toContain('now,');
    expect(route).toContain('generatedAt: now');
  });

  it('does not expose balancing modifiers through the player-safe event projection', () => {
    expect(projector).toContain('instanceId: instance.instanceId');
    expect(projector).toContain('target: resolveTarget');
    expect(projector).not.toContain('modifiers: instance.modifiers');
    expect(projector).not.toContain('priority: instance.priority');
  });
});
