import type { Metadata } from 'next';
import GridPassportClient from './grid-passport-client';

export const metadata: Metadata = {
  title: 'Grid Passport | Canton Quests',
  description: 'Your permanent cross-city record in The Grid.',
};

export default function GridPassportPage() {
  return <GridPassportClient />;
}
