import type { Metadata } from 'next';
import GridStrongholdsClient from './grid-strongholds-client';

export const metadata: Metadata = {
  title: 'Strongholds | The Grid',
  description: 'Challenge NPC strongholds, roll Signal Dice, and capture strategic territory in The Grid.',
};

export default function GridStrongholdsPage() {
  return <GridStrongholdsClient />;
}
