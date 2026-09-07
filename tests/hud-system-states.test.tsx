import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'fs';
import { join } from 'path';
import SystemStatusBadge from '../components/game-effects/SystemStatusBadge';
import HudSystemState from '../components/game-effects/HudSystemState';
import CqTransition, { HudTransition } from '../components/game-effects/CqTransition';

describe('Phase 2 — HUD System States & Cinematic Transitions', () => {
  describe('SystemStatusBadge', () => {
    it('renders the "armed" system status with correct class and default label', () => {
      const html = renderToStaticMarkup(<SystemStatusBadge status="armed" />);
      expect(html).toContain('cq-status-badge');
      expect(html).toContain('is-armed');
      expect(html).toContain('ARMED');
      expect(html).toContain('cq-status-badge-icon');
    });

    it('renders the "scanning" system status with correct class and default label', () => {
      const html = renderToStaticMarkup(<SystemStatusBadge status="scanning" />);
      expect(html).toContain('cq-status-badge');
      expect(html).toContain('is-scanning');
      expect(html).toContain('SCANNING...');
    });

    it('renders the "confirmed" system status with correct class and default label', () => {
      const html = renderToStaticMarkup(<SystemStatusBadge status="confirmed" />);
      expect(html).toContain('cq-status-badge');
      expect(html).toContain('is-confirmed');
      expect(html).toContain('CONFIRMED');
    });

    it('renders the "denied" system status with correct class and default label', () => {
      const html = renderToStaticMarkup(<SystemStatusBadge status="denied" />);
      expect(html).toContain('cq-status-badge');
      expect(html).toContain('is-denied');
      expect(html).toContain('DENIED');
    });

    it('honors custom label overrides', () => {
      const html = renderToStaticMarkup(
        <SystemStatusBadge status="armed" label="GRID ARMED & READY" />
      );
      expect(html).toContain('GRID ARMED &amp; READY');
    });

    it('honors size="sm" modifier', () => {
      const html = renderToStaticMarkup(
        <SystemStatusBadge status="confirmed" size="sm" />
      );
      expect(html).toContain('is-sm');
    });

    it('merges custom className without losing base classes', () => {
      const html = renderToStaticMarkup(
        <SystemStatusBadge status="scanning" className="custom-tactical-class" />
      );
      expect(html).toContain('cq-status-badge');
      expect(html).toContain('is-scanning');
      expect(html).toContain('custom-tactical-class');
    });
  });

  describe('HudSystemState', () => {
    it('wraps SystemStatusBadge with accessible container and polite aria-live', () => {
      const html = renderToStaticMarkup(<HudSystemState state="scanning" />);
      expect(html).toContain('cq-hud-system-state');
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('data-state="scanning"');
      expect(html).toContain('data-reduced-motion="false"');
      expect(html).toContain('SCANNING...');
    });

    it('renders tactical detail text when provided', () => {
      const html = renderToStaticMarkup(
        <HudSystemState
          state="confirmed"
          label="TARGET ACQUIRED"
          detail="COORDINATES: CANTON-40.7989"
        />
      );
      expect(html).toContain('TARGET ACQUIRED');
      expect(html).toContain('cq-hud-system-state-detail');
      expect(html).toContain('COORDINATES: CANTON-40.7989');
    });

    it('sets data-reduced-motion attribute when reducedMotion is true', () => {
      const html = renderToStaticMarkup(
        <HudSystemState state="armed" reducedMotion={true} />
      );
      expect(html).toContain('data-reduced-motion="true"');
    });
  });

  describe('CqTransition & HudTransition Primitives', () => {
    it('renders hidden pre-transition state when show is false', () => {
      const html = renderToStaticMarkup(
        <CqTransition show={false}>
          <p>Tactical Content</p>
        </CqTransition>
      );
      expect(html).toContain('cq-transition-reveal');
      expect(html).not.toContain('is-visible');
      expect(html).toContain('Tactical Content');
    });

    it('renders visible state when show is true', () => {
      const html = renderToStaticMarkup(
        <CqTransition show={true}>
          <p>Tactical Content</p>
        </CqTransition>
      );
      expect(html).toContain('cq-transition-reveal');
      expect(html).toContain('is-visible');
      expect(html).toContain('Tactical Content');
    });

    it('suppresses transition style under reduced motion', () => {
      const html = renderToStaticMarkup(
        <CqTransition show={true} reducedMotion={true}>
          <p>Instant Reveal Content</p>
        </CqTransition>
      );
      expect(html).toContain('data-reduced-motion="true"');
      expect(html).toContain('transition:none');
      expect(html).toContain('opacity:1');
    });

    it('HudTransition is exported as an alias for CqTransition', () => {
      expect(HudTransition).toBe(CqTransition);
    });
  });

  describe('Real Call Site Integrations', () => {
    it('verifies CityScanOverlay integrates SystemStatusBadge and CqTransition', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/game-effects/CityScanOverlay.tsx'),
        'utf8'
      );
      expect(fileContent).toContain("import SystemStatusBadge from './SystemStatusBadge'");
      expect(fileContent).toContain("import CqTransition from './CqTransition'");
      expect(fileContent).toContain("<SystemStatusBadge");
      expect(fileContent).toContain("<CqTransition");
    });

    it('verifies PathLockEffect integrates SystemStatusBadge and CqTransition', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/game-effects/PathLockEffect.tsx'),
        'utf8'
      );
      expect(fileContent).toContain("import SystemStatusBadge from './SystemStatusBadge'");
      expect(fileContent).toContain("import CqTransition from './CqTransition'");
      expect(fileContent).toContain("<SystemStatusBadge");
      expect(fileContent).toContain("<CqTransition");
    });

    it('verifies QuestListScanEffect integrates SystemStatusBadge', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/game-effects/QuestListScanEffect.tsx'),
        'utf8'
      );
      expect(fileContent).toContain("import SystemStatusBadge from './SystemStatusBadge'");
      expect(fileContent).toContain("<SystemStatusBadge");
    });

    it('verifies GameMomentOverlay uses lazy-loaded dynamic imports with command-terminal loading fallback', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/game-effects/GameMomentOverlay.tsx'),
        'utf8'
      );
      expect(fileContent).toContain("import dynamic from 'next/dynamic'");
      expect(fileContent).toContain("import SystemStatusBadge from './SystemStatusBadge'");
      expect(fileContent).toContain('className="cq-moment-loading"');
      expect(fileContent).toContain('<SystemStatusBadge status="scanning" />');
    });

    it('verifies SoundToggleControl integrates useSoundPreference and confirmHaptic', () => {
      const fileContent = readFileSync(
        join(process.cwd(), 'components/game-effects/SoundToggleControl.tsx'),
        'utf8'
      );
      expect(fileContent).toContain('useSoundPreference');
      expect(fileContent).toContain('confirmHaptic');
    });
  });
});
