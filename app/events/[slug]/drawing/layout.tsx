import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return {
    title: 'Prize Drawing',
    description:
      'Canton Quests transparent prize drawing — public entry counts, ledger lock status, and published draw results for the cash prize drawings.',
    alternates: { canonical: `/events/${params.slug}/drawing` },
  };
}

export default function EventDrawingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
