import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'City Leaderboard',
  description:
    'Live individual XP standings for Canton Quests — see who is leading the city as players complete verified real-world missions.',
  alternates: { canonical: '/leaderboard' },
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return children;
}
