import { redirect } from 'next/navigation';

/** Canonical Operation-scoped Map URL — see quests/page.tsx for the tab-redirect rationale. */
export default function EventMapRedirect({ params }: { params: { slug: string } }) {
  redirect(`/events/${params.slug}?tab=map`);
}
