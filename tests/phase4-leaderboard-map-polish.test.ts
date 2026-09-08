import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Phase 4 — leaderboard, map presentation, and interface states', () => {
  it('keeps leaderboard data pending until it can show a clear loading, failure, or loaded state', () => {
    const source = readSource('app/leaderboard/page.tsx');

    expect(source).toContain('const [isLoading, setIsLoading]');
    expect(source).toContain('const [loadError, setLoadError]');
    expect(source).toContain('state="scanning"');
    expect(source).toContain('state="denied"');
    expect(source).toContain('Retry Standings');
    expect(source).toContain('response.ok');
  });

  it('uses the shared HUD, status, and ranking primitives in the reusable leaderboard', () => {
    const source = readSource('components/Leaderboard.tsx');

    expect(source).toContain('SystemStatusBadge');
    expect(source).toContain('cq-hud-panel');
    expect(source).toContain('cq-rank-row');
    expect(source).toContain('cq-empty-state');
    expect(source).not.toMatch(/className="[^"]*\b(?:glass-panel|overflow-hidden|p-4|flex|text-gray-400)\b/);
  });

  it('presents the Canton field scanner as shared equipment with a true zero-node state', () => {
    const source = readSource('components/CantonMap.tsx');

    expect(source).toContain('SystemStatusBadge');
    expect(source).toContain('cq-hud-panel');
    expect(source).toContain('cq-motion-scope');
    expect(source).toContain('quests.length === 0');
    expect(source).toContain('NO FIELD NODES');
    expect(source).not.toContain('animate-bounce');
  });

  it('aligns both Sector Map panels and its empty dispatch state with the shared HUD language', () => {
    const source = readSource('components/SectorMap.tsx');

    expect(source).toContain('cq-sector-map-root cq-motion-scope');
    expect(source.match(/panel cq-hud-panel/g)).toHaveLength(2);
    expect(source).toContain('cq-empty-state');
    expect(source).toContain('AWAITING FIELD DISPATCHES');
  });

  it('preserves the canonical map coordinates, public tiles, and quest destination', () => {
    const cantonMap = readSource('components/CantonMap.tsx');
    const sectorMap = readSource('components/SectorMap.tsx');

    expect(cantonMap).toContain('const CANTON_CENTER: [number, number] = [40.7989, -81.3748]');
    expect(cantonMap).toContain('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(cantonMap).toContain('`/events/${eventSlug}/quests/${selectedQuest.quest.id}`');
    expect(sectorMap).toContain('export const SECTOR_ZONES: SectorZone[] = [');
  });
});
