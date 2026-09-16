import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/20260916070000_grid_chat_foundation.sql'),
  'utf8',
).toLowerCase();

describe('Grid chat moderation command', () => {
  it('supports hide, remove, restore, and dismiss actions', () => {
    for (const action of ['hide', 'remove', 'restore', 'dismiss']) {
      expect(sql).toContain(`'${action}'`);
    }
  });

  it('resolves all active reports tied to a moderated message', () => {
    expect(sql).toContain('where message_id = v_report.message_id');
    expect(sql).toContain("status in ('pending', 'reviewing')");
  });

  it('records a non-sensitive reviewer label without requiring an admin player identity', () => {
    expect(sql).toContain('reviewed_by_label');
    expect(sql).toContain('p_reviewer_label');
  });
});
