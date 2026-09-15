import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSeededRng } from '../lib/grid/sim/rng';
import { runGridSimulation } from '../lib/grid/sim/runner';
import { createSeededRng as indexRng, runGridSimulation as indexRunner } from '../lib/grid/sim';

describe('Grid simulation foundation', () => {
  describe('Seeded RNG (createSeededRng)', () => {
    it('produces identical random streams for the same seed', () => {
      const a = createSeededRng(12345);
      const b = createSeededRng(12345);

      const streamA = [a(), a(), a(), a(), a()];
      const streamB = [b(), b(), b(), b(), b()];

      expect(streamA).toEqual(streamB);
    });

    it('produces different random streams for different seeds', () => {
      const a = createSeededRng(12345);
      const b = createSeededRng(54321);

      const streamA = [a(), a(), a(), a(), a()];
      const streamB = [b(), b(), b(), b(), b()];

      expect(streamA).not.toEqual(streamB);
    });

    it('produces numbers uniformly within the [0, 1) interval', () => {
      const rng = createSeededRng(999);
      for (let i = 0; i < 1000; i++) {
        const val = rng();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    it('fails clearly for non-finite or invalid seed inputs', () => {
      expect(() => createSeededRng(NaN)).toThrow('Seed must be a finite number');
      expect(() => createSeededRng(Infinity)).toThrow('Seed must be a finite number');
      expect(() => createSeededRng(-Infinity)).toThrow('Seed must be a finite number');
      expect(() => createSeededRng('12345' as unknown as number)).toThrow('Seed must be a finite number');
    });

    it('is exported from index.ts matching direct module export', () => {
      const direct = createSeededRng(42);
      const indexed = indexRng(42);
      expect([direct(), direct()]).toEqual([indexed(), indexed()]);
    });
  });

  describe('Simulation Runner (runGridSimulation)', () => {
    it('replays a scenario deterministically', () => {
      const run = () =>
        runGridSimulation({
          seed: 42,
          steps: 5,
          initialState: 0,
          advance: (state, rng) => state + (rng() > 0.5 ? 2 : 1),
        });

      expect(run()).toEqual(run());
      expect(run()).toHaveLength(6);
    });

    it('produces different trajectories when given different seeds', () => {
      const runScenario = (seed: number) =>
        runGridSimulation({
          seed,
          steps: 10,
          initialState: 100,
          advance: (state, rng) => state + (rng() > 0.5 ? 10 : -10),
        });

      expect(runScenario(101)).not.toEqual(runScenario(202));
    });

    it('supports 0 steps and returns only the initial state', () => {
      const results = runGridSimulation({
        seed: 777,
        steps: 0,
        initialState: { balance: 500 },
        advance: (state) => ({ balance: state.balance + 10 }),
      });

      expect(results).toEqual([{ balance: 500 }]);
      expect(results).toHaveLength(1);
    });

    it('passes the step index accurately to the advance function', () => {
      const recordedSteps: number[] = [];
      runGridSimulation({
        seed: 1,
        steps: 4,
        initialState: null,
        advance: (_, __, step) => {
          recordedSteps.push(step);
          return null;
        },
      });

      expect(recordedSteps).toEqual([0, 1, 2, 3]);
    });

    it('is exported from index.ts matching direct module runner', () => {
      const params = {
        seed: 88,
        steps: 3,
        initialState: 1,
        advance: (s: number) => s * 2,
      };
      expect(runGridSimulation(params)).toEqual(indexRunner(params));
    });

    describe('invalid step counts and inputs fail clearly', () => {
      it('fails clearly when steps is a negative integer', () => {
        expect(() =>
          runGridSimulation({
            seed: 123,
            steps: -1,
            initialState: 0,
            advance: (s) => s + 1,
          })
        ).toThrow('Grid simulation steps must be a non-negative integer');
      });

      it('fails clearly when steps is a floating point number', () => {
        expect(() =>
          runGridSimulation({
            seed: 123,
            steps: 3.5,
            initialState: 0,
            advance: (s) => s + 1,
          })
        ).toThrow('Grid simulation steps must be a non-negative integer');
      });

      it('fails clearly when steps is NaN or infinite', () => {
        expect(() =>
          runGridSimulation({
            seed: 123,
            steps: NaN,
            initialState: 0,
            advance: (s) => s + 1,
          })
        ).toThrow('Grid simulation steps must be a non-negative integer');

        expect(() =>
          runGridSimulation({
            seed: 123,
            steps: Infinity,
            initialState: 0,
            advance: (s) => s + 1,
          })
        ).toThrow('Grid simulation steps must be a non-negative integer');
      });

      it('fails clearly when steps is not a number or missing', () => {
        expect(() =>
          runGridSimulation({
            seed: 123,
            steps: '10' as unknown as number,
            initialState: 0,
            advance: (s) => s + 1,
          })
        ).toThrow('Grid simulation steps must be a non-negative integer');
      });

      it('fails clearly when advance is not a function', () => {
        expect(() =>
          runGridSimulation({
            seed: 123,
            steps: 3,
            initialState: 0,
            advance: null as unknown as (s: number) => number,
          })
        ).toThrow('Grid simulation advance must be a function');
      });
    });
  });

  describe('Isolation & architectural boundaries', () => {
    it('has zero dependencies on Supabase, Canton, or UI in lib/grid/sim', () => {
      const simDir = path.resolve(__dirname, '../lib/grid/sim');
      const files = fs.readdirSync(simDir).filter((f) => f.endsWith('.ts'));

      expect(files.length).toBeGreaterThanOrEqual(2);

      const forbiddenPatterns = [
        /supabase/i,
        /canton/i,
        /40\.7989/,
        /-81\.3748/,
        /react/i,
        /from\s+['\"]next(?:\/|['\"])/i,
        /@supabase/,
      ];

      for (const file of files) {
        const content = fs.readFileSync(path.join(simDir, file), 'utf-8');
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(content),
            `File lib/grid/sim/${file} matched forbidden pattern ${pattern}`
          ).toBe(false);
        }
      }
    });
  });
});
