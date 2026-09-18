import type {
  GridPassportEvent,
  GridPassportProjection,
} from '../core/passport-types';

export interface GridPassportPersistencePort {
  listCareerEvents(playerId: string): Promise<GridPassportEvent[]>;
  saveProjection(
    playerId: string,
    projection: GridPassportProjection,
    rebuiltAt: string,
  ): Promise<void>;
}
