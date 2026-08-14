import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';

interface CinematicNavProps {
  eventHref: string;
}

export default function CinematicNav({ eventHref }: CinematicNavProps) {
  return (
    <nav className="cq-nav" aria-label="Primary navigation">
      <Link href="/" className="cq-nav-logo" aria-label="Canton Quests home">
        <CantonQuestsLogo variant="mark" size={44} priority className="cq-nav-logo-mark" />
        <div className="cq-nav-brand-lockup">
          <span className="cq-nav-brand-title">
            CANTON <span className="cq-gold-text">QUESTS</span>
          </span>
          <span className="cq-nav-brand-subtitle">CITY ADVENTURE</span>
        </div>
      </Link>

      <div className="cq-nav-links">
        <Link href="/quests">QUESTS</Link>
        <Link href="/leaderboard">LEADERBOARD</Link>
        <Link href="/how-it-works">HOW IT WORKS</Link>
      </div>

      <div className="cq-nav-actions">
        <Link href="/watch" className="cq-watch-link">
          <span aria-hidden="true" />
          WATCH LIVE
        </Link>
        <Link href={eventHref} className="cq-gold-button cq-nav-cta">
          START QUEST
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </nav>
  );
}
