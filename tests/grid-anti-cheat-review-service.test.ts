import { describe, expect, it, vi } from 'vitest';
import type {
  GridAntiCheatReviewCommand,
  GridAntiCheatReviewPort,
} from '../lib/grid/server/anti-cheat-review-port';
import {
  listGridAntiCheatReviewQueue,
  recordGridAntiCheatAssessment,
  recordGridAntiCheatReview,
} from '../lib/grid/server/anti-cheat-review-service';

const command: GridAntiCheatReviewCommand = {
  cityId: '10000000-0000-4000-8000-000000000001',
  seasonId: '10000000-0000-4000-8000-000000000002',
  playerId: '10000000-0000-4000-8000-000000000003',
  actionId: 'action-1',
  assessmentKey: 'assessment-1',
  createdAt: '2026-09-18T12:00:00.000Z',
  assessment: {
    riskScoreBps: 8500,
    disposition: 'review',
    signalIds: ['action-1:velocity-anomaly'],
    hardRejectSignalIds: [],
  },
  signals: [{
    id: 'action-1:velocity-anomaly',
    kind: 'velocity-anomaly',
    severity: 'high',
    confidenceBps: 9000,
    source: 'behavior-analysis',
    reasonCode: 'too-fast',
  }],
};

describe('Grid anti-cheat review service', () => {
  it('validates immutable assessment evidence before persistence', async () => {
    const port: GridAntiCheatReviewPort = {
      recordAssessment: vi.fn(),
      listReviewQueue: vi.fn(),
      recordReview: vi.fn(),
    };

    await expect(recordGridAntiCheatAssessment(port, {
      ...command,
      assessment: { ...command.assessment, signalIds: [] },
    })).rejects.toThrow('signalIds must match ordered signal evidence');
    expect(port.recordAssessment).not.toHaveBeenCalled();
  });

  it('forwards a validated assessment and preserves replay result', async () => {
    const result = {
      assessmentId: '10000000-0000-4000-8000-000000000004',
      idempotent: false,
      assessment: command.assessment,
    };
    const port: GridAntiCheatReviewPort = {
      recordAssessment: vi.fn().mockResolvedValue(result),
      listReviewQueue: vi.fn(),
      recordReview: vi.fn(),
    };

    await expect(recordGridAntiCheatAssessment(port, command)).resolves.toEqual(result);
    expect(port.recordAssessment).toHaveBeenCalledWith(command);
  });

  it('only permits review queue dispositions and audit-only state changes', async () => {
    const port: GridAntiCheatReviewPort = {
      recordAssessment: vi.fn(),
      listReviewQueue: vi.fn().mockResolvedValue([]),
      recordReview: vi.fn().mockResolvedValue({
        assessmentId: 'assessment-1',
        status: 'resolved',
        resolution: { outcome: 'no-action' },
      }),
    };

    await expect(listGridAntiCheatReviewQueue(port)).resolves.toEqual([]);
    await expect(recordGridAntiCheatReview(port, {
      assessmentId: 'assessment-1',
      status: 'resolved',
      resolution: { outcome: 'no-action' },
    })).resolves.toMatchObject({ status: 'resolved' });
    await expect(recordGridAntiCheatReview(port, {
      assessmentId: 'assessment-1',
      status: 'resolved',
      resolution: null,
    })).rejects.toThrow('resolution metadata');
  });
});
