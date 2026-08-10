import Image from 'next/image';
import Link from 'next/link';
import { cqImages } from '@/lib/marketing-assets';

interface CinematicNavProps {
  eventHref: string;
}

export default function CinematicNav({ eventHref }: CinematicNavProps) {
  return (
    <nav className="cq-nav" aria-label="Primary navigation">
      <Link href="/" className="cq-nav-logo" aria-label="Canton Quests home">
        <Image src={cqImages.logoNav} alt="Canton Quests" width={206} height={64} priority />
      </Link>

      <div className="cq-nav-links">
        <Link href="/quests">QUESTS</Link>
        <Link href="/leaderboard">LEADERBOARD</Link>
        <Link href="/events">EVENTS</Link>
        <Link href="/how-it-works">HOW IT WORKS</Link>
      </div>

      <div className="cq-nav-actions">
        <Link href="/watch" className="cq-watch-link">
          <span aria-hidden="true" />
          WATCH LIVE
        </Link>
        <Link href={eventHref} className="cq-gold-button cq-nav-cta">
          JOIN THE QUESTS
        </Link>
      </div>
    </nav>
  );
}
