'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#050608] text-white flex flex-col items-center justify-center p-6 text-center">
      <span className="text-amber-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
        404 // SIGNAL LOST
      </span>
      <h1 className="text-3xl font-extrabold mb-4 font-display">PAGE NOT FOUND</h1>
      <p className="text-gray-400 text-sm max-w-md mb-6 font-mono">
        The coordinate or mission you are looking for does not exist on the active Canton grid.
      </p>
      <Link
        href="/quests"
        className="cq-gold-button font-display font-extrabold text-sm py-3 px-6"
      >
        RETURN TO QUEST BOARD
      </Link>
    </div>
  );
}
