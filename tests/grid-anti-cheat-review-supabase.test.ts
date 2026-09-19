import { describe, expect, it, vi } from 'vitest';
import { createSupabaseGridAntiCheatReviewPort } from '../lib/grid/server/supabase-anti-cheat-review';
import type { GridAntiCheatReviewCommand } from '../lib/grid/server/anti-cheat-review-port';

const commandFixture: GridAntiCheatReviewCommand = {
  cityId: '10000000-0000-4000-8000-000000000001',
  seasonId: '10000000-0000-4000-8000-000000000002',
  playerId: '10000000-0000-4000-8000-000000000003',
  actionId: 'action-1',
  assessmentKey: 'assessment-1',
  createdAt: '2026-09-18T12:00:00.000Z',
  assessment: { riskScoreBps: 8500, disposition: 'review', signalIds: ['action-1:velocity-anomaly'], hardRejectSignalIds: [] },
  signals: [{ id: 'action-1:velocity-anomaly', kind: 'velocity-anomaly', severity: 'high', confidenceBps: 9000, source: 'behavior-analysis', reasonCode: 'too-fast' }],
};

describe('Supabase Grid anti-cheat review adapter', () => {
  it('requires service-role configuration', () => {
    expect(() => createSupabaseGridAntiCheatReviewPort(null as any)).toThrow(
      'Grid anti-cheat review requires Supabase service-role configuration',
    );
  });

  it('uses the atomic server-only assessment RPC with ordered evidence', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { assessmentId: 'assessment-1', idempotent: false, assessment: commandFixture.assessment },
      error: null,
    });
    const port = createSupabaseGridAntiCheatReviewPort({ rpc } as any);

    await expect(port.recordAssessment(commandFixture)).resolves.toMatchObject({ idempotent: false });
    expect(rpc).toHaveBeenCalledWith('grid_record_anti_cheat_assessment', expect.objectContaining({
      p_assessment_key: 'assessment-1',
      p_signal_ids: ['action-1:velocity-anomaly'],
      p_signals: commandFixture.signals,
    }));
  });

  it('maps queue reads and review-state audit writes through private RPCs', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [{ assessmentId: 'assessment-1', status: 'pending' }], error: null })
      .mockResolvedValueOnce({ data: { assessmentId: 'assessment-1', status: 'resolved', resolution: { outcome: 'no-action' } }, error: null });
    const port = createSupabaseGridAntiCheatReviewPort({ rpc } as any);

    await expect(port.listReviewQueue()).resolves.toEqual([{ assessmentId: 'assessment-1', status: 'pending' }]);
    await expect(port.recordReview({
      assessmentId: 'assessment-1', status: 'resolved', resolution: { outcome: 'no-action' },
    })).resolves.toMatchObject({ status: 'resolved' });
    expect(rpc).toHaveBeenNthCalledWith(1, 'grid_list_anti_cheat_review_queue', { p_limit: 100 });
    expect(rpc).toHaveBeenNthCalledWith(2, 'grid_record_anti_cheat_review', expect.objectContaining({
      p_assessment_id: 'assessment-1', p_status: 'resolved',
    }));
  });
});
