import type { Metadata } from 'next';
import GridMarketListingsClient from './grid-market-listings-client';

export const metadata: Metadata = {
  title: 'Property Listings | The Grid | Canton Quests',
  description: 'Browse and buy fixed-price property listings on The Grid.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GridMarketListingsPage() {
  return <GridMarketListingsClient />;
}
