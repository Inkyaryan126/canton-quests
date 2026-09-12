import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GridEventIdempotencyConflictError,
  type GridEventAppendInput,
  type GridEventLedgerPort,
  type GridLedgerEvent,
} from '../lib/grid/server/event-ledger-port';
import {
  GridEventReconciliationError,
  appendGridEvent,
} from '../lib/grid/server/event-ledger';

function baseInput(overrides: Partial<GridEventAppendInput> = {}): GridEventAppendInput {
  return {
    cityId: 'city-1',
    seasonId: 'season-1',
    eventType: 'territory.captured',
    entityType: 'territory',
    entityId: 'territory-1',
    payload: { capturedBy: 'player-1' },
    idempotencyKey: 'capture-1',
    ...overrides,
  };
}

class InMemoryGridEventLedger implements GridEventLedgerPort {
  private rows: GridLedgerEvent[] = [];
  private nextId = 1;
  insertCalls = 0;

  async insertEvent(input: GridEventAppendInput): Promise<GridLedgerEvent> {
    this.insertCalls += 1;

    if (input.idempotencyKey && input.seasonId) {
      const collision = this.rows.find(
        (row) =>
          row.seasonId === input.seasonId &&
          row.idempotencyKey === input.idempotencyKey
      );
      if (collision) {
        throw new GridEventIdempotencyConflictError(
          input.seasonId,
          input.idempotencyKey
        );
      }
    }

    const event: GridLedgerEvent = {
      id: `event-${this.nextId++}`,
      cityId: input.cityId,
      seasonId: input.seasonId ?? null,
      actorPlayerId: input.actorPlayerId ?? null,
      eventType: input.eventType,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      payload: input.payload ?? {},
      idempotencyKey: input.idempotencyKey ?? null,
      correlationId: input.correlationId ?? null,
      causationId: input.causationId ?? null,
      createdAt: new Date().toISOString(),
    };
    this.rows.push(event);
    return event;
  }

  async findByIdempotencyKey(
    seasonId: string,
    idempotencyKey: string
  ): Promise<GridLedgerEvent | null> {
    return (
      this.rows.find(
        (row) => row.seasonId === seasonId && row.idempotencyKey === idempotencyKey
      ) ?? null
    );
  }
}

describe('appendGridEvent (domain service)', () => {
  it('returns the persisted event on a fresh append', async () => {
    const port = new InMemoryGridEventLedger();

    const result = await appendGridEvent(port, baseInput());

    expect(result.idempotent).toBe(false);
    expect(result.event.id).toBeTruthy();
    expect(result.event.eventType).toBe('territory.captured');
    expect(result.event.payload).toEqual({ capturedBy: 'player-1' });
  });

  it('returns the existing event on an idempotency collision instead of inserting again', async () => {
    const port = new InMemoryGridEventLedger();

    const first = await appendGridEvent(port, baseInput());
    const second = await appendGridEvent(port, baseInput());

    expect(second.idempotent).toBe(true);
    expect(second.event.id).toBe(first.event.id);
    expect(port.insertCalls).toBe(2);
  });

  it('fails loudly when an idempotency key collides with a materially different event', async () => {
    const port = new InMemoryGridEventLedger();

    await appendGridEvent(port, baseInput());

    await expect(
      appendGridEvent(
        port,
        baseInput({ payload: { capturedBy: 'a-different-player' } })
      )
    ).rejects.toThrow(GridEventReconciliationError);
  });

  it('fails loudly when an idempotency key is supplied without a season', async () => {
    const port = new InMemoryGridEventLedger();

    await expect(
      appendGridEvent(port, baseInput({ seasonId: null }))
    ).rejects.toThrow(/requires a seasonId/);
    expect(port.insertCalls).toBe(0);
  });

  it('propagates a reported collision as a hard failure if no matching event can be found', async () => {
    const port = new InMemoryGridEventLedger();
    port.insertEvent = async (input: GridEventAppendInput) => {
      throw new GridEventIdempotencyConflictError(
        input.seasonId as string,
        input.idempotencyKey as string
      );
    };

    await expect(appendGridEvent(port, baseInput())).rejects.toThrow(
      /no existing event could be found to reconcile/
    );
  });
});

// ---------------------------------------------------------------------------
// Supabase adapter — mocked client so the real insert/select wiring (not
// just the pure domain logic above) is exercised end-to-end.
// ---------------------------------------------------------------------------

describe('createSupabaseGridEventLedger (Supabase adapter)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../lib/supabase');
  });

  it('inserts through the server-side admin client and maps the persisted row', async () => {
    const insertedRows: any[] = [];
    const mockAdmin = {
      from: (table: string) => ({
        insert: (row: any) => ({
          select: () => ({
            single: async () => {
              insertedRows.push({ table, row });
              return {
                data: {
                  id: 'event-1',
                  city_id: row.city_id,
                  season_id: row.season_id,
                  actor_player_id: row.actor_player_id,
                  event_type: row.event_type,
                  entity_type: row.entity_type,
                  entity_id: row.entity_id,
                  payload: row.payload,
                  idempotency_key: row.idempotency_key,
                  correlation_id: row.correlation_id,
                  causation_id: row.causation_id,
                  created_at: '2026-09-12T00:00:00.000Z',
                },
                error: null,
              };
            },
          }),
        }),
      }),
    };

    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: null,
      supabaseAdmin: mockAdmin,
    }));

    const { createSupabaseGridEventLedger } = await import(
      '../lib/grid/server/supabase-event-ledger'
    );
    const ledger = createSupabaseGridEventLedger();

    const event = await ledger.insertEvent(baseInput());

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0].table).toBe('grid_game_events');
    expect(event).toEqual({
      id: 'event-1',
      cityId: 'city-1',
      seasonId: 'season-1',
      actorPlayerId: null,
      eventType: 'territory.captured',
      entityType: 'territory',
      entityId: 'territory-1',
      payload: { capturedBy: 'player-1' },
      idempotencyKey: 'capture-1',
      correlationId: null,
      causationId: null,
      createdAt: '2026-09-12T00:00:00.000Z',
    });
  });

  it('translates a unique-constraint violation into the port-level idempotency conflict error', async () => {
    const mockAdmin = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            }),
          }),
        }),
      }),
    };

    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: null,
      supabaseAdmin: mockAdmin,
    }));

    const { createSupabaseGridEventLedger } = await import(
      '../lib/grid/server/supabase-event-ledger'
    );
    const ledger = createSupabaseGridEventLedger();

    await expect(ledger.insertEvent(baseInput())).rejects.toThrow(
      GridEventIdempotencyConflictError
    );
  });

  it('finds an existing event by idempotency key', async () => {
    const mockAdmin = {
      from: (table: string) => ({
        select: (_cols?: string) => ({
          eq: (_col1: string, _val1: string) => ({
            eq: (_col2: string, _val2: string) => ({
              maybeSingle: async () => ({
                data: {
                  id: 'event-1',
                  city_id: 'city-1',
                  season_id: 'season-1',
                  actor_player_id: null,
                  event_type: 'territory.captured',
                  entity_type: 'territory',
                  entity_id: 'territory-1',
                  payload: { capturedBy: 'player-1' },
                  idempotency_key: 'capture-1',
                  correlation_id: null,
                  causation_id: null,
                  created_at: '2026-09-12T00:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: null,
      supabaseAdmin: mockAdmin,
    }));

    const { createSupabaseGridEventLedger } = await import(
      '../lib/grid/server/supabase-event-ledger'
    );
    const ledger = createSupabaseGridEventLedger();

    const found = await ledger.findByIdempotencyKey('season-1', 'capture-1');
    expect(found?.id).toBe('event-1');
    expect(found?.payload).toEqual({ capturedBy: 'player-1' });
  });

  it('returns null when no event exists for the idempotency key', async () => {
    const mockAdmin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    };

    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: true,
      supabase: null,
      supabaseAdmin: mockAdmin,
    }));

    const { createSupabaseGridEventLedger } = await import(
      '../lib/grid/server/supabase-event-ledger'
    );
    const ledger = createSupabaseGridEventLedger();

    const found = await ledger.findByIdempotencyKey('season-1', 'missing-key');
    expect(found).toBeNull();
  });

  it('fails loudly instead of falling back to the anon client when the admin client is not configured', async () => {
    vi.resetModules();
    vi.doMock('../lib/supabase', () => ({
      isSupabaseConfigured: true,
      isSupabaseAdminConfigured: false,
      supabase: {},
      supabaseAdmin: null,
    }));

    const { createSupabaseGridEventLedger } = await import(
      '../lib/grid/server/supabase-event-ledger'
    );
    const ledger = createSupabaseGridEventLedger();

    await expect(ledger.insertEvent(baseInput())).rejects.toThrow(
      /server-side Supabase admin client/
    );
    await expect(
      ledger.findByIdempotencyKey('season-1', 'capture-1')
    ).rejects.toThrow(/server-side Supabase admin client/);
  });
});
