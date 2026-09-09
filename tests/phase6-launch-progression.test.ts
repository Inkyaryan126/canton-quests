import { describe, expect, it } from 'vitest';
import { getLaunchDistrictProgress, checkLaunchCompletionEligibility, LAUNCH_DISTRICT_QUESTS } from '../lib/finale';

const quests = Object.entries(LAUNCH_DISTRICT_QUESTS).flatMap(([path, slugs]) =>
  slugs.map(slug => ({ id: slug, slug, starting_path: path, status: 'active' })));
const completions = (slugs: readonly string[]) => slugs.map(quest_id => ({ quest_id, status: 'verified' }));

describe('Phase 6 — real launch district completion, separate from sigils', () => {
  it('uses the 5 / 5 / 4 launch roster, never legacy quest totals', () => {
    expect(Object.values(LAUNCH_DISTRICT_QUESTS).map(q => q.length)).toEqual([5, 5, 4]);
  });
  it.each(['family', 'challenge', 'secret'] as const)('one full %s district unlocks cemetery without all Locks or sigils', path => {
    const progress = getLaunchDistrictProgress(quests, completions(LAUNCH_DISTRICT_QUESTS[path]));
    expect(progress.completedDistrictCount).toBe(1);
    expect(progress.cemeteryUnlocked).toBe(true);
    expect(checkLaunchCompletionEligibility({ ok: true }, progress).ok).toBe(false);
  });
  it('partial, pending, duplicate and legacy quests cannot unlock a district', () => {
    const partial = completions(LAUNCH_DISTRICT_QUESTS.family.slice(0, 4));
    expect(getLaunchDistrictProgress(quests, [...partial, ...partial, { quest_id: 'palace-stars', status: 'pending' }, { quest_id: 'legacy', status: 'verified' }]).cemeteryUnlocked).toBe(false);
  });
  it('missing/inactive launch quests do not silently lower completion requirements', () => {
    expect(getLaunchDistrictProgress(quests.slice(1), completions(quests.map(q => q.id))).completedDistrictCount).toBe(2);
    expect(getLaunchDistrictProgress(quests.map(q => ({ ...q, status: 'inactive' })), completions(quests.map(q => q.id))).completedDistrictCount).toBe(0);
  });
  it('two districts progress without falsely awarding full completion', () => {
    const progress = getLaunchDistrictProgress(quests, completions([...LAUNCH_DISTRICT_QUESTS.family, ...LAUNCH_DISTRICT_QUESTS.secret]));
    expect(progress.completedDistrictCount).toBe(2);
    expect(progress.cemeteryUnlocked).toBe(true);
    expect(checkLaunchCompletionEligibility({ ok: true }, progress).ok).toBe(false);
  });
  it('three districts still require the existing Master Cipher gates', () => {
    const progress = getLaunchDistrictProgress(quests, completions(quests.map(q => q.id)));
    expect(progress.completedDistrictCount).toBe(3);
    expect(checkLaunchCompletionEligibility({ ok: true }, progress)).toEqual({ ok: true });
    const locks = { ok: false as const, reason: 'locks_required' as const, message: 'Locks required' };
    expect(checkLaunchCompletionEligibility(locks, progress)).toBe(locks);
  });
});
