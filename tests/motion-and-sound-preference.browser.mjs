// Run: node tests/motion-and-sound-preference.browser.mjs
// Uses the repository's existing Playwright and esbuild (Vite dependency); installs nothing.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const bundle = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import SoundToggleControl from './components/game-effects/SoundToggleControl';
      import { cqSoundManager } from './lib/audio/cq-sound-manager';
      import { useReducedMotion } from './lib/motion/use-reduced-motion';
      function App() {
        const reduced = useReducedMotion();
        return <><SoundToggleControl hapticsEnabled />
          <SoundToggleControl soundEnabled={true} compact />
          <output>{String(reduced)}</output></>;
      }
      window.cqPreference = cqSoundManager;
      createRoot(document.getElementById('root')).render(<App />);
    `,
    resolveDir: process.cwd(), loader: 'tsx',
  },
  bundle: true, write: false, outdir: '/tmp/cq-phase2-browser',
  minify: true, define: { 'process.env.NODE_ENV': '"production"' },
});
const js = bundle.outputFiles.find(file => file.path.endsWith('.js')).text;
const css = bundle.outputFiles.find(file => file.path.endsWith('.css')).text;
const globalCss = readFileSync('app/globals.css', 'utf8');
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => route.request().url() === 'http://cq-phase2.test/'
    ? route.fulfill({ contentType: 'text/html', body: `<!doctype html><style>${css}</style><style>${globalCss}</style><div id="root"></div><script>${js}</script>` })
    : route.abort());
  await page.addInitScript(() => {
    localStorage.setItem('cq_sound_enabled', 'false');
    window.pulses = [];
    window.played = [];
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: ms => { window.pulses.push(ms); return true; } });
    window.Audio = class {
      paused = true;
      constructor(src) { this.src = src; }
      play() { window.played.push(this.src); return Promise.resolve(); }
      pause() {}
    };
  });
  await page.goto('http://cq-phase2.test/');
  const buttons = page.locator('button');
  await page.waitForFunction(() => document.querySelectorAll('button[aria-pressed="false"]').length === 2);
  assert.equal(await page.locator('output').textContent(), 'false');
  const duration = await buttons.first().evaluate(node => getComputedStyle(node).transitionDuration);
  assert.equal(duration, '0.18s', 'shared timing must override globals even when globals load last');
  await buttons.first().click();
  await page.waitForFunction(() => document.querySelectorAll('button[aria-pressed="true"]').length === 2);
  assert.deepEqual(await page.evaluate(() => window.pulses), [15]);
  assert.equal(await page.evaluate(() => localStorage.getItem('cq_sound_enabled')), 'true');
  await buttons.nth(1).click();
  await page.waitForFunction(() => document.querySelectorAll('button[aria-pressed="false"]').length === 2);
  assert.equal(await page.evaluate(() => window.cqPreference.play('ui_click')), false);
  assert.equal(await page.evaluate(() => localStorage.getItem('canton_effects_muted')), 'true');
  // The default toggle never vibrates, even when enabling sound.
  await buttons.nth(1).click();
  assert.deepEqual(await page.evaluate(() => window.pulses), [15]);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => document.querySelector('output')?.textContent === 'true');
  assert.equal(await buttons.first().evaluate(node => getComputedStyle(node).transitionDuration), '0s');
  const box = await buttons.first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  assert.equal(await buttons.first().evaluate(node => getComputedStyle(node).transform), 'none');
  await page.mouse.up();
  await buttons.first().click();
  assert.deepEqual(await page.evaluate(() => window.pulses), [15], 'reduced motion suppresses opted-in haptics');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.querySelector('output')?.textContent === 'false');
  assert.equal(await buttons.first().evaluate(node => getComputedStyle(node).transitionDuration), '0.18s');
  assert.deepEqual(errors, []);
  console.log('PASS: real toggle synchronization, stored mute, playback gate, optional haptics, CSS cascade, live reduced-motion CSS and hook at 390px.');
} finally {
  await browser.close();
}
