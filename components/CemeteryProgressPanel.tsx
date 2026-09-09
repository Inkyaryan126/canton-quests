'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { PlayerFinaleStatus } from '@/lib/finale-db';
import SystemStatusBadge from './game-effects/SystemStatusBadge';

const FrankensteinPayoffCard = dynamic(() => import('./game-effects/FrankensteinPayoffCard'));
const WatcherHalloweenTeaseCard = dynamic(() => import('./game-effects/WatcherHalloweenTeaseCard'));

/** Read-only story access. Visiting or replaying this panel grants no XP or entries. */
export default function CemeteryProgressPanel({ status, eventSlug }: { status: PlayerFinaleStatus; eventSlug: string }) {
  const progress = status.launchProgress;
  if (!progress) return null;
  const full = Boolean(status.completedAt);
  return (
    <section className="cq-cemetery-progress" aria-labelledby="cq-cemetery-heading">
      <SystemStatusBadge status={progress.cemeteryUnlocked ? 'confirmed' : 'armed'} label={full ? 'FULL CIPHER COMPLETE' : progress.cemeteryUnlocked ? 'CEMETERY STORY UNLOCKED' : 'YOUR NEXT MILESTONE'} />
      <h2 id="cq-cemetery-heading">{full ? 'All three districts. One complete story.' : progress.cemeteryUnlocked ? 'West Lawn signal recovered' : 'One district opens the next chapter'}</h2>
      <p>Complete all five Family quests, all five Challenge quests, or all four Secret quests to unlock the cemetery story. Photo quests count after review.</p>
      <ul className="cq-district-progress-list" aria-label="Verified district quest progress">
        {progress.districts.map(d => <li key={d.path}><span>{d.path}</span><strong>{d.completed} / {d.required}</strong></li>)}
      </ul>
      <p role="status">{progress.completedDistrictCount} / 3 districts complete. {full ? 'Full Founder’s Cipher completion recorded — the Master Cipher awards 100 XP once.' : 'Your verified quests earn their listed XP and one prize drawing entry each. A second district adds more XP, entries and recovered signals. Complete all three districts, decode all three sigils and recover THE WORD, THE CODE and THE MARK to solve the Master Cipher for the full completion status and an additional 100 XP.'}</p>
      {progress.cemeteryUnlocked && (
        <>
          <h3>Destination: West Lawn Cemetery — Frankenstein Family Monument</h3>
          <p>1919 7th St NW, Canton. Visit only during posted public visitor hours and daylight. Check access before travelling; if closed, return another day. Stay on paths, keep a respectful distance, and never touch or disturb memorials. No physical check-in or purchase is required to view this story.</p>
          <FrankensteinPayoffCard verifiedQuest={false} />
          <WatcherHalloweenTeaseCard allowInteractivePing={false} />
          {!full && <p>You can continue exploring to complete the full Founder’s Cipher and earn additional rewards. Cemetery access does not mark the full Cipher as solved.</p>}
        </>
      )}
      <Link href={`/events/${eventSlug}#quest-board`} className="cq-gold-button cq-cemetery-continue">{full ? 'RETURN TO MISSION' : 'CONTINUE EXPLORING'}</Link>
    </section>
  );
}
