'use client';

import React from 'react';
import Image from 'next/image';
import { AlertTriangle, Eye, Radio } from 'lucide-react';
import TransmissionPanel from './TransmissionPanel';
import SystemStatusBadge from './SystemStatusBadge';
import HudSystemState from './HudSystemState';
import CqTransition from './CqTransition';
import { useReducedMotion } from '@/lib/motion';

export interface FrankensteinPayoffCardProps {
  className?: string;
  showInterrupt?: boolean;
  verifiedQuest?: boolean;
}

export default function FrankensteinPayoffCard({
  className = '',
  verifiedQuest = true,
}: FrankensteinPayoffCardProps) {
  const reducedMotion = useReducedMotion();

  return (
    <CqTransition
      show={true}
      reducedMotion={reducedMotion}
      className={className}
    >
      <TransmissionPanel
        eyebrow="WEST LAWN ARCHIVE // TWO SIGNAL SOURCES"
        icon={Radio}
        tone="purple"
        action={
          <SystemStatusBadge
            status="confirmed"
            label="SIGNALS RECOVERED"
            size="sm"
          />
        }
      >
        <div className="space-y-5">
          <HudSystemState
            state="confirmed"
            label={verifiedQuest ? 'FIELD RECORD VERIFIED' : 'ARCHIVE DECRYPTED'}
            detail="CONVERGENCE RECORD COMPLETE"
            size="sm"
            reducedMotion={reducedMotion}
          />

          <div className="grid grid-cols-[68px_1fr] gap-3 rounded-xl border border-amber-400/30 bg-amber-950/10 p-3">
            <div className="relative h-[68px] w-[68px] overflow-hidden rounded-lg border border-amber-400/50 bg-black">
              <Image
                src="/commander-transmissions/transmission-1-poster.jpg"
                alt="Commander"
                fill
                sizes="68px"
                className="object-cover"
              />
            </div>

            <div>
              <span className="block text-[10px] font-mono font-black uppercase tracking-widest text-amber-300">
                COMMANDER // CQ FIELD OPERATIONS
              </span>
              <p className="mt-1 text-sm italic leading-relaxed text-stone-200">
                &ldquo;Convergence confirmed. The name you recovered is attached
                to a real family record here in Canton. West Lawn was never the
                end of the trail. It was where the trail was pointing.&rdquo;
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[68px_1fr] gap-3 rounded-xl border border-purple-400/40 bg-purple-950/25 p-3">
            <div className="grid h-[68px] w-[68px] place-items-center rounded-lg border border-purple-400/50 bg-black text-purple-300">
              <div className="text-center">
                <Eye size={26} className="mx-auto" />
                <span className="mt-1 block text-[8px] font-mono tracking-widest">
                  CLASSIFIED
                </span>
              </div>
            </div>

            <div>
              <span className="flex items-center gap-1 text-[10px] font-mono font-black uppercase tracking-widest text-purple-300">
                <AlertTriangle size={11} className="text-amber-400" />
                UNKNOWN OBSERVER // W-01
              </span>
              <p className="mt-1 text-sm italic leading-relaxed text-purple-100">
                &ldquo;You found the name. You found the dead. And now you know
                someone else was following the signal too. W-01 dormant.
                Reactivation: October. We&apos;ll be watching.&rdquo;
              </p>
            </div>
          </div>

          <div className="border-t border-purple-500/20 pt-3 text-[11px] font-mono text-purple-200/80">
            <span className="font-bold text-amber-300">
              NEXT FREQUENCY:
            </span>{' '}
            WATCHER SIGNAL W-01 // DORMANT UNTIL OCTOBER
          </div>
        </div>
      </TransmissionPanel>
    </CqTransition>
  );
}
