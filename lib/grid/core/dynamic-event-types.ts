export type GridDynamicEventKind =
  | 'economic-boom'
  | 'defense-disruption'
  | 'property-release'
  | 'auction-wave'
  | 'influence-surge'
  | 'npc-takeover'
  | 'landmark-crisis'
  | 'development-discount'
  | 'route-disruption'
  | 'location-cache'
  | 'custom';

export type GridDynamicEventTargetType =
  | 'city'
  | 'district'
  | 'territory'
  | 'property'
  | 'landmark'
  | 'route';

export interface GridDynamicEventTarget {
  type: GridDynamicEventTargetType;
  ids: string[];
}

export type GridDynamicEventModifier =
  | { key: string; operation: 'add-bps' | 'add-flat'; value: number }
  | { key: string; operation: 'set-flag'; value: boolean };

export interface GridDynamicEventTemplate {
  id: string;
  kind: GridDynamicEventKind;
  durationMinutes: number;
  priority: number;
  target: GridDynamicEventTarget;
  modifiers: GridDynamicEventModifier[];
  tags?: string[];
}

export interface GridDynamicEventInstance {
  instanceId: string;
  templateId: string;
  cityId: string;
  kind: GridDynamicEventKind;
  priority: number;
  startsAt: string;
  endsAt: string;
  target: GridDynamicEventTarget;
  modifiers: GridDynamicEventModifier[];
  tags: string[];
}

export type GridDynamicEventStatus = 'scheduled' | 'active' | 'ended';

export interface GridDynamicEventProjection {
  instanceId: string;
  templateId: string;
  status: GridDynamicEventStatus;
  active: boolean;
  startsAt: string;
  endsAt: string;
}

export interface GridDynamicEventEntityRef {
  cityId: string;
  type: Exclude<GridDynamicEventTargetType, 'city'>;
  id: string;
}

export interface GridDynamicEventStackProjection {
  activeEventIds: string[];
  additiveBps: Record<string, number>;
  additiveFlat: Record<string, number>;
  flags: Record<string, boolean>;
}
