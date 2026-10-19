import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Player Account',
  description:
    'Sign up for Canton Quests with one account. Explore real-world missions and play The Grid in Canton, Ohio. Free to join.',
  alternates: { canonical: '/register' },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
