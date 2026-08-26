import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Watch Live',
  description:
    'Watch Canton Quests live — the public spectator feed, live audience votes, and real-time game activity, no account required.',
  alternates: { canonical: '/watch' },
};

export default function WatchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
