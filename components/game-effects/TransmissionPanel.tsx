'use client';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export type TransmissionPanelTone = 'amber' | 'stone' | 'cyan' | 'emerald' | 'purple' | 'red';

interface TransmissionPanelToneClasses {
  border: string;
  bg: string;
}

export const TRANSMISSION_PANEL_TONE_CLASSES: Record<TransmissionPanelTone, TransmissionPanelToneClasses> = {
  amber: { border: 'border-amber-500/30', bg: 'bg-[#0a0806]' },
  stone: { border: 'border-stone-800', bg: 'bg-[#090b0c]' },
  cyan: { border: 'border-cyan-500/30', bg: 'bg-[#05090b]' },
  emerald: { border: 'border-emerald-500/30', bg: 'bg-[#060b09]' },
  purple: { border: 'border-purple-500/30', bg: 'bg-[#0a080d]' },
  red: { border: 'border-red-500/30', bg: 'bg-[#0b0606]' },
};

export function getTransmissionPanelToneClasses(tone: TransmissionPanelTone): TransmissionPanelToneClasses {
  return TRANSMISSION_PANEL_TONE_CLASSES[tone] ?? TRANSMISSION_PANEL_TONE_CLASSES.amber;
}

export interface TransmissionPanelProps {
  /** Small uppercase mono eyebrow label, e.g. "FULL REWARD BREAKDOWN" or a transmission headline. */
  eyebrow: string;
  /**
   * Typed against lucide-react's own `LucideIcon` (every icon it exports is a
   * `ForwardRefExoticComponent<LucideProps & RefAttributes<SVGSVGElement>>`,
   * whose `size` accepts `string | number`) rather than a hand-rolled prop
   * shape — a narrower `{ size?: number }` is structurally incompatible with
   * that ref-forwarding type and fails the build.
   */
  icon?: LucideIcon;
  tone?: TransmissionPanelTone;
  /** Rendered at the far right of the header row — e.g. a "Replay" affordance or an "Up to N XP" hint. */
  action?: ReactNode;
  accentClassName?: string;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
}

/**
 * The one reward/transmission presentation primitive — the bordered,
 * dark HUD card with an icon + eyebrow header row that both
 * QuestRewardBreakdown's full breakdown and the inline Commander
 * transmission briefing card render as. Keeping the chrome here means
 * every reward/transmission surface reads as the same transmitted-intel
 * object, whatever content it wraps; it renders presentation only and
 * never touches the reward/unlock data passed into it.
 */
export default function TransmissionPanel({
  eyebrow,
  icon: Icon,
  tone = 'amber',
  action,
  accentClassName = 'text-amber-400',
  bodyClassName = 'mt-3 space-y-3',
  className = '',
  children,
}: TransmissionPanelProps) {
  const { border, bg } = getTransmissionPanelToneClasses(tone);

  return (
    <div className={`rounded-xl border ${border} ${bg} p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className={accentClassName} />}
          <span className={`text-[10px] font-mono uppercase tracking-widest font-bold ${accentClassName}`}>
            {eyebrow}
          </span>
        </div>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
