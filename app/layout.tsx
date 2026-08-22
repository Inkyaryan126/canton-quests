import './globals.css';
import type { Metadata, Viewport } from 'next';

export const viewport: Viewport = {
  themeColor: '#0b0f17',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.cantonquests.com'),
  title: {
    default: 'Canton Quests — Real-World City Adventure Game',
    template: '%s | Canton Quests',
  },
  description:
    'A living, real-world adventure game layered over Canton, Ohio. Pick a quest, explore downtown landmarks, solve ciphers, scan QR emblems, and earn XP.',
  applicationName: 'Canton Quests',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/canton-quests-mark.png', sizes: '920x920', type: 'image/png' },
      { url: '/brand/canton-quests-mark-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/canton-quests-mark-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: ['/favicon.ico'],
    apple: [
      { url: '/brand/canton-quests-apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Canton Quests — Real-World City Adventure Game',
    description:
      'A living, real-world adventure game layered over Canton, Ohio. Pick a quest, explore landmarks, and earn XP.',
    url: 'https://www.cantonquests.com',
    siteName: 'Canton Quests',
    images: [
      {
        url: '/brand/canton-quests-og.png',
        width: 1200,
        height: 630,
        alt: 'Canton Quests — Official Visual Identity',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Canton Quests — Real-World City Adventure Game',
    description: 'A living, real-world adventure game layered over Canton, Ohio.',
    images: ['/brand/canton-quests-og.png'],
  },
};

import { GameEffectsProvider } from '@/components/game-effects/GameEffectsProvider';
import VisitorTracker from '@/components/VisitorTracker';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <GameEffectsProvider>{children}</GameEffectsProvider>
        <VisitorTracker />
      </body>
    </html>
  );
}
