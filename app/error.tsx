'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#050608] text-white flex flex-col items-center justify-center p-6 text-center">
      <span className="text-red-400 font-mono text-xs font-bold tracking-widest uppercase mb-2">
        500 // SYSTEM INTERRUPT
      </span>
      <h1 className="text-3xl font-extrabold mb-4 font-display">UNEXPECTED ERROR</h1>
      <p className="text-gray-400 text-sm max-w-md mb-6 font-mono">
        An error occurred on the active frequency. Try reloading or return to the main board.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="btn btn-secondary font-mono text-xs py-2.5 px-5"
        >
          TRY AGAIN
        </button>
        <Link
          href="/events/canton-weekend-1/quests"
          className="cq-gold-button font-display font-extrabold text-sm py-2.5 px-5"
        >
          QUEST BOARD
        </Link>
      </div>
    </div>
  );
}
