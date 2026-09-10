'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { PlayerFinaleStatus } from '@/lib/finale-db';
import SystemStatusBadge from './game-effects/SystemStatusBadge';

const FrankensteinPayoffCard = dynamic(
  () => import('./game-effects/FrankensteinPayoffCard')
);

export default function CemeteryProgressPanel({
  status,
  eventSlug,
}: {
  status: PlayerFinaleStatus;
  eventSlug: string;
}) {
  const progress = status.launchProgress;
  if (!progress) return null;

  const solved = Boolean(status.completedAt);

  return (
    <section
      className="cq-cemetery-progress"
      aria-labelledby="cq-cemetery-heading"
    >
      <SystemStatusBadge
        status={
          solved
            ? 'confirmed'
            : progress.cemeteryUnlocked
              ? 'armed'
              : 'scanning'
        }
        label={
          solved
            ? 'CONVERGENCE COMPLETE'
            : progress.cemeteryUnlocked
              ? 'WEST LAWN SIGNAL DETECTED'
              : 'SIGNAL INCOMPLETE'
        }
      />

      <h2 id="cq-cemetery-heading">
        {solved
          ? 'The final record has opened.'
          : progress.cemeteryUnlocked
            ? 'Something at West Lawn is answering.'
            : 'The city is still forming the signal.'}
      </h2>

      <ul
        className="cq-district-progress-list"
        aria-label="Verified district quest progress"
      >
        {progress.districts.map((district) => (
          <li key={district.path}>
            <span>{district.path}</span>
            <strong>
              {district.completed} / {district.required}
            </strong>
          </li>
        ))}
      </ul>

      {!solved && progress.cemeteryUnlocked && (
        <div className="mt-4 rounded-xl border border-purple-500/30 bg-purple-950/15 p-4">
          <span className="block text-[10px] font-mono font-black uppercase tracking-widest text-purple-300">
            ARCHIVE SIGNAL // WEST LAWN
          </span>
          <p className="mt-2 text-sm leading-relaxed text-stone-300">
            A cemetery record is responding from West Lawn, but the identity
            attached to it remains encrypted. Resolve the Master Cipher to
            expose the exact monument.
          </p>
        </div>
      )}

      {solved && (
        <>
          <div className="mt-5 rounded-xl border border-emerald-400/40 bg-emerald-950/20 p-4">
            <span className="block text-[10px] font-mono font-black uppercase tracking-widest text-emerald-300">
              LOCATION RESOLVED
            </span>
            <h3 className="mt-1 text-xl font-black text-white">
              West Lawn Cemetery — Frankenstein Family Monument
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-stone-400">
              1919 7th St NW, Canton. Visit only during posted public visitor
              hours and daylight. Remain respectful of the grounds and
              memorials. No physical check-in is required to complete the
              mission.
            </p>
          </div>

          <FrankensteinPayoffCard verifiedQuest={false} />
        </>
      )}

      <Link
        href={`/events/${eventSlug}`}
        className="cq-gold-button cq-cemetery-continue"
      >
        {solved ? 'RETURN TO MISSION' : 'CONTINUE THE CIPHER'}
      </Link>
    </section>
  );
}
