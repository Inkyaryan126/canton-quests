'use client';

import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, XCircle } from 'lucide-react';

export type VerificationStatus = 'success' | 'failure';

interface VerificationResultConfig {
  /** See TransmissionPanel.tsx for why this is typed against `LucideIcon`
   *  directly rather than a narrower hand-rolled prop shape. */
  Icon: LucideIcon;
  label: string;
  textClass: string;
  borderClass: string;
  bgClass: string;
}

export const VERIFICATION_RESULT_CONFIG: Record<VerificationStatus, VerificationResultConfig> = {
  success: {
    Icon: CheckCircle2,
    label: 'VERIFIED',
    textClass: 'text-emerald-300',
    borderClass: 'border-emerald-500/40',
    bgClass: 'bg-emerald-950/40',
  },
  failure: {
    Icon: XCircle,
    label: 'VERIFICATION FAILED',
    textClass: 'text-red-300',
    borderClass: 'border-red-500/40',
    bgClass: 'bg-red-950/40',
  },
};

export function getVerificationResultConfig(status: VerificationStatus): VerificationResultConfig {
  return VERIFICATION_RESULT_CONFIG[status];
}

export interface VerificationResultProps {
  status: VerificationStatus;
  /** Overrides the default "VERIFIED" / "VERIFICATION FAILED" label. */
  title?: string;
  message?: string;
  /** 'inline' for a compact single-row badge embedded in existing content; 'panel' for a standalone bordered card. */
  variant?: 'inline' | 'panel';
  reducedMotion?: boolean;
  className?: string;
}

/**
 * The one success/failure presentation primitive — a clear VERIFIED or
 * FAILED moment, distinguished only by `status` and `variant`, so every
 * confirm/deny surface in the game (media failures, proof verification,
 * cache checks) reads the same way instead of each screen inventing its
 * own checkmark/x treatment.
 */
export default function VerificationResult({
  status,
  title,
  message,
  variant = 'inline',
  reducedMotion = false,
  className = '',
}: VerificationResultProps) {
  const config = getVerificationResultConfig(status);
  const { Icon } = config;
  const resolvedTitle = title ?? config.label;

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-2 font-mono ${className}`} role="status">
        <Icon size={14} className={`shrink-0 ${config.textClass}`} aria-hidden="true" />
        <div className="min-w-0">
          <span className={`block text-[10px] uppercase tracking-widest font-bold ${config.textClass}`}>
            {resolvedTitle}
          </span>
          {message && <span className="block text-[11px] text-stone-400 truncate">{message}</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl border ${config.borderClass} ${config.bgClass} p-4 flex items-start gap-3 ${className}`}
      role="status"
    >
      <div className="relative shrink-0 mt-0.5">
        {status === 'success' && !reducedMotion && (
          <span className={`absolute inset-0 rounded-full ${config.bgClass} animate-ping`} aria-hidden="true" />
        )}
        <Icon size={22} className={`relative ${config.textClass}`} aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <span className={`block text-xs font-mono uppercase tracking-widest font-bold ${config.textClass}`}>
          {resolvedTitle}
        </span>
        {message && <p className="text-sm text-stone-300">{message}</p>}
      </div>
    </div>
  );
}
