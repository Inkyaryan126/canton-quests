import { redirect } from 'next/navigation';

/**
 * Canonical Operation-scoped Leaderboard URL. The platform's /leaderboard
 * page is already Operation-aware via ?operation= (it's the shared,
 * standalone leaderboard hub, richer than the in-dashboard Scores tab) — so
 * this redirects there scoped to this Operation rather than duplicating it.
 */
export default function EventLeaderboardRedirect({ params }: { params: { slug: string } }) {
  redirect(`/leaderboard?operation=${params.slug}`);
}
