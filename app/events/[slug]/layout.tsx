import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const isFlagshipEvent = params.slug === 'canton-weekend-1';
  return {
    title: isFlagshipEvent ? "Canton Quests: Volume 1 — The Founder's Cipher" : 'Event',
    description: isFlagshipEvent
      ? 'Canton Quests: Volume 1 — The Founder\'s Cipher. A live real-world quest event across Canton, Ohio, September 11–14, 2026. Complete missions, earn XP, climb the leaderboard.'
      : 'A Canton Quests real-world adventure event.',
    alternates: { canonical: `/events/${params.slug}` },
  };
}

export default function EventLayout({ children }: { children: React.ReactNode }) {
  return children;
}
