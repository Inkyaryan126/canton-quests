import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Phase 4 — Player File, operation cards, and navigation polish', () => {
  it('uses the shared HUD and system-status primitives for operation cards without utility-class styling', () => {
    const source = readSource('components/OperationCard.tsx');

    expect(source).toContain('SystemStatusBadge');
    expect(source).toContain('cq-hud-panel');
    expect(source).toContain('cq-motion-scope');
    expect(source).not.toMatch(/className="[^"]*\b(?:relative|flex|rounded-3xl|p-6|text-stone-400|gap-4)\b/);
  });

  it('keeps every operation destination and player-facing action unchanged', () => {
    const source = readSource('components/OperationCard.tsx');

    expect(source).toContain('`/events/archive/${event.slug}`');
    expect(source).toContain('`/events/${event.slug}`');
    expect(source).toContain("status === 'ENDED' ? 'VIEW RESULTS' : 'ENTER MISSION'");
    expect(source).toContain('RANKINGS');
  });

  it('presents Player File loading and failure as explicit terminal states with retry', () => {
    const source = readSource('app/profile/page.tsx');

    expect(source).toContain('<HudSystemState');
    expect(source).toContain('state="scanning"');
    expect(source).toContain('Retry Player File');
    expect(source).not.toContain('<p>Authentication required.</p>');
  });

  it('applies the shared motion scope to both navigation shells without changing their destinations', () => {
    const cinematicNav = readSource('components/CinematicNav.tsx');
    const header = readSource('components/Header.tsx');

    expect(cinematicNav).toContain('className="cq-nav cq-motion-scope"');
    expect(header).toContain('className="cq-header-bar cq-motion-scope"');
    expect(cinematicNav).toContain("{ href: '/#operations', label: 'MISSIONS' }");
    expect(header).toContain('href={`/events/${eventSlug}/map`}');
  });
});
