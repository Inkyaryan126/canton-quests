import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'How Canton Quests works: pick a starting path, complete real-world missions around Canton, Ohio, earn XP and drawing entries, and climb the citywide leaderboard.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
