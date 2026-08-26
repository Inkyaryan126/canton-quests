import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Your Player Account',
  description:
    'Sign up for Canton Quests, choose your starting path — Family, Challenge, or Secret — and start earning XP on real-world missions around Canton, Ohio. Free to join.',
  alternates: { canonical: '/register' },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
