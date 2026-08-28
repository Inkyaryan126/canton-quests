import Link from 'next/link';
import Header from '@/components/Header';
import CinematicFooter from '@/components/CinematicFooter';
import CipherRulesVideoTrigger from '@/components/commander/CipherRulesVideoTrigger';
import { isKnownCantonLaunchSlug } from '@/lib/launch-status';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display font-black text-lg sm:text-xl text-white uppercase tracking-tight mb-2">{title}</h2>
      <div className="text-sm text-stone-300 font-body leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function OperationRulesPage({ params }: { params: { slug: string } }) {
  const isFounderCipher = isKnownCantonLaunchSlug(params.slug);

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col selection:bg-amber-500 selection:text-stone-950 font-body">
      <Header eventSlug={params.slug} />
      {/* Centered via flex, not mx-auto — see the mission report: a sitewide
          `* { margin: 0 }` reset in globals.css is unlayered and beats
          Tailwind's layered `.mx-auto` regardless of specificity. */}
      <main className="flex-1 flex justify-center">
        <div className="w-full max-w-3xl px-4 py-16">
          {isFounderCipher ? (
            <>
              <CipherRulesVideoTrigger />
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Legal — Draft for Review</span>
              <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight mt-2 mb-8">
                Official Rules
              </h1>
              <p className="text-sm text-stone-400 font-mono mb-10">
                Canton Quests: Volume 1 — The Founder&apos;s Cipher. These rules describe how the current build of the
                product actually operates. They are an operational reference, not a substitute for legal review before
                launch.
              </p>

              <Section title="Event & Eligibility">
                <p>
                  Canton Quests: Volume 1 runs September 11–14, 2026 in Canton, Ohio. Participation is free — no
                  purchase is necessary to play, to earn XP, or to qualify for a drawing entry.
                </p>
                <p>
                  Players create a free account with a callsign (public display name), an email address, and a
                  starting path. Accounts intended for minors follow the age-acknowledgment flow presented at signup.
                </p>
              </Section>

              <Section title="Starting Paths">
                <p>
                  Family, Challenge, and Secret are identity choices only. Your starting path sets your first mission
                  and public identity flavor — it never restricts which quests you can see or complete. Every player
                  can attempt every available quest regardless of starting path.
                </p>
              </Section>

              <Section title="Scoring & Leaderboard">
                <p>
                  All players compete on one individual, citywide leaderboard ranked by total XP. There are no team or
                  per-path leaderboards. XP is earned by completing quests and, once, by completing your player
                  identity (selecting a starting path and an avatar).
                </p>
              </Section>

              <Section title="Rewards: Account, Identity, and Quest Completion">
                <ul className="list-disc list-inside space-y-1">
                  <li>Creating an account: 0 XP unless a separately configured action grants XP, and 0 drawing entries.</li>
                  <li>Completing your player identity (starting path + avatar): +100 XP, one time only, and 0 drawing entries.</li>
                  <li>
                    A verified core quest completion normally earns XP according to that quest&apos;s configured reward,
                    and normally earns +1 Entry Token / drawing entry when the quest is configured to grant one.
                  </li>
                  <li>
                    Optional field bonuses — GPS check-in, NFC cache scans, field photo/video proof, race-placement
                    bonuses, and similar bonuses — normally grant XP only and do not create an additional drawing entry
                    unless that specific reward is explicitly configured to do so.
                  </li>
                </ul>
              </Section>

              <Section title="Prizes">
                <p>
                  Leaderboard prizes are awarded to the top individual XP scorers when the event closes and totals are
                  frozen, separate from the random cash drawings. Cash drawings are funded by verified drawing entries
                  earned through quest completion, using the deterministic, publicly auditable drawing mechanism
                  documented on the event&apos;s Prize Ledger page. Prize amounts and drawing counts are configured per
                  event and shown on that page and on the homepage — this rules page does not restate specific dollar
                  figures so it never drifts out of sync with the live configuration.
                </p>
              </Section>

              <Section title="Proof, Verification & Cheating">
                <p>
                  Quest completion requires the verification method configured for that quest (check-in, QR scan,
                  passphrase, photo/video, GPS, or game-master review). Canton Quests may invalidate a submission, an
                  award, or a drawing entry if proof appears manipulated, duplicated, submitted outside the required
                  location or time window, or otherwise inconsistent with genuine completion.
                </p>
              </Section>

              <Section title="Prize Eligibility">
                <p>
                  Winning a leaderboard prize or a cash drawing requires a valid, reachable account with accurate
                  contact information at the time prizes are awarded. Canton Quests may require reasonable verification
                  before a prize is released.
                </p>
              </Section>

              <Section title="Safety & Lawful Access">
                <p>
                  Every quest must be completed lawfully. Do not trespass, do not enter private property without
                  permission, and follow all posted access rules, hours, and safety notices — including at cemetery and
                  monument locations. Quest-specific safety notes take precedence over general guidance. Never take a
                  risk you are not comfortable with to complete a quest.
                </p>
              </Section>

              <Section title="Event Changes & Suspension">
                <p>
                  Canton Quests may modify, pause, or suspend the event, individual quests, or specific features —
                  including for weather, safety, technical, or operational reasons. Not every quest is guaranteed to
                  remain available for the full event window if conditions require closing or removing it.
                </p>
              </Section>

              <p className="text-xs text-stone-500 font-mono mt-12">
                These rules are subject to legal review before public launch and may be updated. Questions? Reach out
                through the contact channel listed on the homepage.
              </p>
            </>
          ) : (
            <>
              <span className="text-xs font-mono uppercase tracking-widest text-amber-400">Mission Rules</span>
              <h1 className="font-display font-black text-3xl sm:text-4xl text-white uppercase tracking-tight mt-2 mb-6">
                Official Rules
              </h1>
              <p className="text-sm text-stone-300 font-body leading-relaxed mb-6">
                This Mission&apos;s specific rules aren&apos;t published as a standalone page yet. See{' '}
                <Link href="/how-it-works" className="text-amber-400 underline">
                  How It Works
                </Link>{' '}
                for the platform-wide rules of play.
              </p>
            </>
          )}
        </div>
      </main>
      <CinematicFooter />
    </div>
  );
}
