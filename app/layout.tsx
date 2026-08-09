import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Canton Quests — Real-World City Game',
  description: 'A real-world, city-scale adventure game layered over Canton, Ohio.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
