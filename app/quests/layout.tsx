import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quest Board',
  description:
    'Browse every live Canton Quests mission — exploration, puzzle, and field-verified quests across Canton, Ohio, filterable by starting path and difficulty.',
  alternates: { canonical: '/quests' },
};

export default function QuestsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
