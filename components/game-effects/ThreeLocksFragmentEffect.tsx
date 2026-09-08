'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  KeyRound,
  ArrowRight,
  Lock,
  LockOpen,
  Trophy,
  Sparkles,
} from 'lucide-react';
import { ThreeLocksFragmentMoment, ThreeLocksCompleteMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './HudParticlesCanvas';
import HudReticle from './HudReticle';
import HudSystemState from './HudSystemState';
import { cqSoundManager, useSoundPreference } from '@/lib/audio';
import { confirmHaptic, useReducedMotion } from '@/lib/motion';
type FounderLockKey = 'mark' | 'code' | 'word';

const FOUNDER_LOCK_DEFINITIONS = {
  mark: { romanNumeral: 'I', name: 'THE MARK', hexColor: '#a855f7', particleMode: 'cryptic-glyphs', reticleVariant: 'cryptic', verificationSubtitle: 'FOUNDER LOCK I // AUTHENTICATION CHANNEL', districtName: 'Secret Path', associatedPath: 'secret', loreTitle: 'THE MARK RECOVERED', relicName: 'Founder Lock I', inscription: 'THE MARK', loreSnippet: 'The first Founder Lock has been verified and seated in the master receptacle.' },
  code: { romanNumeral: 'II', name: 'THE CODE', hexColor: '#ef4444', particleMode: 'kinetic-streaks', reticleVariant: 'kinetic', verificationSubtitle: 'FOUNDER LOCK II // AUTHENTICATION CHANNEL', districtName: 'Challenge Path', associatedPath: 'challenge', loreTitle: 'THE CODE RECOVERED', relicName: 'Founder Lock II', inscription: 'THE CODE', loreSnippet: 'The second Founder Lock has been verified and seated in the master receptacle.' },
  word: { romanNumeral: 'III', name: 'THE WORD', hexColor: '#f59e0b', particleMode: 'gold-embers', reticleVariant: 'compass', verificationSubtitle: 'FOUNDER LOCK III // AUTHENTICATION CHANNEL', districtName: 'Family Path', associatedPath: 'family', loreTitle: 'THE WORD RECOVERED', relicName: 'Founder Lock III', inscription: 'THE WORD', loreSnippet: 'The third Founder Lock has been verified and seated in the master receptacle.' },
} as const;

function getFounderLockDefinition(key: FounderLockKey) {
  return FOUNDER_LOCK_DEFINITIONS[key];
}

interface ThreeLocksFragmentEffectProps {
  moment: ThreeLocksFragmentMoment | ThreeLocksCompleteMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

type AcquisitionStage = 'authenticating' | 'seated';

const LOCK_KEYS: FounderLockKey[] = ['mark', 'code', 'word'];

export default function ThreeLocksFragmentEffect({
  moment,
  onDismiss,
  reducedMotion: reducedMotionProp,
}: ThreeLocksFragmentEffectProps) {
  const osReducedMotion = useReducedMotion();
  const reducedMotion = reducedMotionProp ?? osReducedMotion;
  const isSoundEnabled = useSoundPreference();

  const isComplete = moment.type === 'three-locks-complete';
  const activeLockKey: FounderLockKey = isComplete ? 'mark' : moment.fragment;
  const activeLockDef = getFounderLockDefinition(activeLockKey);

  const locksOwned = isComplete
    ? { mark: true, code: true, word: true }
    : moment.locksOwned ?? { mark: false, code: false, word: false };

  const ownedCount =
    (locksOwned.mark ? 1 : 0) + (locksOwned.code ? 1 : 0) + (locksOwned.word ? 1 : 0);
  const isConvergence = isComplete || ownedCount === 3;

  // Stage progression: Start at 'authenticating' for 700ms (suspense), then transition to 'seated'
  // Under reduced motion, start immediately at 'seated' to respect accessibility.
  const [stage, setStage] = useState<AcquisitionStage>(
    reducedMotion ? 'seated' : 'authenticating'
  );

  const primaryBtnRef = useRef<HTMLButtonElement>(null);
  const hasTriggeredSeatAudio = useRef(false);

  // Play Stage 1 verification / authenticating cue
  useEffect(() => {
    if (stage === 'authenticating' && isSoundEnabled) {
      cqSoundManager.play('scan');
    }
  }, [stage, isSoundEnabled]);

  // Handle stage 1 -> stage 2 timer
  useEffect(() => {
    if (reducedMotion) {
      setStage('seated');
      return;
    }

    const timer = window.setTimeout(() => {
      setStage('seated');
    }, 700);

    return () => window.clearTimeout(timer);
  }, [reducedMotion]);

  // Play Stage 2 seating cue + haptic pulse
  useEffect(() => {
    if (stage === 'seated' && !hasTriggeredSeatAudio.current) {
      hasTriggeredSeatAudio.current = true;

      // Haptic confirmation
      confirmHaptic({ enabled: true });

      // Audio cue with restraint
      if (isConvergence) {
        cqSoundManager.play('finale_qualified');
      } else if (activeLockKey === 'mark') {
        cqSoundManager.play('path_secret');
      } else if (activeLockKey === 'code') {
        cqSoundManager.play('path_challenge');
      } else {
        cqSoundManager.play('path_family');
      }

      // Auto-focus the Continue button for keyboard users
      window.setTimeout(() => {
        primaryBtnRef.current?.focus();
      }, 50);
    }
  }, [stage, isConvergence, activeLockKey]);

  // Keyboard accessibility: Escape or Enter to dismiss
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    },
    [onDismiss]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Theme colors & attributes based on lock lineage
  const lockColor = isConvergence ? '#fbbf24' : activeLockDef.hexColor;
  const particleMode = isConvergence
    ? 'gold-embers'
    : activeLockDef.particleMode;
  const reticleVariant = isConvergence
    ? 'compass'
    : activeLockDef.reticleVariant;

  const getSlotStatus = (key: FounderLockKey) => {
    if (isComplete) return 'secured';
    if (key === activeLockKey) return stage === 'seated' ? 'just-seated' : 'seating';
    if (locksOwned[key]) return 'secured';
    return 'standby';
  };

  return (
    <div
      className="cq-founder-lock-overlay"
      aria-live="assertive"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cq-founder-lock-heading"
      aria-describedby="cq-founder-lock-desc"
    >
      <style>{`
        .cq-founder-lock-overlay {
          position: fixed;
          inset: 0;
          z-index: 9990;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background-color: rgba(3, 4, 7, 0.95);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          user-select: none;
          box-sizing: border-box;
        }

        .cq-founder-lock-modal {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 520px;
          max-height: 94vh;
          overflow-y: auto;
          background-color: #07090e;
          border: 1px solid;
          border-radius: 1.5rem;
          padding: clamp(1.25rem, 3.5vw, 2rem);
          text-align: center;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9), 0 0 50px rgba(0, 0, 0, 0.8);
        }

        .cq-founder-lock-hero-container {
          position: relative;
          margin: 0 auto;
          width: 110px;
          height: 110px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cq-founder-lock-icon-housing {
          width: 80px;
          height: 80px;
          border-radius: 1.25rem;
          border: 2px solid;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          z-index: 2;
          transition: transform 300ms ease, box-shadow 300ms ease;
        }

        .cq-founder-lock-stage-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          padding: 0.3rem 0.85rem;
          border-radius: 9999px;
          font-family: var(--font-mono, monospace);
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          border: 1px solid;
          margin: 0 auto;
        }

        .cq-founder-lock-inscription-card {
          border-radius: 0.85rem;
          padding: 1rem 1.15rem;
          background: rgba(14, 18, 26, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .cq-founder-lock-quote {
          font-family: var(--font-display, serif);
          font-size: clamp(0.95rem, 2.2vw, 1.15rem);
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.04em;
          line-height: 1.35;
          margin: 0;
        }

        .cq-founder-lock-relic-name {
          font-family: var(--font-mono, monospace);
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        .cq-founder-receptacle-tray {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.65rem;
          margin-top: 0.25rem;
        }

        .cq-founder-slot-cell {
          border-radius: 0.85rem;
          border: 1px solid;
          padding: 0.65rem 0.4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.35rem;
          background: rgba(7, 9, 14, 0.7);
          transition: transform 220ms ease, border-color 220ms ease, background-color 220ms ease;
          box-sizing: border-box;
        }

        .cq-founder-slot-cell.is-just-seated {
          transform: scale(1.04);
          animation: cqSlotPulse 1.6s ease-in-out infinite alternate;
        }

        @keyframes cqSlotPulse {
          0% { box-shadow: 0 0 10px rgba(245, 158, 11, 0.3); }
          100% { box-shadow: 0 0 24px rgba(245, 158, 11, 0.7); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cq-founder-slot-cell.is-just-seated {
            animation: none;
            transform: none;
          }
        }

        .cq-founder-slot-numeral {
          font-family: var(--font-mono, monospace);
          font-size: 0.68rem;
          font-weight: 900;
          letter-spacing: 0.1em;
        }

        .cq-founder-slot-name {
          font-family: var(--font-display, sans-serif);
          font-size: clamp(0.68rem, 1.4vw, 0.8rem);
          font-weight: 900;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          line-height: 1.1;
        }

        .cq-founder-slot-status-pill {
          font-family: var(--font-mono, monospace);
          font-size: 0.6rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.15rem 0.4rem;
          border-radius: 9999px;
          border: 1px solid;
        }

        .cq-founder-action-button {
          width: 100%;
          min-height: 48px;
          border: none;
          border-radius: 0.85rem;
          font-family: var(--font-display, sans-serif);
          font-weight: 900;
          font-size: 0.92rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #050607;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.6rem;
          cursor: pointer;
          transition: filter 180ms ease, transform 120ms ease;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .cq-founder-action-button:hover {
          filter: brightness(1.15);
        }

        .cq-founder-action-button:active {
          transform: scale(0.98);
        }

        .cq-founder-action-button:focus-visible {
          outline: 2px solid #ffffff;
          outline-offset: 2px;
        }
      `}</style>

      {/* Atmospheric dynamic canvas particle layer */}
      <HudParticlesCanvas
        mode={particleMode}
        color={lockColor}
        count={isConvergence ? 55 : 35}
        reducedMotion={reducedMotion}
      />

      {/* Main Flagship Ceremony Modal */}
      <div
        className="cq-founder-lock-modal"
        style={{
          borderColor: lockColor,
          boxShadow: `0 25px 60px rgba(0, 0, 0, 0.9), 0 0 50px ${lockColor}40`,
        }}
      >
        {/* Subtle scanline sweep indicator */}
        <div className="cq-hud-scanline" style={{ background: `linear-gradient(90deg, transparent, ${lockColor}, transparent)`, boxShadow: `0 0 16px ${lockColor}` }} />

        {/* Top Reticle / Relic Icon Enclosure */}
        <div className="cq-founder-lock-hero-container">
          <HudReticle
            size={110}
            color={lockColor}
            variant={reticleVariant}
            spinning={stage === 'authenticating' && !reducedMotion}
            glow
          />
          <div
            className="cq-founder-lock-icon-housing"
            style={{
              borderColor: lockColor,
              backgroundColor: `${lockColor}18`,
              boxShadow: stage === 'seated' ? `0 0 30px ${lockColor}60` : `0 0 10px ${lockColor}30`,
            }}
          >
            {isConvergence ? (
              <Trophy size={36} style={{ color: lockColor }} aria-hidden="true" />
            ) : stage === 'seated' ? (
              <LockOpen size={34} style={{ color: lockColor }} aria-hidden="true" />
            ) : (
              <KeyRound size={32} style={{ color: lockColor }} aria-hidden="true" />
            )}
          </div>
        </div>

        {/* Tactical System State Pill */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <HudSystemState
            state={stage === 'seated' ? 'confirmed' : 'scanning'}
            label={
              stage === 'authenticating'
                ? 'AUTHENTICATING RELIC...'
                : isConvergence
                ? 'CONVERGENCE ACHIEVED'
                : 'LOCK SEATED'
            }
            detail={
              stage === 'authenticating'
                ? activeLockDef.verificationSubtitle
                : isConvergence
                ? '3 OF 3 FOUNDER LOCKS ASSEMBLED'
                : `${ownedCount} OF 3 RECEPTACLE LOCKS SECURED`
            }
            size="md"
            reducedMotion={reducedMotion}
          />
        </div>

        {/* Headline & Relic Identity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div
            className="cq-founder-lock-stage-badge"
            style={{
              borderColor: `${lockColor}60`,
              backgroundColor: `${lockColor}15`,
              color: lockColor,
            }}
          >
            <Sparkles size={13} style={{ color: lockColor }} />
            <span>
              {isConvergence
                ? 'MASTER CIPHER RECEPTACLE'
                : `LOCK ${activeLockDef.romanNumeral} // ${activeLockDef.districtName.toUpperCase()}`}
            </span>
          </div>

          <h2
            id="cq-founder-lock-heading"
            style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontWeight: 900,
              fontSize: isConvergence ? 'clamp(1.75rem, 4.5vw, 2.3rem)' : 'clamp(1.6rem, 4vw, 2.1rem)',
              color: '#ffffff',
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              margin: '0.2rem 0 0 0',
              lineHeight: 1.1,
            }}
          >
            {isConvergence ? 'THREE LOCKS COMPLETE' : activeLockDef.name}
          </h2>

          <p
            id="cq-founder-lock-desc"
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.78rem',
              color: '#d6d3d1',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              margin: 0,
            }}
          >
            {isConvergence
              ? 'All three Founder authorization keys have converged'
              : activeLockDef.loreTitle}
          </p>
        </div>

        {/* Distinct Lore & Inscription Card (Stage 2 Reveal) */}
        {stage === 'seated' && (
          <div
            className="cq-founder-lock-inscription-card"
            style={{
              borderColor: `${lockColor}40`,
              backgroundColor: `${lockColor}0e`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                className="cq-founder-lock-relic-name"
                style={{ color: lockColor }}
              >
                {isConvergence ? 'CONVERGENCE STATUS' : activeLockDef.relicName}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: '0.65rem',
                  color: '#9ca3af',
                  letterSpacing: '0.05em',
                }}
              >
                {isConvergence ? 'ALL KEYS SECURED' : `SOURCE: ${activeLockDef.associatedPath.toUpperCase()} PATH`}
              </span>
            </div>

            <p className="cq-founder-lock-quote">
              {isConvergence
                ? '“THE TRUTH CONVERGES WHERE THREE PATHS MEET.”'
                : `“${activeLockDef.inscription}”`}
            </p>

            <span
              style={{
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: '0.75rem',
                color: '#d1d5db',
                lineHeight: 1.4,
              }}
            >
              {isConvergence
                ? 'The Mark, The Code, and The Word are now locked in the field console. The Master Cipher is primed for final resolution.'
                : activeLockDef.loreSnippet}
            </span>
          </div>
        )}

        {/* Three-Slot Physical Receptacle Tray */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 0.2rem',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '0.68rem',
              color: '#9ca3af',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            <span>RECEPTACLE TRAY</span>
            <strong style={{ color: lockColor }}>
              {isConvergence ? '3 OF 3 CONVERGED' : `${ownedCount} OF 3 ENGAGED`}
            </strong>
          </div>

          <div
            className="cq-founder-receptacle-tray"
            role="group"
            aria-label="Founder Lock receptacle slots"
          >
            {LOCK_KEYS.map((key) => {
              const def = FOUNDER_LOCK_DEFINITIONS[key];
              const slotStatus = getSlotStatus(key);
              const isSlotActive = key === activeLockKey && !isComplete;
              const isOwned = slotStatus === 'secured' || slotStatus === 'just-seated';

              let borderColor = 'rgba(255, 255, 255, 0.1)';
              let bgColor = 'rgba(7, 9, 14, 0.7)';
              let statusLabel = 'STANDBY';
              let statusColor = '#78716c';

              if (slotStatus === 'just-seated') {
                borderColor = def.hexColor;
                bgColor = `${def.hexColor}25`;
                statusLabel = 'SEATED';
                statusColor = def.hexColor;
              } else if (slotStatus === 'seating') {
                borderColor = def.hexColor;
                bgColor = `${def.hexColor}15`;
                statusLabel = 'LOCKING';
                statusColor = def.hexColor;
              } else if (slotStatus === 'secured') {
                borderColor = isConvergence ? '#fbbf24' : def.hexColor;
                bgColor = isConvergence ? 'rgba(251, 191, 36, 0.15)' : `${def.hexColor}15`;
                statusLabel = 'SECURED';
                statusColor = isConvergence ? '#fbbf24' : def.hexColor;
              }

              return (
                <div
                  key={key}
                  className={`cq-founder-slot-cell ${
                    slotStatus === 'just-seated' ? 'is-just-seated' : ''
                  }`}
                  style={{
                    borderColor,
                    backgroundColor: bgColor,
                  }}
                  aria-label={`${def.name}: ${statusLabel}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '0 0.2rem',
                    }}
                  >
                    <span
                      className="cq-founder-slot-numeral"
                      style={{ color: isOwned ? statusColor : '#78716c' }}
                    >
                      {def.romanNumeral}
                    </span>
                    {isOwned ? (
                      <LockOpen size={13} style={{ color: statusColor }} />
                    ) : (
                      <Lock size={13} style={{ color: '#57534e' }} />
                    )}
                  </div>

                  <span
                    className="cq-founder-slot-name"
                    style={{ color: isOwned ? '#ffffff' : '#78716c' }}
                  >
                    {def.name}
                  </span>

                  <span
                    className="cq-founder-slot-status-pill"
                    style={{
                      borderColor: isOwned ? `${statusColor}70` : '#44403c',
                      backgroundColor: isOwned ? `${statusColor}20` : 'transparent',
                      color: statusColor,
                    }}
                  >
                    {statusLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button (Continue / Dismiss) */}
        <button
          ref={primaryBtnRef}
          type="button"
          onClick={onDismiss}
          className="cq-founder-action-button"
          style={{ backgroundColor: lockColor }}
          aria-label={
            isConvergence
              ? 'Proceed to Mission Control'
              : `Confirm and secure ${activeLockDef.name}`
          }
        >
          <span>
            {isConvergence ? 'PROCEED TO MISSION CONTROL' : 'CONFIRM & SECURE TO RECEPTACLE'}
          </span>
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
