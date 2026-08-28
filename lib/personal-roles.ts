/**
 * Canton Quests — Personal Missions & Secret Roles
 * ====================================================
 * Pure types and assignment/propagation logic. A player's role is private
 * by construction — nothing in this module ever takes "look up another
 * player's role" as an operation; every function here is scoped to one
 * player's own state. Enforcement doesn't stop at the API layer either —
 * see the migration's RLS policy, which grants a player SELECT on their
 * own player_personal_roles rows only, no exceptions.
 */

import { stableHash } from './bounties';

export type PersonalRoleType = 'MESSENGER' | 'WITNESS' | 'KEYHOLDER' | 'SIGNAL_CARRIER';

const ASSIGNABLE_CORE_ROLES: PersonalRoleType[] = ['MESSENGER', 'WITNESS', 'KEYHOLDER'];

export interface PersonalRoleDefinition {
  type: PersonalRoleType;
  title: string;
  /** The private mission text shown only to the player holding this role. */
  missionText: string;
}

export const PERSONAL_ROLE_DEFINITIONS: Record<PersonalRoleType, PersonalRoleDefinition> = {
  MESSENGER: { type: 'MESSENGER', title: 'The Messenger', missionText: 'Establish a field link with a player on a different starting path — carry word between the districts.' },
  WITNESS: { type: 'WITNESS', title: 'The Witness', missionText: 'Complete a mission others may have overlooked — the city is watching what you notice.' },
  KEYHOLDER: { type: 'KEYHOLDER', title: 'The Keyholder', missionText: 'Recover a district sigil — you hold something the convergence will eventually need.' },
  SIGNAL_CARRIER: { type: 'SIGNAL_CARRIER', title: 'Signal Carrier', missionText: 'You carry a signal. The next player you field-link with will carry it too — the city is counting how far it spreads.' },
};

/** Deterministic (same player+event always resolves to the same core role) — not random, not GM-manual, mirrors lib/bounties.ts's assignCoreBounty. */
export function assignCoreRole(playerId: string, eventId: string): PersonalRoleType {
  const index = stableHash(`role:${playerId}:${eventId}`) % ASSIGNABLE_CORE_ROLES.length;
  return ASSIGNABLE_CORE_ROLES[index];
}

export interface PersonalRoleState {
  type: PersonalRoleType;
  definition: PersonalRoleDefinition;
  origin: 'SEEDED' | 'PROPAGATED';
  isRevealed: boolean;
  assignedAt: string;
}

export interface SignalPropagationDecision {
  /** True if the first player (the one whose carrying status is `aCarries`) should newly receive the signal. */
  propagateToA: boolean;
  /** True if the second player should newly receive the signal. */
  propagateToB: boolean;
}

/**
 * The pure propagation rule, extracted for direct testability: exactly one
 * of the two players catches the signal from the other, and only when
 * exactly one of them already carries it — never both (nothing to spread),
 * never neither (no source). A repeated link between the same pair, once
 * both already carry it, always resolves to {false, false} — this is what
 * makes propagation immune to repeated-same-pair farming: there is no
 * "grant" left to repeat.
 */
export function decideSignalPropagation(aCarries: boolean, bCarries: boolean): SignalPropagationDecision {
  if (aCarries && !bCarries) return { propagateToA: false, propagateToB: true };
  if (bCarries && !aCarries) return { propagateToA: true, propagateToB: false };
  return { propagateToA: false, propagateToB: false };
}
