import type { Metadata } from 'next';
import GridDominanceHeatClient from './grid-dominance-heat-client';

export const metadata: Metadata = {
  title: 'Dominance Heat | The Grid',
  description:
    'See how much of Canton you control and when anti-snowball pressure begins.',
  robots: { index: false, follow: false },
};

export default function GridDominanceHeatPage() {
  return <GridDominanceHeatClient />;
}
