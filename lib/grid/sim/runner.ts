import { createSeededRng } from './rng';

export interface GridSimulationParams<T> {
  seed: number;
  steps: number;
  initialState: T;
  advance: (state: T, rng: () => number, step: number) => T;
}

export function runGridSimulation<T>(params: GridSimulationParams<T>): T[] {
  if (
    !params ||
    typeof params.steps !== 'number' ||
    !Number.isInteger(params.steps) ||
    params.steps < 0
  ) {
    throw new Error('Grid simulation steps must be a non-negative integer');
  }

  if (typeof params.advance !== 'function') {
    throw new Error('Grid simulation advance must be a function');
  }

  const rng = createSeededRng(params.seed);
  const states: T[] = [params.initialState];
  let current = params.initialState;

  for (let step = 0; step < params.steps; step += 1) {
    current = params.advance(current, rng, step);
    states.push(current);
  }

  return states;
}
