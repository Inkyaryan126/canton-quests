import Link from 'next/link';
import { Compass, HelpCircle, Home, Users } from 'lucide-react';
import CantonQuestsLogo from '@/components/CantonQuestsLogo';

export default function CinematicFooter() {
  return (
    <footer className="relative overflow-hidden border-t border-amber-500/20 bg-stone-950 text-stone-300 py-10 px-4 sm:px-8">

      <div className="relative max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Brand Lockup */}
        <div className="flex items-center gap-4 text-center md:text-left">
          <CantonQuestsLogo variant="mark" size={44} alt="Canton Quests official emblem" className="shrink-0" />
          <div>
            <span className="font-display font-black text-white text-base tracking-tight">CANTON QUESTS</span>
            <p className="text-xs text-stone-400 font-mono mt-0.5">
              Real city. Real missions. New adventures.
            </p>
          </div>
        </div>

        {/* Navigation Links */}
        <div className="flex flex-wrap items-center justify-center gap-5 text-xs font-mono">
          <Link href="/" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <Home size={14} aria-hidden="true" />
            Command Center
          </Link>
          <Link href="/#operations" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <Compass size={14} aria-hidden="true" />
            Missions
          </Link>
          <Link href="/roster" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <Users size={14} aria-hidden="true" />
            Player Roster
          </Link>
          <Link href="/how-it-works" className="hover:text-amber-400 transition-colors flex items-center gap-1.5">
            <HelpCircle size={14} aria-hidden="true" />
            How It Works
          </Link>
        </div>
      </div>

      <div className="relative max-w-6xl mx-auto mt-8 pt-4 border-t border-stone-800/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono text-stone-500">
        <span>SIGNAL ACTIVE • CANTON, OHIO</span>
        <span>MULTIPLE MISSIONS • ONE PLAYER IDENTITY</span>
      </div>

      <div className="relative max-w-6xl mx-auto mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px] font-mono text-stone-500">
        <Link href="/privacy" className="hover:text-amber-400 transition-colors">
          Privacy
        </Link>
        <Link href="/terms" className="hover:text-amber-400 transition-colors">
          Terms
        </Link>
      </div>
    </footer>
  );
}
