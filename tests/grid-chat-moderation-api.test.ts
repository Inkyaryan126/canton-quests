import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string) {
  return fs.readFileSync(path.join(process.cwd(), relative), 'utf8');
}

describe('Grid chat moderation HTTP contract', () => {
  it('requires the canonical admin session on both report routes', () => {
    for (const route of [
      'app/api/admin/grid/chat/reports/route.ts',
      'app/api/admin/grid/chat/reports/[reportId]/route.ts',
    ]) {
      expect(source(route)).toContain('resolveAdminSessionFromRequest');
      expect(source(route)).toContain('!admin.isAdmin');
    }
  });

  it('limits moderation actions to the explicit command set', () => {
    const route = source('app/api/admin/grid/chat/reports/[reportId]/route.ts');
    for (const action of ['hide', 'remove', 'restore', 'dismiss']) expect(route).toContain(`'${action}'`);
  });

  it('uses the authoritative moderation RPC instead of direct browser mutation', () => {
    expect(source('lib/grid/server/chat-moderation.ts')).toContain("client.rpc('grid_moderate_chat_report'");
    expect(source('app/admin/grid-chat/page.tsx')).not.toContain("from('grid_chat_messages')");
  });
});
