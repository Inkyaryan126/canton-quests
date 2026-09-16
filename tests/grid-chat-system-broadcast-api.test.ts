import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relative: string) { return fs.readFileSync(path.join(process.cwd(), relative), 'utf8'); }

describe('Grid Commander chat broadcast API', () => {
  it('requires canonical admin authorization and enabled Grid chat', () => {
    const route = source('app/api/admin/grid/chat/broadcast/route.ts');
    expect(route).toContain('resolveAdminSessionFromRequest');
    expect(route).toContain('!admin.isAdmin');
    expect(route).toContain('isGridChatEnabled');
  });

  it('does not allow request bodies to spoof the system sender label', () => {
    const route = source('app/api/admin/grid/chat/broadcast/route.ts');
    const moderation = source('lib/grid/server/chat-moderation.ts');
    expect(route).not.toContain('body.senderLabel');
    expect(moderation).toContain("p_sender_label: 'COMMANDER'");
  });

  it('renders official system messages without player block/report controls', () => {
    const page = source('app/grid/chat/grid-chat-client.tsx');
    expect(page).toContain('SYSTEM //');
    expect(page).toContain('!message.sender.isSystem');
  });

  it('provides the GM console with a Commander broadcast composer', () => {
    const page = source('app/admin/grid-chat/page.tsx');
    expect(page).toContain('Commander Broadcast');
    expect(page).toContain('/api/admin/grid/chat/broadcast');
  });
});
