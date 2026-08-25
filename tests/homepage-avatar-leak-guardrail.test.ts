import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Regression guardrail for the live bug where the authenticated homepage
 * welcome card rendered `{currentPlayer.avatarUrl || '⚡'}` directly as JSX
 * text. Since avatarUrl can be an internal route like
 * `/api/player/<uuid>/avatar`, that raw expression printed the path/UUID
 * visibly instead of the avatar image. Fixed by routing through
 * <PlayerAvatar>, which knows how to distinguish an emoji fallback from an
 * image path/URL.
 */
describe('Homepage Welcome Card Avatar/Internal-ID Leak Guardrail', () => {
  const rootDir = process.cwd();
  const pagePath = path.join(rootDir, 'app', 'page.tsx');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  function extractWelcomeCardSection(source: string): string {
    const start = source.indexOf('AUTHENTICATED AGENT HERO BANNER');
    const end = source.indexOf('PROMOTIONAL BRIEFING TRANSMISSION');
    expect(start, 'Could not locate the authenticated welcome card section in app/page.tsx').toBeGreaterThan(-1);
    expect(end, 'Could not locate the end boundary of the welcome card section in app/page.tsx').toBeGreaterThan(start);
    return source.slice(start, end);
  }

  it('renders the player avatar through <PlayerAvatar>, not a raw field interpolation', () => {
    const section = extractWelcomeCardSection(pageSource);
    expect(section).toContain('<PlayerAvatar');
    expect(pageSource).toContain("import PlayerAvatar from '@/components/PlayerAvatar'");
  });

  it('never interpolates currentPlayer.avatarUrl (or other internal identifiers) as bare JSX text', () => {
    const section = extractWelcomeCardSection(pageSource);

    // Matches `{expr}` where expr references a sensitive field, and captures
    // the character immediately preceding the `{` so we can tell a JSX prop
    // assignment (`avatarUrl={currentPlayer.avatarUrl}`, preceded by `=`)
    // apart from a bare text-node interpolation (preceded by `>`, whitespace,
    // or another JSX child boundary).
    const sensitiveFieldPattern =
      /(.)\{\s*currentPlayer\.(avatarUrl|id|userId|user_id|profileImagePath|avatar_url|profile_image_path)\b[^}]*\}/g;

    const rawLeaks: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = sensitiveFieldPattern.exec(section)) !== null) {
      const precedingChar = match[1];
      if (precedingChar !== '=') {
        rawLeaks.push(match[0]);
      }
    }

    expect(
      rawLeaks,
      `Found raw internal-field interpolation(s) in the homepage welcome card: ${JSON.stringify(rawLeaks)}`
    ).toEqual([]);
  });

  it('never hardcodes an internal API route or UUID literal in the welcome card markup', () => {
    const section = extractWelcomeCardSection(pageSource);
    expect(section).not.toMatch(/\/api\/player\//);
    expect(section).not.toMatch(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
  });
});
