import type { Metadata } from 'next';
import GridDefenseClient from './grid-defense-client';

export const metadata: Metadata = {
  title: 'Defense Doctrine | The Grid',
  description:
    'Configure how your Grid territory defends itself while you are away.',
  robots: { index: false, follow: false },
};

export default function GridDefensePage() {
  return <GridDefenseClient />;
}
