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

export interface GridScrimmageState {
  sessionId: string;
  cityId: string;
  hostPlayerId: string;
  inviteCode: string;
  status: GridScrimmageStatus;
  progressionScope: 'session-only';
  participants: GridScrimmageParticipant[];
  rules: GridScrimmageRules;
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
