import type { Metadata } from 'next';
import GridContractsClient from './grid-contracts-client';

export const metadata: Metadata = {
  title: 'Contracts | The Grid',
  description: 'Track private objectives and rewards in The Grid.',
  robots: { index: false, follow: false },
};

export default function GridContractsPage() {
  return <GridContractsClient />;
}
