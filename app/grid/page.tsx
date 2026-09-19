import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Building2, ClipboardCheck, MapPinned, Radio, Swords } from 'lucide-react';

export const metadata: Metadata = {
  title: 'The Grid — Coming Soon | Canton Quests',
  description:
    'The Grid is a city-scale strategy game launching with Canton, Ohio as City 001.',
};

export default function GridPage() {
  return (
    <main className="cq-grid-coming">
      <div className="cq-grid-coming__backdrop" aria-hidden="true" />
      <div className="cq-grid-coming__shell">
        <Link href="/" className="cq-grid-coming__back">
          <ArrowLeft size={16} aria-hidden="true" />
          CANTON QUESTS
        </Link>

        <section className="cq-grid-coming__hero" aria-labelledby="grid-coming-title">
          <div className="cq-grid-coming__signal">
            <Radio size={14} aria-hidden="true" />
            CANTON, OHIO // CITY 001
          </div>

          <p className="cq-grid-coming__kicker">THE CITY IS THE BOARD</p>
          <h1 id="grid-coming-title" className="cq-grid-coming__title">
            THE GRID
          </h1>
          <p className="cq-grid-coming__soon">COMING SOON</p>

          <p className="cq-grid-coming__copy">
            A persistent strategy game layered over real cities. Claim territory,
            develop properties, build your skyline, protect your network, and
            compete for control of a living city.
          </p>

          <div className="cq-grid-coming__features" aria-label="The Grid gameplay">
            <article>
              <MapPinned size={22} aria-hidden="true" />
              <strong>CONTROL</strong>
              <span>Real city territory becomes the strategy map.</span>
            </article>
            <article>
              <Building2 size={22} aria-hidden="true" />
              <strong>BUILD</strong>
              <span>Develop properties and grow a skyline that changes the board.</span>
            </article>

            <article>
              <Swords size={22} aria-hidden="true" />
              <strong>COMPETE</strong>
              <span>Pressure rivals, defend your network, and expand your influence.</span>
            </article>
          </div>

          <Link href="/grid/contracts" className="cq-grid-coming__back">
            <ClipboardCheck size={18} aria-hidden="true" />
            <span><strong>CONTRACTS</strong><small>Review your private Grid assignments.</small></span>
            <span aria-hidden="true">→</span>
          </Link>

          <p className="cq-grid-coming__classified">
            CANTON IS ONLY THE BEGINNING.
          </p>
        </section>
      </div>
    </main>
  );
}
