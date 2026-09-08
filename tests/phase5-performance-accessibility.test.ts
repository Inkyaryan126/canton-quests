import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('Phase 5 — performance and accessibility hardening', () => {
  it('pauses the particle RAF while the document is hidden and resumes on visibility change', () => {
    const source = readSource('components/game-effects/HudParticlesCanvas.tsx');

    expect(source).toContain("document.addEventListener('visibilitychange'");
    expect(source).toContain('document.hidden');
    expect(source).toContain('cancelAnimationFrame(animId)');
    expect(source).toContain("document.removeEventListener('visibilitychange'");
  });

  it('contains modal focus, supports Escape, and restores focus after a game moment closes', () => {
    const source = readSource('components/game-effects/GameMomentOverlay.tsx');

    expect(source).toContain('overlayRef');
    expect(source).toContain('previousFocusRef');
    expect(source).toContain("e.key === 'Tab'");
    expect(source).toContain('previousFocusRef.current?.focus');
    expect(source).toContain('aria-label="Game moment controls"');
  });

  it('gives moment controls visible focus, field-size touch targets, and safe-area spacing', () => {
    const css = readSource('app/globals.css');

    expect(css).toContain('.cq-moment-close-btn:focus-visible');
    expect(css).toContain('.cq-moment-skip-btn:focus-visible');
    expect(css).toMatch(/\.cq-moment-close-btn\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
    expect(css).toContain('env(safe-area-inset-top)');
    expect(css).toContain('env(safe-area-inset-bottom)');
  });

  it('honors the live OS reduced-motion preference even when a loader caller omits the prop', () => {
    const source = readSource('components/game-effects/TransmissionLoader.tsx');

    expect(source).toContain('useReducedMotion');
    expect(source).toContain('const motionReduced = reducedMotion || systemReducedMotion');
    expect(source).toContain('if (motionReduced) return');
  });

  it('does not preload audio after gesture unlock while the global sound preference is disabled', () => {
    const source = readSource('lib/audio/cq-sound-manager.ts');

    expect(source).toContain('if (this.soundEnabled) this.preloadCriticalSounds();');
  });

  it('suppresses cosmetic polling and clock updates while a tab is backgrounded', () => {
    const eventPage = readSource('app/events/[slug]/page.tsx');
    const sectorMap = readSource('components/SectorMap.tsx');
    const fairMap = readSource('components/FairLiveMap.tsx');

    expect(eventPage.match(/if \(document\.hidden\) return;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(sectorMap.match(/if \(document\.hidden\) return;/g)?.length).toBeGreaterThanOrEqual(2);
    expect(fairMap.match(/if \(document\.hidden\) return;/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
