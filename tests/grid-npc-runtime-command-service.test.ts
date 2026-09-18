import { describe, expect, it, vi } from 'vitest';
import type { GridNpcStrongholdRuntimeCommandPort } from '../lib/grid/server/npc-stronghold-runtime-command-port';
import {
  setGridNpcFactionPressure,
  setGridNpcStrongholdEventActive,
  setGridNpcSurgeIntensity,
} from '../lib/grid/server/npc-stronghold-runtime-command-service';

const now = '2026-09-18T07:30:00.000Z';
function port(): GridNpcStrongholdRuntimeCommandPort {
  return {
    setSurgeIntensity: vi.fn().mockResolvedValue({
      surgeIntensityBps: 4_000, eventId: 'event-1', duplicate: false, updatedAt: now,
    }),
    setFactionPressure: vi.fn().mockResolvedValue({
      factionId: 'wardens', pressureBps: 5_000, eventId: 'event-2', duplicate: false, updatedAt: now,
    }),
    setStrongholdEvent: vi.fn().mockResolvedValue({
      strongholdId: 'fort-1', active: true, eventId: 'event-3', duplicate: false, updatedAt: now,
    }),
  };
}
const base = {
  seasonId: 'season-1', cityId: 'city-1', actorPlayerId: null,
  idempotencyKey: 'npc:1', now,
};

describe('Grid NPC runtime command service', () => {
  it('validates and forwards Surge intensity including explicit null clearing', async () => {
    const p = port();
    await setGridNpcSurgeIntensity(p, { ...base, surgeIntensityBps: 4_000 });
    expect(p.setSurgeIntensity).toHaveBeenCalledWith({ ...base, surgeIntensityBps: 4_000 });
    await expect(setGridNpcSurgeIntensity(p, { ...base, surgeIntensityBps: null })).resolves.toBeTruthy();
    await expect(setGridNpcSurgeIntensity(p, { ...base, surgeIntensityBps: 10_001 })).rejects.toThrow('0..10000');
  });

  it('validates faction pressure identity and bounds before persistence', async () => {
    const p = port();
    await setGridNpcFactionPressure(p, { ...base, factionId: 'wardens', pressureBps: 5_000 });
    expect(p.setFactionPressure).toHaveBeenCalled();
    await expect(setGridNpcFactionPressure(p, { ...base, factionId: ' ', pressureBps: 5_000 })).rejects.toThrow('factionId');
    await expect(setGridNpcFactionPressure(p, { ...base, factionId: 'wardens', pressureBps: -1 })).rejects.toThrow('0..10000');
  });

  it('requires explicit boolean stronghold event state', async () => {
    const p = port();
    await setGridNpcStrongholdEventActive(p, { ...base, strongholdId: 'fort-1', active: true });
    expect(p.setStrongholdEvent).toHaveBeenCalled();
    await expect(setGridNpcStrongholdEventActive(p, {
      ...base, strongholdId: 'fort-1', active: null as unknown as boolean,
    })).rejects.toThrow('active must be boolean');
  });

  it('rejects malformed base command fields before any port write', async () => {
    const p = port();
    await expect(setGridNpcSurgeIntensity(p, {
      ...base, seasonId: ' ', surgeIntensityBps: 1,
    })).rejects.toThrow('seasonId');
    expect(p.setSurgeIntensity).not.toHaveBeenCalled();
  });
});
