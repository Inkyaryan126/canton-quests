import type { Metadata } from 'next';
import GridReturnClient from './grid-return-client';

export const metadata: Metadata = {
  title: 'Grid Return Brief | Canton Quests',
  description: 'Private return briefing for your persistent Grid city state.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GridReturnPage() {
  return <GridReturnClient />;
}
