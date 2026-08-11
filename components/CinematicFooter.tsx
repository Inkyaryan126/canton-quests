import Image from 'next/image';
import Link from 'next/link';
import { Eye, Flag, HelpCircle, ListChecks, Trophy } from 'lucide-react';
import { cqImages } from '@/lib/marketing-assets';

export default function CinematicFooter() {
  return (
    <footer className="cq-footer">
      <div>
        <Image src={cqImages.badge} alt="Canton Quests badge" width={72} height={72} />
        <p>Pick a quest. Explore Canton. Earn XP.</p>
      </div>
      <div className="cq-footer-links">
        <Link href="/quests">
          <ListChecks size={15} aria-hidden="true" />
          Quests
        </Link>
        <Link href="/events">
          <Flag size={15} aria-hidden="true" />
          Events
        </Link>
        <Link href="/leaderboard">
          <Trophy size={15} aria-hidden="true" />
          Leaderboard
        </Link>
        <Link href="/how-it-works">
          <HelpCircle size={15} aria-hidden="true" />
          How It Works
        </Link>
        <Link href="/watch">
          <Eye size={15} aria-hidden="true" />
          Watch Live
        </Link>
      </div>
    </footer>
  );
}
