/**
 * Canton Quests — Founder's Cipher Master Cipher player-facing FLOW tests.
 *
 * lib/finale.ts / lib/finale-db.ts / app/api/game/finale/route.ts already
 * have their own thorough backend test coverage in
 * tests/founders-cipher-finale.test.ts (eligibility rules, idempotency,
 * no-leakage, false-finale, request validation). These tests are about the
 * NEW player-facing layer built on top of that backend: the finale route,
 * the hub status card, and the Commander message wiring — source-scan
 * style, matching this repo's existing no-jsdom testing convention (see
 * tests/founders-cipher-messaging.test.ts).
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function read(relPath: string): string {
  return fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');
}

const finaleSource = read('app/events/[slug]/finale/page.tsx');
const hubSource = read('app/events/[slug]/page.tsx');
const questSource = read('app/events/[slug]/quests/[questId]/page.tsx');
const statusCardSource = read('components/MasterCipherStatusCard.tsx');
const headerSource = read('components/Header.tsx');
const finaleLibSource = read('lib/finale.ts');
const finaleDbSource = read('lib/finale-db.ts');
const messagesSource = read('lib/gameplay/founders-cipher/messages.ts');

describe('Finale route exists and is wired into navigation', () => {
  it('the player-facing finale route file exists at app/events/[slug]/finale/page.tsx', () => {
    expect(finaleSource.length).toBeGreaterThan(0);
  });

  it('Header exposes a Master Cipher nav link scoped to known Founder\'s Cipher missions', () => {
    expect(headerSource).toMatch(/finale`/);
    expect(headerSource).toMatch(/Master Cipher/);
  });

  it('the Mission hub renders a Master Cipher status card, distinct from the legacy isQualifiedForFinale stat', () => {
    expect(hubSource).toMatch(/MasterCipherStatusCard/);
    expect(hubSource).toMatch(/isQualifiedForFinale/); // legacy stat still present, untouched
  });

  it('the ALL_REQUIRED_FRAGMENTS_FOUND moment now navigates the player into the finale route', () => {
    const idx = questSource.indexOf('ALL_REQUIRED_FRAGMENTS_FOUND');
    const block = questSource.slice(idx, idx + 700);
    expect(block).toMatch(/onContinue:\s*\(\)\s*=>\s*router\.push\(`\/events\/\$\{eventSlug\}\/finale`\)/);
  });

  it('ALL_REQUIRED_FRAGMENTS_FOUND carries an explicit "OPEN MASTER CIPHER" CTA in the registry', () => {
    const idx = messagesSource.indexOf('ALL_REQUIRED_FRAGMENTS_FOUND');
    const block = messagesSource.slice(idx, messagesSource.indexOf('FINAL_DECODE_AVAILABLE', idx));
    expect(block).toMatch(/cta: 'OPEN MASTER CIPHER'/);
  });
});

describe('Access control — unqualified/qualified/completed states', () => {
  it('an unauthenticated visitor never reaches the solution form (auth gate short-circuits before any finale fetch)', () => {
    const authGateIdx = finaleSource.indexOf('!authenticatedPlayer');
    const solutionFormIdx = finaleSource.indexOf("Submit Your Solution");
    expect(authGateIdx).toBeGreaterThan(-1);
    expect(solutionFormIdx).toBeGreaterThan(authGateIdx);
  });

  it('the solution entry form is gated strictly behind `ready` (eligible AND not yet solved)', () => {
    expect(finaleSource).toMatch(/const ready = !solved && finaleStatus\.eligibility\.ok;/);
    // The submit form only ever renders inside the `!solved` branch, guarded
    // by having already failed the earlier `!solved && !ready` locked-state
    // early return above it.
    const lockedReturnIdx = finaleSource.indexOf('!solved && !ready');
    const formIdx = finaleSource.indexOf('Submit Your Solution');
    expect(lockedReturnIdx).toBeGreaterThan(-1);
    expect(formIdx).toBeGreaterThan(lockedReturnIdx);
  });

  it('a completed player sees a persistent solved state driven by server-authoritative completedAt, not localStorage', () => {
    expect(finaleSource).toMatch(/const solved = Boolean\(finaleStatus\.completedAt\);/);
    // No localStorage read gates the solved/ready/locked branch decision —
    // only ever used for the unrelated sound/reduced-motion prefs inside
    // game-effects.ts, never referenced in this file at all.
    expect(finaleSource).not.toMatch(/localStorage/);
  });

  it('deep-linking through every resolvable state renders without a bare crash path: loading, gate, locked, ready, and solved sections all exist', () => {
    expect(finaleSource).toMatch(/Establishing Cipher Link/); // initial loading
    expect(finaleSource).toMatch(/Identify Yourself/); // GATE A
    expect(finaleSource).toMatch(/Entering Mission/); // GATE B
    expect(finaleSource).toMatch(/Reading Convergence Signal/); // finale status loading
    expect(finaleSource).toMatch(/MASTER CIPHER LOCKED|MASTER CIPHER OFFLINE/); // locked
    expect(finaleSource).toMatch(/Submit Your Solution/); // ready
    expect(finaleSource).toMatch(/CIPHER_SOLVED/); // solved copy sourced from registry, not hardcoded
  });

  it('the locked state renders the real server-authored eligibility.message rather than a fabricated requirement', () => {
    expect(finaleSource).toMatch(/finaleStatus\.eligibility\.message/);
  });
});

describe('No answer leakage in the new player-facing layer', () => {
  it('the finale page never references a raw answer or hash field', () => {
    expect(finaleSource.toLowerCase()).not.toMatch(/finalanswerhash|falsefinaleanswerhash|plaintext/);
  });

  it('the finale page never imports server-only DB access (lib/finale-db) at runtime — only its types', () => {
    expect(finaleSource).toMatch(/import type \{ PlayerFinaleStatus \} from '@\/lib\/finale-db'/);
    expect(finaleSource).not.toMatch(/from '@\/lib\/supabase'/);
  });

  it('the hub status card also only imports the finale-db type, never a value/function', () => {
    expect(statusCardSource).toMatch(/import type \{ PlayerFinaleStatus \} from '@\/lib\/finale-db'/);
  });

  it('PlayerFinaleStatus (lib/finale-db.ts) still carries no hash-shaped field after the destinationReveal addition', () => {
    const idx = finaleDbSource.indexOf('export interface PlayerFinaleStatus');
    const block = finaleDbSource.slice(idx, finaleDbSource.indexOf('}', idx));
    expect(block.toLowerCase()).not.toMatch(/hash/);
  });

  it('destinationReveal is only ever populated once completedAt is set — same "reveal only once earned" rule as cluePieces', () => {
    expect(finaleDbSource).toMatch(/destinationReveal: progress\.completedAt \? config\?\.finalDestinationReveal \?\? null : null/);
  });
});

describe('Wrong-answer and false-finale feedback never mutate completion state', () => {
  it('an incorrect submission only sets local UI feedback state, never finaleStatus.completedAt directly', () => {
    const idx = finaleSource.indexOf("outcome.stage === 'completed'");
    const beforeCompletedBranch = finaleSource.slice(0, idx);
    // setAttemptOutcome/setAnswerInput are the only state writers before the
    // stage-specific branching — completedAt only ever changes via a fresh
    // server fetch (fetchFinaleStatus), never a client-computed value.
    expect(beforeCompletedBranch).toMatch(/setAttemptOutcome\(outcome\);/);
    expect(finaleSource).not.toMatch(/completedAt:\s*new Date/);
  });

  it('the incorrect/false-finale feedback panels render inline (no full-screen overlay) — retries stay unlimited without popup spam', () => {
    const idx = finaleSource.indexOf("attemptOutcome?.stage === 'incorrect'");
    expect(idx).toBeGreaterThan(-1);
    const block = finaleSource.slice(idx, idx + 200);
    expect(block).not.toMatch(/showFounderCipherMessage|showGameMoment/);
  });

  it('wrong-answer feedback reuses the existing path-toned INVALID_ANSWER registry message rather than a bespoke string', () => {
    expect(finaleSource).toMatch(/getFounderCipherMessage\('INVALID_ANSWER', path\)/);
  });
});

describe('Successful submission — sequenced endgame, not simultaneous popups', () => {
  it('FINAL_SOLUTION_CORRECT fires first, and only its onContinue chains into MISSION_COMPLETE (never both fired independently)', () => {
    const correctIdx = finaleSource.indexOf("messageId: 'FINAL_SOLUTION_CORRECT'");
    const completeIdx = finaleSource.indexOf("messageId: 'MISSION_COMPLETE'");
    expect(correctIdx).toBeGreaterThan(-1);
    expect(completeIdx).toBeGreaterThan(correctIdx);
    // MISSION_COMPLETE's call must be textually nested inside FINAL_SOLUTION_CORRECT's onContinue, not a sibling call.
    const between = finaleSource.slice(correctIdx, completeIdx);
    expect(between).toMatch(/onContinue:\s*\(\)\s*=>\s*\{/);
  });

  it('CIPHER_SOLVED is rendered as a persistent inline page section (via getFounderCipherMessage), never a third overlay', () => {
    expect(finaleSource).toMatch(/getFounderCipherMessage\('CIPHER_SOLVED', path\)/);
    expect(finaleSource).not.toMatch(/showFounderCipherMessage\(\{\s*messageId: 'CIPHER_SOLVED'/);
  });

  it('a completed outcome always re-fetches authoritative status from the server rather than trusting only the POST response', () => {
    const idx = finaleSource.indexOf("outcome.stage === 'completed'");
    const block = finaleSource.slice(idx, idx + 700);
    expect(block).toMatch(/fetchFinaleStatus\(\)/);
  });

  it('the finale page never computes or displays an XP/level delta itself — only ever reflects what the server already granted', () => {
    expect(finaleSource).not.toMatch(/totalXp\s*\+|total_xp/);
  });
});

describe('FINALE_UNLOCKED fires exactly once, at the real eligibility transition', () => {
  it('the hub gates FINALE_UNLOCKED behind the once-only viewed-state store, keyed distinctly from the fragments-collected message', () => {
    expect(hubSource).toMatch(/shouldAutoShowTransmission\('finale', 'finale-unlocked', pid\)/);
    expect(hubSource).toMatch(/markTransmissionViewed\('finale', 'finale-unlocked', pid\)/);
  });

  it('FINALE_UNLOCKED is only ever triggered when the real server eligibility says ok — never inferred from fragment counts client-side', () => {
    const idx = hubSource.indexOf("messageId: 'FINALE_UNLOCKED'");
    expect(idx).toBeGreaterThan(-1);
    const before = hubSource.slice(Math.max(0, idx - 400), idx);
    expect(before).toMatch(/data\.status\.eligibility\.ok/);
  });

  it('FINALE_UNLOCKED is archived (playerId passed through) so it remains recoverable from the Transmissions FIELD LOG', () => {
    const idx = hubSource.indexOf("messageId: 'FINALE_UNLOCKED'");
    const block = hubSource.slice(idx, idx + 300);
    expect(block).toMatch(/playerId: pid/);
  });
});

describe('Universal path changes wording only, never gameplay facts', () => {
  it('checkFinaleEligibility and evaluateFinaleSubmission never take a path parameter', () => {
    const eligSig = finaleLibSource.slice(finaleLibSource.indexOf('export function checkFinaleEligibility'), finaleLibSource.indexOf('export function checkFinaleEligibility') + 400);
    const evalSig = finaleLibSource.slice(finaleLibSource.indexOf('export function evaluateFinaleSubmission'), finaleLibSource.indexOf('export function evaluateFinaleSubmission') + 400);
    expect(eligSig).not.toMatch(/path/i);
    expect(evalSig).not.toMatch(/path/i);
  });

  it('the finale page only ever uses `path` to resolve message copy (getFounderCipherMessage/showFounderCipherMessage), never in a conditional branch', () => {
    const pathUsages = [...finaleSource.matchAll(/\bpath\b/g)];
    expect(pathUsages.length).toBeGreaterThan(0);
    expect(finaleSource).not.toMatch(/if \(path ===/);
  });
});

describe('Master Cipher hub status card: locked -> ready -> solved', () => {
  it('renders three visually distinct states keyed off solved/ready, matching the same fields the finale page itself uses', () => {
    expect(statusCardSource).toMatch(/const solved = Boolean\(status\.completedAt\);/);
    expect(statusCardSource).toMatch(/const ready = !solved && status\.eligibility\.ok;/);
    expect(statusCardSource).toMatch(/Solved/);
    expect(statusCardSource).toMatch(/Ready/);
    expect(statusCardSource).toMatch(/Locked/);
  });

  it('renders nothing (returns null) before finale status has loaded, rather than a false "locked" flash', () => {
    expect(statusCardSource).toMatch(/if \(!status\) return null;/);
  });
});

describe('Reward/drawing relationship — no new economics invented at the UI layer', () => {
  it('the finale page never calls into any prize-drawing or reward-grant function directly', () => {
    expect(finaleSource).not.toMatch(/insertRewardGrantDB|executePrizeDrawDB|lockDrawingLedgerDB|grantFinaleQualificationDB/);
  });

  it('the hub status card never claims a prize or drawing entry — copy is limited to Master Cipher progress state', () => {
    // Strip comments first — the file legitimately mentions "prize-drawing"
    // once, in a comment explaining that this card is NOT that (unrelated,
    // legacy) system. Only the rendered/user-visible text must stay clean.
    const withoutComments = statusCardSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments.toLowerCase()).not.toMatch(/prize|drawing|winner/);
  });
});
