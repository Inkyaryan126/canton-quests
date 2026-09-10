import { afterAll, beforeAll, describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import CipherFragmentsPanel from '../components/CipherFragmentsPanel';
import MasterCipherStatusCard from '../components/MasterCipherStatusCard';
import type { PlayerCipherProgressView, CipherDistrictProgressView } from '../lib/types';
import type { PlayerFinaleStatus } from '../lib/finale-db';

beforeAll(() => vi.stubGlobal('React', React));
afterAll(() => vi.unstubAllGlobals());

const MOCK_DISTRICTS: CipherDistrictProgressView[] = [
  {
    key: 'arts',
    name: 'Downtown Arts District',
    status: 'token_unlocked',
    collectedCount: 3,
    requiredCount: 3,
    tokenLabel: 'Palace Sigil',
    sigilSymbol: '◈ ARCH',
    decodedSentence: 'The foundation stones remember the original architects.',
    fragments: [
      {
        key: 'arts-fragment-1',
        districtKey: 'arts',
        displayName: 'The foundation stones',
        obscuredLabel: 'Fragment Alpha',
        revealCopy: 'Recovered from the Palace Theatre cornerstone.',
        collected: true,
        sortOrder: 1,
      },
      {
        key: 'arts-fragment-2',
        districtKey: 'arts',
        displayName: 'remember the',
        obscuredLabel: 'Fragment Beta',
        revealCopy: 'Traced on the bronze lantern bracket.',
        collected: true,
        sortOrder: 2,
      },
      {
        key: 'arts-fragment-3',
        districtKey: 'arts',
        displayName: 'original architects.',
        obscuredLabel: 'Fragment Gamma',
        revealCopy: 'Hidden within the lobby mural schema.',
        collected: true,
        sortOrder: 3,
      },
    ],
  },
  {
    key: 'challenge',
    name: 'Market District',
    status: 'in_progress',
    collectedCount: 1,
    requiredCount: 3,
    fragments: [
      {
        key: 'market-fragment-1',
        districtKey: 'challenge',
        displayName: 'Iron gates seal',
        obscuredLabel: 'Fragment Delta',
        revealCopy: 'Found at the market arcade entrance.',
        collected: true,
        sortOrder: 1,
      },
      {
        key: 'market-fragment-2',
        districtKey: 'challenge',
        obscuredLabel: 'Fragment Epsilon',
        collected: false,
        sortOrder: 2,
      },
      {
        key: 'market-fragment-3',
        districtKey: 'challenge',
        obscuredLabel: 'Fragment Zeta',
        collected: false,
        sortOrder: 3,
      },
    ],
  },
  {
    key: 'secret',
    name: 'Innovation Corridor',
    status: 'ready_to_decode',
    collectedCount: 3,
    requiredCount: 3,
    fragments: [
      {
        key: 'inno-fragment-1',
        districtKey: 'secret',
        displayName: 'Signals converge where',
        obscuredLabel: 'Fragment Eta',
        revealCopy: 'Captured near the transmission node.',
        collected: true,
        sortOrder: 1,
      },
      {
        key: 'inno-fragment-2',
        districtKey: 'secret',
        displayName: 'the clock tower',
        obscuredLabel: 'Fragment Theta',
        revealCopy: 'Logged by the courthouse telemetry.',
        collected: true,
        sortOrder: 2,
      },
      {
        key: 'inno-fragment-3',
        districtKey: 'secret',
        displayName: 'strikes midnight.',
        obscuredLabel: 'Fragment Iota',
        revealCopy: 'Decoded from relay pulses.',
        collected: true,
        sortOrder: 3,
      },
    ],
  },
];

const MOCK_PROGRESS: PlayerCipherProgressView = {
  eventId: 'evt-test-flagship',
  playerId: 'plr-test-flagship',
  totalCollected: 7,
  totalRequired: 9,
  districts: MOCK_DISTRICTS,
};

describe('Phase 3 Flagship Moment — Cipher Fragments Panel & Sigil Reveal', () => {
  it('renders null when progress is missing or has zero districts', () => {
    expect(renderToStaticMarkup(<CipherFragmentsPanel progress={null} />)).toBe('');
    expect(
      renderToStaticMarkup(
        <CipherFragmentsPanel
          progress={{ eventId: 'evt-test', playerId: 'plr-test', totalCollected: 0, totalRequired: 9, districts: [] }}
        />
      )
    ).toBe('');
  });

  it('renders all districts using SystemStatusBadge and Phase 2 primitives', () => {
    const html = renderToStaticMarkup(
      <CipherFragmentsPanel progress={MOCK_PROGRESS} eventSlug="canton-weekend-1" />
    );

    // District names present
    expect(html).toContain('Downtown Arts District');
    expect(html).toContain('Market District');
    expect(html).toContain('Innovation Corridor');

    // SystemStatusBadge classes & status labels
    expect(html).toContain('cq-status-badge');
    expect(html).toContain('is-confirmed'); // Downtown Arts (token_unlocked)
    expect(html).toContain('is-scanning');  // Market District (in_progress)
    expect(html).toContain('is-armed');     // Innovation Corridor (ready_to_decode)

    expect(html).toContain('Sigil unlocked');
    expect(html).toContain('Signal forming');
    expect(html).toContain('Ready to decode');
  });

  it('degrades gracefully for a player behind on progress (partial fragments)', () => {
    const html = renderToStaticMarkup(
      <CipherFragmentsPanel progress={MOCK_PROGRESS} eventSlug="canton-weekend-1" />
    );

    // Collected fragment displays revealed copy & display name
    expect(html).toContain('Iron gates seal');
    expect(html).toContain('Found at the market arcade entrance.');

    // Uncollected fragments show obscured label and unknown copy without crashing
    expect(html).toContain('Fragment Epsilon');
    expect(html).toContain('Unknown fragment');
    expect(html).toContain('Fragment Zeta');
  });

  it('renders unlocked district sigil record and decoded sentence in TransmissionPanel', () => {
    const html = renderToStaticMarkup(
      <CipherFragmentsPanel progress={MOCK_PROGRESS} eventSlug="canton-weekend-1" />
    );

    // Unlocked district sigil and tokenLabel
    expect(html).toContain('Palace Sigil: ◈ ARCH');
    // Decoded sentence rendered inside quotation marks
    expect(html).toContain('The foundation stones remember the original architects.');
    // TransmissionPanel header eyebrow
    expect(html).toContain('District Sigil &amp; Record');
  });

  it('renders ENTER DISTRICT DECODE action only when district status is ready_to_decode', () => {
    const html = renderToStaticMarkup(
      <CipherFragmentsPanel progress={MOCK_PROGRESS} eventSlug="canton-weekend-1" />
    );

    expect(html).toContain('ENTER DISTRICT DECODE');
    expect(html).toContain('3 FRAGMENTS SECURED — READY TO DECODE');
  });

  it('supports locked status gracefully with denied system status badge', () => {
    const lockedDistrict: CipherDistrictProgressView = {
      key: 'secret',
      name: 'Industrial Fringe',
      status: 'locked',
      collectedCount: 0,
      requiredCount: 3,
      fragments: [
        { key: 'ind-1', districtKey: 'secret', obscuredLabel: 'Unknown Sigma', collected: false, sortOrder: 1 },
        { key: 'ind-2', districtKey: 'secret', obscuredLabel: 'Unknown Tau', collected: false, sortOrder: 2 },
        { key: 'ind-3', districtKey: 'secret', obscuredLabel: 'Unknown Upsilon', collected: false, sortOrder: 3 },
      ],
    };

    const html = renderToStaticMarkup(
      <CipherFragmentsPanel
        progress={{
          eventId: 'evt-test-locked',
          playerId: 'plr-test-locked',
          totalCollected: 0,
          totalRequired: 3,
          districts: [lockedDistrict],
        }}
        eventSlug="canton-weekend-1"
      />
    );

    expect(html).toContain('Industrial Fringe');
    expect(html).toContain('is-denied');
    expect(html).toContain('No signal');
    expect(html).toContain('Sigil locked');
  });
});

describe('Phase 3 Flagship Moment — MasterCipherStatusCard', () => {
  const baseStatus: PlayerFinaleStatus = {
    convergenceStage: 'two_sigils',
    completedAt: null,
    falseFinaleSolvedAt: null,
    destinationReveal: null,
    unlockedSigilCount: 2,
    hasAllThreeLocks: true,
    threeLocks: { mark: true, code: true, word: true },
    eligibility: {
      ok: false,
      reason: 'insufficient_sigils',
      message: '2/3 District Sigils recovered — 1 remaining.',
    },
    cluePieces: [],
  };

  it('returns null when status is null', () => {
    expect(renderToStaticMarkup(<MasterCipherStatusCard eventSlug="canton-weekend-1" status={null} />)).toBe('');
  });

  it('renders locked state with denied SystemStatusBadge and real server reason', () => {
    const html = renderToStaticMarkup(
      <MasterCipherStatusCard eventSlug="canton-weekend-1" status={baseStatus} />
    );

    expect(html).toContain('Master Cipher');
    expect(html).toContain('Locked');
    expect(html).toContain('cq-status-badge');
    expect(html).toContain('is-denied');
    expect(html).toContain('LOCKED');
    expect(html).toContain('2 signals recovered');
    expect(html).toContain('/events/canton-weekend-1/finale');
  });

  it('renders ready state with armed SystemStatusBadge when eligibility is ok', () => {
    const readyStatus: PlayerFinaleStatus = {
      ...baseStatus,
      convergenceStage: 'convergence_ready',
      unlockedSigilCount: 3,
      eligibility: { ok: true },
    };

    const html = renderToStaticMarkup(
      <MasterCipherStatusCard eventSlug="canton-weekend-1" status={readyStatus} />
    );

    expect(html).toContain('Ready');
    expect(html).toContain('is-armed');
    expect(html).toContain('CONVERGENCE READY');
    expect(html).toContain('Enter the final decode →');
    expect(html).toContain('Open →');
  });

  it('renders solved state with confirmed SystemStatusBadge when completedAt is present', () => {
    const solvedStatus: PlayerFinaleStatus = {
      ...baseStatus,
      convergenceStage: 'convergence_ready',
      completedAt: '2026-09-11T20:00:00.000Z',
      eligibility: { ok: true },
    };

    const html = renderToStaticMarkup(
      <MasterCipherStatusCard eventSlug="canton-weekend-1" status={solvedStatus} />
    );

    expect(html).toContain('Solved');
    expect(html).toContain('is-confirmed');
    expect(html).toContain('SOLVED');
    expect(html).toContain('View →');
  });
});
