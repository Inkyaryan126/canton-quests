import { NextResponse } from 'next/server';
import { resolveAdminSessionFromRequest } from '@/lib/admin-auth';
import { cantonFoundingSeasonPackage } from '@/lib/grid/cities/canton/founding-season';
import type {
  GridDynamicEventKind,
  GridDynamicEventModifier,
  GridDynamicEventTarget,
  GridDynamicEventTargetType,
  GridDynamicEventTemplate,
} from '@/lib/grid/core/dynamic-event-types';
import {
  listActiveGridDynamicEvents,
  startGridDynamicEvent,
} from '@/lib/grid/server/dynamic-event-service';
import { isGridWorldReadEnabled } from '@/lib/grid/server/feature-flags';
import { createSupabaseGridDynamicEventPort } from '@/lib/grid/server/supabase-dynamic-events';

export const dynamic = 'force-dynamic';

const EVENT_KINDS = new Set<GridDynamicEventKind>([
  'economic-boom',
  'defense-disruption',
  'property-release',
  'auction-wave',
  'influence-surge',
  'npc-takeover',
  'landmark-crisis',
  'development-discount',
  'route-disruption',
  'location-cache',
  'custom',
]);

const TARGET_TYPES = new Set<GridDynamicEventTargetType>([
  'city',
  'district',
  'territory',
  'property',
  'landmark',
  'route',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requestError(message: string): never {
  throw new Error('Invalid Grid dynamic event request: ' + message);
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    return requestError(field + ' is required');
  }
  return value.trim();
}

function integer(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    return requestError(field + ' must be a safe integer');
  }
  return value;
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    return requestError(field + ' must be an array');
  }
  return value.map((item, index) =>
    requiredString(item, field + '[' + index + ']'),
  );
}

function parseTarget(value: unknown): GridDynamicEventTarget {
  if (!isRecord(value)) return requestError('template.target is required');

  const type = requiredString(value.type, 'template.target.type');
  if (!TARGET_TYPES.has(type as GridDynamicEventTargetType)) {
    return requestError('template.target.type is not supported');
  }

  return {
    type: type as GridDynamicEventTargetType,
    ids: stringArray(value.ids, 'template.target.ids'),
  };
}

function parseModifier(value: unknown, index: number): GridDynamicEventModifier {
  if (!isRecord(value)) {
    return requestError('template.modifiers[' + index + '] must be an object');
  }

  const key = requiredString(value.key, 'template.modifiers[' + index + '].key');
  const operation = requiredString(
    value.operation,
    'template.modifiers[' + index + '].operation',
  );

  if (operation === 'set-flag') {
    if (typeof value.value !== 'boolean') {
      return requestError(
        'template.modifiers[' + index + '].value must be boolean',
      );
    }
    return { key, operation, value: value.value };
  }

  if (operation !== 'add-bps' && operation !== 'add-flat') {
    return requestError(
      'template.modifiers[' + index + '].operation is not supported',
    );
  }

  return {
    key,
    operation,
    value: integer(value.value, 'template.modifiers[' + index + '].value'),
  };
}

function parseTemplate(value: unknown): GridDynamicEventTemplate {
  if (!isRecord(value)) return requestError('template is required');

  const kind = requiredString(value.kind, 'template.kind');
  if (!EVENT_KINDS.has(kind as GridDynamicEventKind)) {
    return requestError('template.kind is not supported');
  }

  if (!Array.isArray(value.modifiers)) {
    return requestError('template.modifiers must be an array');
  }

  const tags =
    value.tags === undefined ? [] : stringArray(value.tags, 'template.tags');

  return {
    id: requiredString(value.id, 'template.id'),
    kind: kind as GridDynamicEventKind,
    durationMinutes: integer(
      value.durationMinutes,
      'template.durationMinutes',
    ),
    priority: integer(value.priority, 'template.priority'),
    target: parseTarget(value.target),
    modifiers: value.modifiers.map(parseModifier),
    tags,
  };
}

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function validationStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  return message.startsWith('Invalid Grid dynamic event request:') ||
    message.includes('dynamic event') &&
      !message.startsWith('Failed to') &&
      !message.includes('requires Supabase')
    ? 400
    : 500;
}

export async function GET(request: Request) {
  const admin = resolveAdminSessionFromRequest(request);
  if (!admin.isAdmin) {
    return noStore({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isGridWorldReadEnabled()) {
    return noStore(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }

  try {
    const now = new Date().toISOString();
    const events = await listActiveGridDynamicEvents(
      createSupabaseGridDynamicEventPort(),
      {
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        now,
      },
    );

    return noStore({ success: true, now, events });
  } catch (error) {
    console.error('[Grid admin dynamic events GET]', error);
    return noStore(
      { success: false, error: 'Failed to read Grid dynamic events.' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const admin = resolveAdminSessionFromRequest(request);
  if (!admin.isAdmin) {
    return noStore({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (!isGridWorldReadEnabled()) {
    return noStore(
      { success: false, error: 'Grid runtime is not enabled.' },
      { status: 404 },
    );
  }

  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) requestError('body must be an object');

    const startsAt =
      body.startsAt === undefined
        ? new Date().toISOString()
        : requiredString(body.startsAt, 'startsAt');

    const result = await startGridDynamicEvent(
      createSupabaseGridDynamicEventPort(),
      parseTemplate(body.template),
      {
        instanceId: requiredString(body.instanceId, 'instanceId'),
        idempotencyKey: requiredString(
          body.idempotencyKey,
          'idempotencyKey',
        ),
        citySlug: cantonFoundingSeasonPackage.city.slug,
        seasonSlug: cantonFoundingSeasonPackage.seasonTemplate.slug,
        startsAt,
      },
    );

    return noStore({
      success: true,
      duplicate: result.duplicate,
      event: result.instance,
    });
  } catch (error) {
    const status = validationStatus(error);
    if (status === 500) {
      console.error('[Grid admin dynamic events POST]', error);
    }
    return noStore(
      {
        success: false,
        error:
          status === 400 && error instanceof Error
            ? error.message
            : 'Failed to start Grid dynamic event.',
      },
      { status },
    );
  }
}
