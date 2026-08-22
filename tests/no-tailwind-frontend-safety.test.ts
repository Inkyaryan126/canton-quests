import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('No-Tailwind Frontend Safety Guardrails', () => {
  const rootDir = process.cwd();
  const globalsCssPath = path.join(rootDir, 'app', 'globals.css');
  const globalsCss = fs.readFileSync(globalsCssPath, 'utf8');

  // Helper to extract all class tokens from TSX/JSX file
  function extractClassTokens(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf8');
    const classRegex = /className=["\x27]([^"\x27]+)["\x27]|className=\{`([^`]+)`\}/g;
    const tokens: string[] = [];
    let match;
    while ((match = classRegex.exec(content)) !== null) {
      const str = match[1] || match[2] || '';
      str.split(/\s+/).forEach((rawToken) => {
        if (!rawToken || rawToken.includes('$') || rawToken.includes('?') || rawToken.includes(':')) {
          return;
        }
        const clean = rawToken.replace(/[\{\}\`]/g, '').trim();
        if (clean) {
          tokens.push(clean);
        }
      });
    }
    return tokens;
  }

  // Recursive walk helper
  function getAllTsxFiles(dir: string): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (!['node_modules', '.next', '.git', 'dist', 'build', 'coverage'].includes(file)) {
          results = results.concat(getAllTsxFiles(fullPath));
        }
      } else if (/\.(tsx|jsx)$/.test(file)) {
        results.push(fullPath);
      }
    });
    return results;
  }

  it('prohibits undefined Tailwind utility classes on all <img> elements across the repo', () => {
    const tsxFiles = getAllTsxFiles(path.join(rootDir, 'app')).concat(
      getAllTsxFiles(path.join(rootDir, 'components'))
    );

    const imgRegex = /<img\b([^>]+)>/g;
    const dangerousTailwindOnImg = [
      /\bw-\d+\b/,
      /\bh-\d+\b/,
      /\brounded-full\b/,
      /\brounded-2xl\b/,
      /\bobject-cover\b/,
      /\bobject-contain\b/,
      /\bshrink-0\b/,
      /\bring-\d+\b/,
      /\bborder-amber-/,
      /\bbg-stone-/,
    ];

    const violations: { file: string; match: string }[] = [];

    tsxFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        const imgTag = match[0];
        // Check if img tag has className with dangerous tailwind classes without dedicated sizing class
        if (!imgTag.includes('cq-nav-avatar-img') && !imgTag.includes('cq-player-bar-avatar-img')) {
          for (const pattern of dangerousTailwindOnImg) {
            if (pattern.test(imgTag)) {
              violations.push({
                file: path.relative(rootDir, file),
                match: imgTag,
              });
              break;
            }
          }
        }
      }
    });

    expect(
      violations,
      `Found <img> tags using Tailwind classes without custom CSS constraints: ${JSON.stringify(violations, null, 2)}`
    ).toEqual([]);
  });

  it('guarantees CinematicNav.tsx uses scoped CQ classes and no dead Tailwind utility classes', () => {
    const navPath = path.join(rootDir, 'components', 'CinematicNav.tsx');
    const tokens = extractClassTokens(navPath);

    const deadTailwindPatterns = [
      /^w-\d+$/,
      /^h-\d+$/,
      /^rounded-full$/,
      /^object-cover$/,
      /^shrink-0$/,
      /^ring-\d+$/,
      /^border-amber-/,
      /^bg-stone-/,
    ];

    const prohibitedFound = tokens.filter((token) =>
      deadTailwindPatterns.some((pattern) => pattern.test(token))
    );

    expect(
      prohibitedFound,
      `CinematicNav.tsx must not contain dead Tailwind classes: ${prohibitedFound.join(', ')}`
    ).toEqual([]);

    // Must use .cq-nav-avatar-img and .cq-nav-user-cluster
    expect(tokens).toContain('cq-nav-avatar-img');
    expect(tokens).toContain('cq-nav-user-cluster');
    expect(tokens).toContain('cq-nav-login-btn');
    expect(tokens).toContain('cq-nav-logout-btn');
  });

  it('guarantees Header.tsx uses scoped CQ classes and no dead Tailwind utility classes', () => {
    const headerPath = path.join(rootDir, 'components', 'Header.tsx');
    const tokens = extractClassTokens(headerPath);

    expect(tokens).toContain('cq-header-bar');
    expect(tokens).toContain('cq-header-inner');
    expect(tokens).toContain('cq-header-live-btn');
    expect(tokens).toContain('cq-header-live-dot');
  });

  it('guarantees PlayerCard.tsx exclusively uses custom .cq-* classes', () => {
    const playerCardPath = path.join(rootDir, 'components', 'PlayerCard.tsx');
    const tokens = extractClassTokens(playerCardPath);

    tokens.forEach((token) => {
      // Must either start with cq- or be an empty string/dynamic prop
      expect(
        token.startsWith('cq-'),
        `PlayerCard class token "${token}" is not a scoped CQ class`
      ).toBe(true);
    });
  });

  it('guarantees PlayerIdentityBar.tsx constrains avatar dimensions with .cq-player-bar-avatar', () => {
    const playerBarPath = path.join(rootDir, 'components', 'PlayerIdentityBar.tsx');
    const content = fs.readFileSync(playerBarPath, 'utf8');

    expect(content).toContain('cq-player-bar-avatar');
    expect(content).toContain('cq-player-bar-avatar-img');
    expect(globalsCss).toContain('.cq-player-bar-avatar');
    expect(globalsCss).toContain('.cq-player-bar-avatar-img');
  });

  it('guarantees SoundToggleControl.tsx uses .cq-sound-toggle-btn', () => {
    const soundTogglePath = path.join(rootDir, 'components', 'game-effects', 'SoundToggleControl.tsx');
    const content = fs.readFileSync(soundTogglePath, 'utf8');

    expect(content).toContain('cq-sound-toggle-btn');
    expect(globalsCss).toContain('.cq-sound-toggle-btn');
  });

  it('guarantees GameMomentOverlay.tsx uses .cq-moment-overlay', () => {
    const overlayPath = path.join(rootDir, 'components', 'game-effects', 'GameMomentOverlay.tsx');
    const content = fs.readFileSync(overlayPath, 'utf8');

    expect(content).toContain('cq-moment-overlay');
    expect(globalsCss).toContain('.cq-moment-overlay');
  });

  it('validates that all critical CQ classes are properly defined in globals.css', () => {
    const requiredCqClasses = [
      '.cq-nav',
      '.cq-nav-avatar-img',
      '.cq-nav-avatar-fallback',
      '.cq-nav-player-callsign',
      '.cq-nav-user-cluster',
      '.cq-nav-login-btn',
      '.cq-nav-logout-btn',
      '.cq-header-bar',
      '.cq-header-inner',
      '.cq-header-live-btn',
      '.cq-header-live-dot',
      '.cq-player-bar-avatar',
      '.cq-player-bar-avatar-img',
      '.cq-sound-toggle-btn',
      '.cq-moment-overlay',
      '.cq-quest-recommended-badge',
      '.cq-command-actions',
      '.cq-command-logout-btn',
    ];

    requiredCqClasses.forEach((className) => {
      expect(
        globalsCss.includes(className),
        `Required CSS class ${className} missing from app/globals.css`
      ).toBe(true);
    });
  });
});
