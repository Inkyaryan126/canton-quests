import type { Metadata } from 'next';
import GridDirectDealsClient from './grid-direct-deals-client';

export const metadata: Metadata = {
  title: 'Direct Deals | The Grid',
  description: 'Private player-to-player property and Credit deals in The Grid.',
  robots: { index: false, follow: false },
};

export default function GridDirectDealsPage() {
  return <GridDirectDealsClient />;
}
