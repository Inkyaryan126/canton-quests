import { describe, expect, it, vi } from 'vitest';
import {
  appendGridEvent,
  type GridEventInput,
  type GridGameEvent,
} from '../lib/grid/server/event-ledger';
import type { GridEventLedgerPort } from '../lib/grid/server/event-ledger-port';
import { createSupabaseGridEventLedgerPort } from '../lib/grid/server/supabase-event-ledger';

function input(): GridEventInput {
  return {
    cityId: '00000000-0000-4000-8000-000000000001',
    seasonId: '00000000-0000-4000-8000-000000000002',
    actorPlayerId: '00000000-0000-4000-8000-000000000003',
    eventType: 'PLAYER_SEASON_JOINED',
    entityType: 'player',
    entityId: '00000000-0000-4000-8000-000000000003',
    payload: { source: 'test' },
    idempotencyKey: 'join:player-3',
  };
}

describe('appendGridEvent', () => {
  it('returns the inserted event', async () => {
    const expected: GridGameEvent = {
      id: '00000000-0000-4000-8000-000000000004',
      ...input(),
      actorPlayerId: input().actorPlayerId ?? null,
      entityType: input().entityType ?? null,
      entityId: input().entityId ?? null,
      payload: input().payload ?? {},
      idempotencyKey: input().idempotencyKey ?? null,
      correlationId: null,
      causationId: null,
      createdAt: '2026-09-11T00:00:00.000Z',
    };

    const port: GridEventLedgerPort = {
      insert: async () => ({ event: expected, duplicate: false }),
      getByIdempotencyKey: async () => null,
    };

    await expect(appendGridEvent(port, input())).resolves.toEqual(expected);
  });

  it('returns the existing event on an idempotency collision', async () => {
    const expected: GridGameEvent = {
      id: '00000000-0000-4000-8000-000000000004',
      ...input(),
      actorPlayerId: input().actorPlayerId ?? null,
      entityType: input().entityType ?? null,
      entityId: input().entityId ?? null,
      payload: input().payload ?? {},
      idempotencyKey: input().idempotencyKey ?? null,
      correlationId: null,
      causationId: null,
      createdAt: '2026-09-11T00:00:00.000Z',
    };

    const port: GridEventLedgerPort = {
      insert: async () => ({ event: null, duplicate: true }),
      getByIdempotencyKey: async () => expected,
    };

    await expect(appendGridEvent(port, input())).resolves.toEqual(expected);
  });

  it('throws when a duplicate is reported but the existing event cannot be found', async () => {
    const port: GridEventLedgerPort = {
      insert: async () => ({ event: null, duplicate: true }),
      getByIdempotencyKey: async () => null,
    };

    await expect(appendGridEvent(port, input())).rejects.toThrow(
      'Grid idempotency collision could not be reconciled'
    );
  });

  it('throws when insert fails without duplicate flag and no event', async () => {
    const port: GridEventLedgerPort = {
      insert: async () => ({ event: null, duplicate: false }),
      getByIdempotencyKey: async () => null,
    };

    await expect(appendGridEvent(port, input())).rejects.toThrow(
      'Grid event insert failed without a persisted event'
    );
  });
});

describe('createSupabaseGridEventLedgerPort', () => {
  it('throws when client is not available', () => {
    expect(() => createSupabaseGridEventLedgerPort(null as any)).toThrow(
      'Grid event ledger requires Supabase service-role configuration'
    );
  });

  it('inserts and maps event successfully', async () => {
    const dbRow = {
      id: 'event-uuid-1',
      city_id: '00000000-0000-4000-8000-000000000001',
      season_id: '00000000-0000-4000-8000-000000000002',
      actor_player_id: '00000000-0000-4000-8000-000000000003',
      event_type: 'PLAYER_SEASON_JOINED',
      entity_type: 'player',
      entity_id: '00000000-0000-4000-8000-000000000003',
      payload: { source: 'test' },
      idempotency_key: 'join:player-3',
      correlation_id: null,
      causation_id: null,
      created_at: '2026-09-11T00:00:00.000Z',
    };

    const mockSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    const mockClient = { from: mockFrom } as any;

    const port = createSupabaseGridEventLedgerPort(mockClient);
    const result = await port.insert(input());

    expect(mockFrom).toHaveBeenCalledWith('grid_game_events');
    expect(mockInsert).toHaveBeenCalledWith({
      city_id: input().cityId,
      season_id: input().seasonId,
      actor_player_id: input().actorPlayerId,
      event_type: input().eventType,
      entity_type: input().entityType,
      entity_id: input().entityId,
      payload: input().payload,
      idempotency_key: input().idempotencyKey,
      correlation_id: null,
      causation_id: null,
    });
    expect(result.duplicate).toBe(false);
    expect(result.event).toEqual({
      id: 'event-uuid-1',
      cityId: dbRow.city_id,
      seasonId: dbRow.season_id,
      actorPlayerId: dbRow.actor_player_id,
      eventType: dbRow.event_type,
      entityType: dbRow.entity_type,
      entityId: dbRow.entity_id,
      payload: dbRow.payload,
      idempotencyKey: dbRow.idempotency_key,
      correlationId: null,
      causationId: null,
      createdAt: dbRow.created_at,
    });
  });

  it('detects duplicate key error 23505 and returns duplicate: true', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key value' },
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    const mockClient = { from: mockFrom } as any;

    const port = createSupabaseGridEventLedgerPort(mockClient);
    const result = await port.insert(input());

    expect(result).toEqual({ event: null, duplicate: true });
  });

  it('throws on unexpected insert error', async () => {
    const mockSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: '42P01', message: 'relation does not exist' },
    });
    const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
    const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
    const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });
    const mockClient = { from: mockFrom } as any;

    const port = createSupabaseGridEventLedgerPort(mockClient);
    await expect(port.insert(input())).rejects.toThrow(
      'Failed to append Grid event: relation does not exist'
    );
  });

  it('reconciles existing event by idempotency key with seasonId', async () => {
    const dbRow = {
      id: 'event-uuid-existing',
      city_id: '00000000-0000-4000-8000-000000000001',
      season_id: '00000000-0000-4000-8000-000000000002',
      actor_player_id: '00000000-0000-4000-8000-000000000003',
      event_type: 'PLAYER_SEASON_JOINED',
      entity_type: 'player',
      entity_id: '00000000-0000-4000-8000-000000000003',
      payload: { source: 'test' },
      idempotency_key: 'join:player-3',
      correlation_id: null,
      causation_id: null,
      created_at: '2026-09-11T00:00:00.000Z',
    };

    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    const mockEqSeason = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqKey = vi.fn().mockReturnValue({ eq: mockEqSeason });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqKey });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const mockClient = { from: mockFrom } as any;

    const port = createSupabaseGridEventLedgerPort(mockClient);
    const existing = await port.getByIdempotencyKey(
      '00000000-0000-4000-8000-000000000002',
      'join:player-3'
    );

    expect(mockFrom).toHaveBeenCalledWith('grid_game_events');
    expect(mockSelect).toHaveBeenCalledWith('*');
    expect(mockEqKey).toHaveBeenCalledWith('idempotency_key', 'join:player-3');
    expect(mockEqSeason).toHaveBeenCalledWith(
      'season_id',
      '00000000-0000-4000-8000-000000000002'
    );
    expect(existing?.id).toBe('event-uuid-existing');
  });

  it('reconciles existing event by idempotency key with null seasonId using is', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockIsSeason = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqKey = vi.fn().mockReturnValue({ is: mockIsSeason });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqKey });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const mockClient = { from: mockFrom } as any;

    const port = createSupabaseGridEventLedgerPort(mockClient);
    const existing = await port.getByIdempotencyKey(null, 'global-key');

    expect(mockEqKey).toHaveBeenCalledWith('idempotency_key', 'global-key');
    expect(mockIsSeason).toHaveBeenCalledWith('season_id', null);
    expect(existing).toBeNull();
  });

  it('throws when getByIdempotencyKey encounters a database error', async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'connection timeout' },
    });
    const mockEqSeason = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockEqKey = vi.fn().mockReturnValue({ eq: mockEqSeason });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEqKey });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
    const mockClient = { from: mockFrom } as any;

    const port = createSupabaseGridEventLedgerPort(mockClient);
    await expect(
      port.getByIdempotencyKey('season-1', 'key-1')
    ).rejects.toThrow('Failed to reconcile Grid event: connection timeout');
  });
});
