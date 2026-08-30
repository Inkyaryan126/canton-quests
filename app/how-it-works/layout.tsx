import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'How It Works',
  description:
    'How Canton Quests works: create your permanent Player Identity, join a Mission, complete real-world quests around Canton, Ohio, and earn XP and drawing entries.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
