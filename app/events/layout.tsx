import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Upcoming and active Canton Quests events in Canton, Ohio.',
  alternates: { canonical: '/events' },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
