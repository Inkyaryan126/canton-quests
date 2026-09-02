'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Archive } from 'lucide-react';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';
import PageHeader from '@/components/PageHeader';
import { QuestEvent } from '@/lib/types';
import { ARCHIVED_MISSION_DEBRIEF } from '@/lib/marketing-assets';

/**
 * Lightweight archive/debrief page for a completed worldbuilding Mission —
 * NOT the full Operation dashboard (app/events/[slug]/page.tsx), which
 * assumes real quests, a leaderboard, and live gameplay. This page only
 * ever reads event.title/description/startTime/endTime/status from the
 * real event row (via the existing /api/game/events/[slug] endpoint) plus
 * static archive-copy from ARCHIVED_MISSION_DEBRIEF — it never fetches or
 * renders quests, a leaderboard, or any claim/QR flow, so there is no
 * gameplay route reachable from here.
 */
function formatArchiveDate(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function formatArchiveWindow(event: QuestEvent): string {
  if (!event.startTime) return 'Dates unavailable';
  if (!event.endTime) return formatArchiveDate(event.startTime);
  const start = new Date(event.startTime);
  const end = new Date(event.endTime);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const monthYear = start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `${monthYear.split(' ')[0]} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${formatArchiveDate(event.startTime)} – ${formatArchiveDate(event.endTime)}`;
}

export default function ArchivedMissionPage({ params }: { params: { slug: string } }) {
  const [event, setEvent] = useState<QuestEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/game/events/${params.slug}`)
      .then((res) => res.json())
      .then((data: { event?: QuestEvent; error?: string }) => {
        if (data.event) {
          setEvent(data.event);
        } else {
          setNotFound(true);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.slug]);

  const debrief = ARCHIVED_MISSION_DEBRIEF[params.slug];

  return (
    <div className="min-h-screen bg-[var(--bg-obsidian)] text-[var(--text-primary)] flex flex-col">
      <CinematicNav eventHref="/events" context="global" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-8">
        {loading ? (
          <p className="text-center text-sm font-mono text-gray-400 py-12">Loading Mission archive...</p>
        ) : notFound || !event ? (
          <div className="text-center py-12 space-y-4">
            <p className="text-sm font-mono text-gray-400">This Mission archive could not be found.</p>
            <Link href="/events" className="cq-gold-button inline-flex items-center gap-2 text-xs font-mono py-3 px-6">
              <ArrowLeft size={14} /> Back to Missions
            </Link>
          </div>
        ) : (
          <>
            <PageHeader eyebrow="MISSION ARCHIVE" title={event.title} body={formatArchiveWindow(event)} accent="purple" divider />

            <div className="glass-panel p-6 sm:p-8 border-stone-600/40 space-y-6">
              <div className="flex items-center justify-center">
                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-stone-500/50 bg-stone-800/60 text-stone-200 text-xs font-mono font-bold uppercase tracking-widest">
                  <Archive size={14} aria-hidden="true" />
                  {debrief?.stamp || 'MISSION COMPLETE'}
                </span>
              </div>

              <p className="text-sm sm:text-base text-stone-200 font-body leading-relaxed text-center">{event.description}</p>

              {debrief && (
                <div className="border-t border-stone-700 pt-6 space-y-1.5 text-center">
                  {debrief.lines.map((line, i) => (
                    <p key={i} className="text-sm font-mono text-stone-400 italic">
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Link href="/events" className="cq-dark-button inline-flex items-center gap-2 text-xs font-mono py-3 px-6">
                <ArrowLeft size={14} /> Back to Missions
              </Link>
            </div>
          </>
        )}
      </main>

      <CinematicFooter />
    </div>
  );
}
