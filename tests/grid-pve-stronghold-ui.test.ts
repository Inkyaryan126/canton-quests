import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const page = fs.readFileSync(path.join(process.cwd(), 'app/grid/strongholds/page.tsx'), 'utf8');
const client = fs.readFileSync(path.join(process.cwd(), 'app/grid/strongholds/grid-strongholds-client.tsx'), 'utf8');
const css = fs.readFileSync(path.join(process.cwd(), 'app/globals.css'), 'utf8');

describe('Grid PvE Strongholds player UI', () => {
  it('ships a dedicated Strongholds page with player-facing metadata', () => {
    expect(page).toContain("title: 'Strongholds | The Grid'");
    expect(page).toContain('<GridStrongholdsClient />');
  });

  it('loads authoritative strongholds, active PvE contests, and world wallet state', () => {
    expect(client).toContain("fetch('/api/grid/strongholds'");
    expect(client).toContain("fetch('/api/grid/stronghold-contests'");
    expect(client).toContain("fetch('/api/grid/world'");
  });

  it('never asks a player to type a source territory and only renders server-derived candidates', () => {
    expect(client).toContain('stronghold.attackSourceTerritorySlugs');
    expect(client).toContain('sourceOptions.map');
    expect(client).not.toContain('placeholder="Territory slug');
  });

  it('uses existing affordable Signal Dice commitment bands instead of inventing PvE tiers', () => {
    expect(client).toContain('world?.player.attackCommitOptions');
    expect(client).toContain('.filter((option) => option.affordable)');
    expect(client).toContain('{option.influence} Influence // {option.dice} Dice');
  });

  it('sends no client dice, garrison, faction, target, or player identity in combat actions', () => {
    expect(client).toContain("idempotencyKey: idempotency('pve-round')");
    expect(client).not.toContain('attackerRolls:');
    expect(client).not.toContain('garrisonRolls:');
    expect(client).not.toContain('garrisonCommittedInfluence:');
    expect(client).not.toContain('attackerPlayerId:');
    expect(client).not.toContain('targetTerritorySlug:');
  });

  it('supports round, retreat, refresh/resume, and sanitized battle history', () => {
    expect(client).toContain('/round`');
    expect(client).toContain('/withdraw`');
    expect(client).toContain('/history`');
    expect(client).toContain('YOUR ACTIVE BATTLES');
    expect(client).toContain('<BattleLog');
  });

  it('keeps all new presentation classes CQ-prefixed and mobile responsive', () => {
    const classNames = [...client.matchAll(/className="([^"]+)"/g)]
      .flatMap((match) => match[1].split(/\s+/))
      .filter(Boolean);
    expect(classNames.length).toBeGreaterThan(20);
    expect(classNames.every((name) => name.startsWith('cq-grid-strongholds-'))).toBe(true);
    expect(css).toContain('.cq-grid-strongholds-shell');
    expect(css).toContain('@media(max-width:500px)');
  });
});
