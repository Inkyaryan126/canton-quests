// Run: node tests/motion-and-sound-browser.mjs
// Uses installed Chrome or Playwright Chromium. No app server, auth, or database.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const temporary = await mkdtemp(join(tmpdir(), 'cq-motion-'));
let browser;
try {
  await build({
    stdin: {
      contents: `
        import React from 'react';
        import { createRoot } from 'react-dom/client';
        import SoundToggleControl from './components/game-effects/SoundToggleControl';
        import { cqSoundManager } from './lib/audio';
        window.soundManager = cqSoundManager;
        createRoot(document.getElementById('root')).render(<>
          <SoundToggleControl soundEnabled={false} />
          <SoundToggleControl compact />
        </>);
      `,
      resolveDir: process.cwd(), loader: 'tsx',
    },
    bundle: true, outfile: join(temporary, 'fixture.js'), minify: true,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  browser = await chromium.launch({
    headless: true,
    ...(existsSync(chrome) ? { executablePath: chrome } : {}),
  });
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setContent('<div id="root"></div>');
  // Load production globals after the module to challenge cascade order.
  await page.addStyleTag({ content: await readFile(join(temporary, 'fixture.css'), 'utf8') });
  await page.addStyleTag({ content: await readFile('app/globals.css', 'utf8') });
  await page.addScriptTag({ content: await readFile(join(temporary, 'fixture.js'), 'utf8') });
  const buttons = page.locator('button.cq-sound-toggle-btn');
  await buttons.first().waitFor();
  const labels = () => buttons.evaluateAll(elements => elements.map(el => el.getAttribute('aria-label')));
  assert.deepEqual(await labels(), Array(2).fill('Mute Canton Quests sound effects'));
  await buttons.first().click();
  assert.deepEqual(await labels(), Array(2).fill('Unmute Canton Quests sound effects'));
  await page.evaluate(() => window.soundManager.setSoundEnabled(true));
  await page.waitForFunction(() => document.querySelectorAll('.cq-sound-toggle-btn.is-enabled').length === 2);
  const motion = () => buttons.first().evaluate(el => ({
    duration: getComputedStyle(el).transitionDuration,
    property: getComputedStyle(el).transitionProperty,
  }));
  assert.equal((await motion()).duration, '0.1s');
  assert.notEqual((await motion()).property, 'all');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal((await motion()).duration, '0s');
  await buttons.first().click();
  assert.deepEqual(await labels(), Array(2).fill('Unmute Canton Quests sound effects'));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  assert.equal((await motion()).duration, '0.1s');
  console.log('PASS: real toggles synchronize; legacy prop cannot override preference; CSS 100ms -> 0ms -> 100ms; reduced-motion toggle remains usable at 375px.');
} finally {
  await browser?.close();
  await rm(temporary, { recursive: true, force: true });
}
