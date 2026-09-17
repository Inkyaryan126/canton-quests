import type { Metadata } from 'next';
import GridOnboardingClient from './grid-onboarding-client';

export const metadata: Metadata = {
  title: 'Enter The Grid | Canton Quests',
  description: 'Private first-session onboarding for The Grid in Canton, Ohio.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function GridOnboardingPage() {
  return <GridOnboardingClient />;
}
