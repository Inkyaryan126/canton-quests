'use client';

import React, { useEffect } from 'react';
import { Zap, Ticket, Flag, ArrowRight } from 'lucide-react';
import { RewardTokenMoment } from '@/lib/game-effects';
import HudParticlesCanvas from './LazyHudParticles';
import HudSystemState from './HudSystemState';
import HudTransition from './HudTransition';
import motion from '@/lib/motion/primitives.module.css';
import { cqSoundManager } from '@/lib/audio';

interface RewardTokenEffectProps {
  moment: RewardTokenMoment;
  onDismiss: () => void;
  reducedMotion?: boolean;
}

const KIND_CONFIG = {
  xp: { icon: Zap, label: 'XP AWARDED', color: '#f59e0b', sound: 'xp_gain' as const },
  'entry-token': { icon: Ticket, label: 'ENTRY TOKEN RECEIVED', color: '#a855f7', sound: 'xp_gain' as const },
  'race-bonus': { icon: Flag, label: 'RACE BONUS', color: '#ef4444', sound: 'xp_gain' as const },
};

/**
 * REWARD / TOKEN template family — XP awards, prize-drawing entry tokens,
 * and race-placement bonuses all share this one reusable "tangible token"
 * reveal, distinguished only by `moment.kind`. Every number shown is
 * exactly what the server already granted (xpAmount/entryCount) — this
 * component never computes a reward amount itself.
 */
export default function RewardTokenEffect({ moment, onDismiss, reducedMotion = false }: RewardTokenEffectProps) {
  const config = KIND_CONFIG[moment.kind];
  const Icon = config.icon;
  const color = moment.pathColor && /^#/.test(moment.pathColor) ? moment.pathColor : config.color;
  const pillLabel =
    moment.kind === 'entry-token' && (moment.entryCount ?? 0) > 1 ? 'ENTRY TOKENS RECEIVED' : config.label;
  const entryLabel = (moment.entryCount ?? 0) > 1 ? 'ENTRIES' : 'ENTRY';

  useEffect(() => {
    cqSoundManager.play(config.sound);
  }, [config.sound]);

  return (
    <div
      className="cq-field-effect"
      role="dialog"
      aria-modal="true"
      aria-label={moment.headline}
    >
      <HudParticlesCanvas mode="xp-burst" color={color} reducedMotion={reducedMotion} />

      <HudTransition className="cq-field-panel" reducedMotion={reducedMotion}>
        <div className="cq-field-reward-icon" style={{ color }} aria-hidden="true"><Icon size={28} /></div>
        <HudSystemState state="confirmed" label={pillLabel} reducedMotion={reducedMotion} />
        <h2 className="cq-field-title">{moment.headline}</h2>
        {moment.secondaryText && <p className="cq-field-detail">{moment.secondaryText}</p>}

        {(moment.xpAmount !== undefined || moment.entryCount !== undefined) && (
          <div className="cq-field-reward-values">
            {moment.xpAmount !== undefined && (
              <div>
                <span className="cq-field-value-label">XP</span>
                <span className="cq-field-value">+{moment.xpAmount}</span>
              </div>
            )}
            {moment.entryCount !== undefined && (
              <div>
                <span className="cq-field-value-label">{entryLabel}</span>
                <span className="cq-field-value">+{moment.entryCount}</span>
              </div>
            )}
          </div>
        )}

        {moment.primaryText && <p className="cq-field-detail">{moment.primaryText}</p>}

        <button
          type="button"
          onClick={onDismiss}
          className={`cq-field-continue ${motion['cq-motion-control']}`}
        >
          <span>{moment.cta || 'CONTINUE'}</span>
          <ArrowRight size={17} />
        </button>
      </HudTransition>
    </div>
  );
}
