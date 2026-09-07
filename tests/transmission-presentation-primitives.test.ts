import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getDecodeBar } from '../components/game-effects/TransmissionLoader';
import {
  getVerificationResultConfig,
  VERIFICATION_RESULT_CONFIG,
} from '../components/game-effects/VerificationResult';
import {
  getTransmissionPanelToneClasses,
  TRANSMISSION_PANEL_TONE_CLASSES,
  TransmissionPanelTone,
} from '../components/game-effects/TransmissionPanel';
import TransmissionLoader from '../components/game-effects/TransmissionLoader';
import VerificationResult from '../components/game-effects/VerificationResult';
import TransmissionPanel from '../components/game-effects/TransmissionPanel';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('TransmissionLoader — the one loading/working presentation primitive', () => {
  it('is a genuine reusable component (default export is a function)', () => {
    expect(typeof TransmissionLoader).toBe('function');
  });

  it('reduced motion always freezes the decode bar to a static, fully-solid readout', () => {
    expect(getDecodeBar(0, true)).toBe('▓▓▓▓▓▓▓▓▓▓');
    expect(getDecodeBar(999, true)).toBe(getDecodeBar(0, true));
  });

  it('is deterministic given the same tick — no randomness driving the "decode" look', () => {
    expect(getDecodeBar(3, false)).toBe(getDecodeBar(3, false));
  });

  it('advances (changes) as the tick advances, so it reads as live signal activity', () => {
    expect(getDecodeBar(0, false)).not.toBe(getDecodeBar(1, false));
  });

  it('respects a custom bar length', () => {
    expect(getDecodeBar(0, false, 4)).toHaveLength(4);
    expect(getDecodeBar(0, true, 4)).toBe('▓▓▓▓');
  });
});

describe('VerificationResult — the one success/failure presentation primitive', () => {
  it('is a genuine reusable component (default export is a function)', () => {
    expect(typeof VerificationResult).toBe('function');
  });

  it('defines exactly the two verification states with visually distinct tones', () => {
    expect(Object.keys(VERIFICATION_RESULT_CONFIG).sort()).toEqual(['failure', 'success']);
    expect(getVerificationResultConfig('success').Icon).not.toBe(getVerificationResultConfig('failure').Icon);
    expect(getVerificationResultConfig('success').textClass).not.toBe(getVerificationResultConfig('failure').textClass);
  });

  it('gives each status a sensible default label', () => {
    expect(getVerificationResultConfig('success').label).toMatch(/VERIFIED/i);
    expect(getVerificationResultConfig('failure').label).toMatch(/FAILED/i);
  });
});

describe('TransmissionPanel — the one reward/transmission presentation primitive', () => {
  it('is a genuine reusable component (default export is a function)', () => {
    expect(typeof TransmissionPanel).toBe('function');
  });

  it('defines distinct border/background classes per tone', () => {
    const tones = Object.keys(TRANSMISSION_PANEL_TONE_CLASSES) as TransmissionPanelTone[];
    expect(tones.length).toBeGreaterThanOrEqual(2);
    const seen = new Set(tones.map((tone) => `${TRANSMISSION_PANEL_TONE_CLASSES[tone].border}|${TRANSMISSION_PANEL_TONE_CLASSES[tone].bg}`));
    expect(seen.size).toBe(tones.length);
  });

  it('falls back to the amber tone for an unrecognized value rather than rendering unstyled', () => {
    expect(getTransmissionPanelToneClasses('not-a-real-tone' as TransmissionPanelTone)).toEqual(
      TRANSMISSION_PANEL_TONE_CLASSES.amber
    );
  });
});

describe('Real call sites compose the primitives instead of re-implementing the chrome', () => {
  it('QuestRewardBreakdown renders its full breakdown through TransmissionPanel', () => {
    const source = readSource('components/QuestRewardBreakdown.tsx');
    expect(source).toMatch(/import TransmissionPanel from '@\/components\/game-effects\/TransmissionPanel';/);
    expect(source).toMatch(/<TransmissionPanel/);
    expect(source).toMatch(/eyebrow="Full Reward Breakdown"/);
    // The reward math itself is untouched — still reads from the one summary helper.
    expect(source).toMatch(/getQuestRewardSummary\(quest\)/);
  });

  it('CommanderTransmission renders its briefing card through TransmissionPanel', () => {
    const source = readSource('components/CommanderTransmission.tsx');
    expect(source).toMatch(/import TransmissionPanel from '\.\/game-effects\/TransmissionPanel';/);
    expect(source).toMatch(/<TransmissionPanel/);
  });

  it('CommanderMedia shows the decode loader while the video has not loaded data yet', () => {
    const source = readSource('components/commander/CommanderMedia.tsx');
    expect(source).toMatch(/import TransmissionLoader from '\.\.\/game-effects\/TransmissionLoader';/);
    expect(source).toMatch(/<TransmissionLoader/);
    expect(source).toMatch(/onLoadedData=\{\(\) => setVideoReady\(true\)\}/);
    // Never blocks the native video controls underneath it.
    expect(source).toMatch(/pointer-events-none/);
  });

  it('CommanderMedia presents a failed video load through VerificationResult, not bespoke markup', () => {
    const source = readSource('components/commander/CommanderMedia.tsx');
    expect(source).toMatch(/import VerificationResult from '\.\.\/game-effects\/VerificationResult';/);
    expect(source).toMatch(/status="failure"/);
  });

  it('CommanderMedia still wires onEnded/onError exactly as before (no regression to transmission advance logic)', () => {
    const source = readSource('components/commander/CommanderMedia.tsx');
    expect(source).toMatch(/onEnded=\{onVideoEnded\}/);
    expect(source).toMatch(/onError=\{\(\) => setVideoFailed\(true\)\}/);
    expect(source).not.toMatch(/onPause=/);
    expect(source).not.toMatch(/onWaiting=/);
    expect(source).not.toMatch(/onSeeking=/);
    expect(source).not.toMatch(/onTimeUpdate=/);
  });

  it('the cinematic transmission overlay threads its own reducedMotion prop into CommanderMedia', () => {
    const source = readSource('components/game-effects/CommanderTransmissionEffect.tsx');
    expect(source).toMatch(/<CommanderMedia[^>]*reducedMotion=\{reducedMotion\}/);
  });
});

describe('TransmissionPanel/VerificationResult icon typing uses the real lucide-react component type', () => {
  it('does not widen the icon prop to `any`', () => {
    const panelSource = readSource('components/game-effects/TransmissionPanel.tsx');
    const verificationSource = readSource('components/game-effects/VerificationResult.tsx');
    expect(panelSource).not.toMatch(/ComponentType<any>/);
    expect(verificationSource).not.toMatch(/ComponentType<any>/);
    expect(panelSource).toMatch(/LucideIcon/);
    expect(verificationSource).toMatch(/LucideIcon/);
  });
});
