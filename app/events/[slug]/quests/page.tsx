import { redirect } from 'next/navigation';

/**
 * Canonical Operation-scoped Mission Board URL. The Missions tab already
 * lives inside the single-page Operation dashboard at /events/[slug] (not a
 * separate route with its own data-fetching) — this exists so a bookmarked
 * or typed /events/{slug}/quests link, and auth `next` returns to it, land
 * on that same tab instead of defaulting to the Operation home.
 */
export default function EventQuestsRedirect({ params }: { params: { slug: string } }) {
  redirect(`/events/${params.slug}?tab=quests`);
}
