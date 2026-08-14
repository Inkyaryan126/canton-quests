import Link from 'next/link';
import { Eye, HelpCircle, ListChecks, Trophy } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';

export default function CinematicFooter() {
  return (
    <footer className="cq-footer">
      <div className="cq-footer-brand">
        <CantonQuestsLogo variant="mark" size={48} alt="Canton Quests official emblem" className="shrink-0" />
        <div className="cq-footer-brand-text">
          <span className="cq-footer-brand-title">CANTON QUESTS</span>
          <p>Pick a quest. Explore Canton. Earn XP.</p>
        </div>
      </div>
      <div className="cq-footer-links">
        <Link href="/quests">
          <ListChecks size={15} aria-hidden="true" />
          Quests
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
