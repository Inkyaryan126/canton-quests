export type GridScrimmageStatus =
  | 'lobby'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface GridScrimmageRules {
  minPlayers: number;
  maxPlayers: number;
  requireAllReady: boolean;
}

export interface GridScrimmageParticipant {
  playerId: string;
  joinedAt: string;
  ready: boolean;
}

export interface GridScrimmageCombatantState {
  playerId: string;
  remainingInfluence: number;
  roundWins: number;
  roundLosses: number;
  draws: number;
  eliminated: boolean;
}

export interface GridScrimmageRoundRecord {
  roundNumber: number;
  attackerPlayerId: string;
  defenderPlayerId: string;
  attackerRolls: number[];
  defenderRolls: number[];
  attackerInfluenceLost: number;
  defenderInfluenceLost: number;
  winner: 'attacker' | 'defender' | 'draw';
}

export interface GridScrimmageMatchState {
  startingInfluencePerPlayer: number;
  roundNumber: number;
  winnerPlayerId: string | null;
  roundHistory: GridScrimmageRoundRecord[];
  combatants: GridScrimmageCombatantState[];
  lastRound: GridScrimmageRoundRecord | null;
}

export interface GridScrimmageState {
  sessionId: string;
  cityId: string;
  hostPlayerId: string;
  inviteCode: string;
  status: GridScrimmageStatus;
  progressionScope: 'session-only';
  participants: GridScrimmageParticipant[];
  rules: GridScrimmageRules;
  match: GridScrimmageMatchState | null;
  revision: number;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
}

export interface GridCreateScrimmageCommand {
  sessionId: string;
  cityId: string;
  hostPlayerId: string;
  inviteCode: string;
  rules: GridScrimmageRules;
  now: string;
}

export interface GridJoinScrimmageCommand {
  playerId: string;
  inviteCode: string;
  now: string;
}

export interface GridSetScrimmageReadyCommand {
  playerId: string;
  ready: boolean;
}

export interface GridStartScrimmageCommand {
  playerId: string;
  now: string;
}

export interface GridLeaveScrimmageCommand {
  playerId: string;
}

export interface GridEndScrimmageCommand {
  playerId: string;
  now: string;
}

export interface GridResolveScrimmageDuelCommand {
  attackerPlayerId: string;
  defenderPlayerId: string;
  attackerRolls: number[];
  defenderRolls: number[];
  now: string;
}
