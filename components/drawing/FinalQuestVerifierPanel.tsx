'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  Copy,
  Check,
  Lock,
  RotateCcw,
  Sparkles,
  Hash,
  Users,
  Ticket,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { QuestEvent, PublicDrawingPageData } from '@/lib/types';
import {
  PERMANENT_CANTON_QUESTS_NUMBER,
  extractAuthoritativeDrawingMetrics,
} from '@/lib/final-quest-verifier';

interface FinalQuestVerifierPanelProps {
  events?: QuestEvent[];
  initialEventSlug?: string;
}

export default function FinalQuestVerifierPanel({
  events = [],
  initialEventSlug,
}: FinalQuestVerifierPanelProps) {
  const [eventList, setEventList] = useState<QuestEvent[]>(events);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    initialEventSlug || (events.length > 0 ? events[0].slug : 'canton-weekend-1')
  );
  const [drawingData, setDrawingData] = useState<PublicDrawingPageData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedNumber, setCopiedNumber] = useState<boolean>(false);
  const [copiedEquation, setCopiedEquation] = useState<boolean>(false);

  // Local calculator state
  const [calcCqNumber, setCalcCqNumber] = useState<string>(PERMANENT_CANTON_QUESTS_NUMBER);
  const [calcPlayers, setCalcPlayers] = useState<string>('0');
  const [calcValidEntries, setCalcValidEntries] = useState<string>('0');
  const [calcCompletedQuests, setCalcCompletedQuests] = useState<string>('0');
  const [calcResult, setCalcResult] = useState<string>('0');
  const [calcSubstitutedEquation, setCalcSubstitutedEquation] = useState<string>('');
  const [calcError, setCalcError] = useState<string | null>(null);
  const [hasUserEdited, setHasUserEdited] = useState<boolean>(false);

  // Sync event list if passed or fetch if empty
  useEffect(() => {
    if (events && events.length > 0) {
      setEventList(events);
      if (!selectedSlug) {
        setSelectedSlug(events[0].slug);
      }
    } else {
      fetch('/api/game/events')
        .then((res) => res.json())
        .then((data: { events?: QuestEvent[] }) => {
          if (data.events && data.events.length > 0) {
            setEventList(data.events);
            if (!selectedSlug) {
              setSelectedSlug(data.events[0].slug);
            }
          }
        })
        .catch(() => {
          // Keep default fallback
        });
    }
  }, [events, selectedSlug]);

  // Fetch authoritative drawing ledger data whenever selectedSlug changes
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    const targetSlug = selectedSlug || 'canton-weekend-1';
    fetch(`/api/game/events/${targetSlug}/drawing`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('Failed to load drawing data');
        }
        return res.json();
      })
      .then((data: PublicDrawingPageData) => {
        if (isMounted) {
          setDrawingData(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDrawingData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSlug]);

  const metrics = useMemo(() => {
    return extractAuthoritativeDrawingMetrics(drawingData);
  }, [drawingData]);

  // Automatically seed the local calculator with official numbers whenever metrics update
  useEffect(() => {
    if (!hasUserEdited) {
      setCalcCqNumber(metrics.permanentNumber);
      setCalcPlayers(String(metrics.totalPlayers));
      setCalcValidEntries(String(metrics.totalValidEntries));
      setCalcCompletedQuests(String(metrics.totalCompletedQuests));
      setCalcResult(metrics.finalQuestNumber);
      setCalcSubstitutedEquation(metrics.substitutedEquation);
      setCalcError(null);
    }
  }, [metrics, hasUserEdited]);

  const handleCopyNumber = () => {
    if (!metrics.finalQuestNumber) return;
    navigator.clipboard.writeText(metrics.finalQuestNumber);
    setCopiedNumber(true);
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  const handleCopyEquation = () => {
    if (!metrics.substitutedEquation) return;
    navigator.clipboard.writeText(metrics.substitutedEquation);
    setCopiedEquation(true);
    setTimeout(() => setCopiedEquation(false), 2000);
  };

  // Local calculator actions (using BigInt strictly - never JS Number multiplication)
  const handleCalculate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setCalcError(null);

    const cqClean = calcCqNumber.trim().replace(/,/g, '');
    const pClean = calcPlayers.trim().replace(/,/g, '');
    const eClean = calcValidEntries.trim().replace(/,/g, '');
    const qClean = calcCompletedQuests.trim().replace(/,/g, '');

    if (
      !/^\d+$/.test(cqClean) ||
      !/^\d+$/.test(pClean) ||
      !/^\d+$/.test(eClean) ||
      !/^\d+$/.test(qClean)
    ) {
      setCalcError('Please enter positive whole integers only (digits 0-9).');
      return;
    }

    try {
      const cq = BigInt(cqClean);
      const p = BigInt(pClean);
      const entries = BigInt(eClean);
      const quests = BigInt(qClean);

      // Pure BigInt multiplication - never standard floating-point numbers
      const product = cq * p * entries * quests;
      const productStr = product.toString();

      setCalcResult(productStr);
      setCalcSubstitutedEquation(`${cq.toString()} × ${p.toString()} × ${entries.toString()} × ${quests.toString()} = ${productStr}`);
    } catch {
      setCalcError('Calculation error. Please verify that all inputs contain valid integer digits.');
    }
  };

  const handleResetToOfficial = () => {
    setCalcCqNumber(metrics.permanentNumber);
    setCalcPlayers(String(metrics.totalPlayers));
    setCalcValidEntries(String(metrics.totalValidEntries));
    setCalcCompletedQuests(String(metrics.totalCompletedQuests));
    setCalcResult(metrics.finalQuestNumber);
    setCalcSubstitutedEquation(metrics.substitutedEquation);
    setCalcError(null);
    setHasUserEdited(false);
  };

  const selectedEvent = eventList.find((e) => e.slug === selectedSlug);
  const eventDisplayName = selectedEvent
    ? selectedEvent.title
    : drawingData?.eventTitle || metrics.eventName || "Canton Quests: Volume 1 - The Founder's Cipher";

  return (
    <section className="cq-verifier-panel" aria-labelledby="verifier-panel-title">
      {/* PANEL MAIN HEADER & MISSION SELECTOR */}
      <div className="cq-verifier-header">
        <div className="cq-verifier-title-group">
          <div className="cq-verifier-icon-badge" aria-hidden="true">
            <Calculator size={22} />
          </div>
          <div>
            <span className="cq-verifier-kicker">TRANSPARENT WINNER SELECTION AUDIT</span>
            <h3 id="verifier-panel-title" className="cq-verifier-heading">
              OFFICIAL FINAL QUEST CALCULATION
            </h3>
          </div>
        </div>

        {eventList.length > 1 && (
          <div className="cq-verifier-mission-select-wrap">
            <label htmlFor="mission-audit-select" className="cq-verifier-select-label">
              SELECT MISSION:
            </label>
            <select
              id="mission-audit-select"
              value={selectedSlug}
              onChange={(e) => {
                setSelectedSlug(e.target.value);
                setHasUserEdited(false);
              }}
              className="cq-verifier-select"
            >
              {eventList.map((ev) => (
                <option key={ev.slug} value={ev.slug}>
                  {ev.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: OFFICIAL NUMBERS — READ ONLY */}
      {/* ========================================================================= */}
      <div className="cq-verifier-official-section" aria-label="Official Numbers Read Only">
        <div className="cq-verifier-section-banner cq-verifier-official-banner">
          <div className="cq-verifier-banner-left">
            <Lock size={15} aria-hidden="true" />
            <span className="cq-verifier-banner-title">OFFICIAL NUMBERS — READ ONLY</span>
          </div>
          <div className="cq-verifier-banner-right">
            {metrics.isFrozen ? (
              <span className="cq-verifier-status-badge cq-verifier-status-frozen">
                <Lock size={12} aria-hidden="true" />
                FINAL VERIFIED TOTALS
              </span>
            ) : (
              <span className="cq-verifier-status-badge cq-verifier-status-current">
                <span className="cq-verifier-pulse-dot" aria-hidden="true" />
                CURRENT — NOT FINAL
              </span>
            )}
          </div>
        </div>

        {/* MISSION METADATA BAR */}
        <div className="cq-official-meta-bar">
          <div className="cq-official-meta-item">
            <span className="cq-official-meta-label">MISSION:</span>
            <strong className="cq-official-meta-value">{eventDisplayName}</strong>
          </div>
          <div className="cq-official-meta-item">
            <span className="cq-official-meta-label">STATUS:</span>
            <span className={metrics.isFrozen ? 'cq-meta-status-frozen' : 'cq-meta-status-live'}>
              {metrics.statusLabel}
            </span>
          </div>
          {metrics.isFrozen ? (
            <>
              {metrics.frozenAt && (
                <div className="cq-official-meta-item">
                  <span className="cq-official-meta-label">FREEZE TIMESTAMP:</span>
                  <span className="cq-official-meta-mono">{metrics.frozenAt}</span>
                </div>
              )}
              {metrics.snapshotHash && (
                <div className="cq-official-meta-item cq-official-meta-hash">
                  <span className="cq-official-meta-label">SNAPSHOT HASH:</span>
                  <span className="cq-official-meta-mono">{metrics.snapshotHash}</span>
                </div>
              )}
            </>
          ) : (
            <div className="cq-official-meta-item">
              <span className="cq-official-meta-label">LEDGER STATUS:</span>
              <span className="cq-official-meta-note">
                Live Mission Telemetry — totals update in real-time until drawing ledger freezes at Mission close
              </span>
            </div>
          )}
        </div>

        {/* 4 OFFICIAL READ-ONLY DATA METRIC CARDS */}
        <div className="cq-verifier-metrics-grid">
          {/* PERMANENT CQ NUMBER */}
          <div className="cq-verifier-metric-card cq-verifier-metric-card-constant">
            <div className="cq-verifier-metric-top">
              <span className="cq-verifier-metric-tag">PERMANENT CQ NUMBER</span>
              <span className="cq-verifier-pill-fixed">FIXED CONSTANT</span>
            </div>
            <div className="cq-verifier-metric-num cq-verifier-metric-num-mono">
              {metrics.permanentNumber}
            </div>
            <p className="cq-verifier-metric-desc">
              Permanent alphanumeric cipher of &ldquo;CANTON QUESTS&rdquo; (A=1..Z=26). Fixed in code.
            </p>
          </div>

          {/* TOTAL PLAYERS */}
          <div className="cq-verifier-metric-card">
            <div className="cq-verifier-metric-top">
              <span className="cq-verifier-metric-tag">QUALIFIED PLAYERS</span>
              <span className="cq-verifier-metric-sym">totalPlayers</span>
            </div>
            <div className="cq-verifier-metric-num">
              {loading ? '...' : metrics.totalPlayers.toLocaleString()}
            </div>
            <p className="cq-verifier-metric-desc">
              Total qualified players who registered and participated in this Mission.
            </p>
          </div>

          {/* TOTAL VALID ENTRIES */}
          <div className="cq-verifier-metric-card">
            <div className="cq-verifier-metric-top">
              <span className="cq-verifier-metric-tag">VALID ENTRIES</span>
              <span className="cq-verifier-metric-sym">totalValidEntries</span>
            </div>
            <div className="cq-verifier-metric-num">
              {loading ? '...' : metrics.totalValidEntries.toLocaleString()}
            </div>
            <p className="cq-verifier-metric-desc">
              Total valid prize drawing tickets earned across all qualified players.
            </p>
          </div>

          {/* TOTAL COMPLETED QUESTS */}
          <div className="cq-verifier-metric-card">
            <div className="cq-verifier-metric-top">
              <span className="cq-verifier-metric-tag">COMPLETED QUESTS</span>
              <span className="cq-verifier-metric-sym">totalCompletedQuests</span>
            </div>
            <div className="cq-verifier-metric-num">
              {loading ? '...' : metrics.totalCompletedQuests.toLocaleString()}
            </div>
            <p className="cq-verifier-metric-desc">
              Total verified quest objective completions submitted across the entire Mission.
            </p>
          </div>
        </div>

        {/* ACTUAL SUBSTITUTED EQUATION (SHOWS NUMBERS, NOT VARIABLE NAMES) */}
        <div className="cq-verifier-calc-box">
          <div className="cq-verifier-calc-header">
            <div className="cq-verifier-calc-label-wrap">
              <Sparkles size={14} aria-hidden="true" />
              <span className="cq-verifier-calc-label">ACTUAL SUBSTITUTED EQUATION</span>
            </div>
            <button
              type="button"
              onClick={handleCopyEquation}
              className="cq-verifier-copy-btn"
              title="Copy substituted equation"
            >
              {copiedEquation ? <Check size={13} /> : <Copy size={13} />}
              <span>{copiedEquation ? 'COPIED' : 'COPY EQUATION'}</span>
            </button>
          </div>
          <div className="cq-verifier-equation-text" tabIndex={0}>
            {loading ? (
              'Loading authoritative equation...'
            ) : (
              <code>
                {metrics.permanentNumber} × {metrics.totalPlayers} × {metrics.totalValidEntries} × {metrics.totalCompletedQuests}
              </code>
            )}
          </div>

          {/* FINAL QUEST NUMBER RESULT */}
          <div className="cq-verifier-result-wrap">
            <div className="cq-verifier-result-label-row">
              <div className="cq-verifier-result-label">
                <strong>FINAL QUEST NUMBER</strong>
                <span className="cq-verifier-math-tag">(EXACT BIGINT RESULT)</span>
              </div>
              <button
                type="button"
                onClick={handleCopyNumber}
                className="cq-verifier-copy-btn cq-verifier-copy-btn-prominent"
                title="Copy Final Quest Number"
              >
                {copiedNumber ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedNumber ? 'COPIED NUMBER' : 'COPY NUMBER'}</span>
              </button>
            </div>
            <div className="cq-verifier-result-display">
              <span className="cq-verifier-result-digits">
                {loading ? 'Calculating...' : metrics.finalQuestNumber}
              </span>
            </div>
          </div>
        </div>

        <div className="cq-official-footer-note">
          <p>
            {metrics.note}{' '}
            {metrics.isFrozen
              ? 'This frozen receipt cannot be altered by later database edits.'
              : 'Once drawing entries close, the ledger locks into an immutable cryptographic snapshot.'}
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: CHECK THE MATH YOURSELF — LOCAL CALCULATOR */}
      {/* ========================================================================= */}
      <div className="cq-verifier-calculator-section" aria-label="Check The Math Yourself Local Calculator">
        <div className="cq-verifier-section-banner cq-verifier-calc-banner">
          <div className="cq-verifier-banner-left">
            <Calculator size={15} aria-hidden="true" />
            <span className="cq-verifier-banner-title">CHECK THE MATH YOURSELF — LOCAL CALCULATOR</span>
          </div>
          <button
            type="button"
            onClick={handleResetToOfficial}
            className="cq-calc-reset-btn"
            title="Reset inputs to official server values"
          >
            <RotateCcw size={13} aria-hidden="true" />
            <span>RESET TO OFFICIAL NUMBERS</span>
          </button>
        </div>

        <div className="cq-calc-explainer">
          <p>
            Test any numbers or simulate hypothetical drawing scenarios locally on your device.
            This calculator is seeded automatically with the official values above. <strong>Editing inputs here
            runs strictly in your browser and never modifies server data or official drawing results.</strong>
          </p>
        </div>

        <form onSubmit={handleCalculate} className="cq-calc-form">
          <div className="cq-calc-inputs-grid">
            {/* INPUT 1: CQ NUMBER */}
            <div className="cq-calc-input-group">
              <label htmlFor="calc-input-cq" className="cq-calc-label">
                <span>CQ NUMBER</span>
                <span className="cq-calc-label-tag">Permanent Constant</span>
              </label>
              <input
                id="calc-input-cq"
                type="text"
                value={calcCqNumber}
                onChange={(e) => {
                  setCalcCqNumber(e.target.value);
                  setHasUserEdited(true);
                }}
                className="cq-calc-input cq-calc-input-mono"
                placeholder="311420151417215192019"
              />
            </div>

            {/* INPUT 2: PLAYERS */}
            <div className="cq-calc-input-group">
              <label htmlFor="calc-input-players" className="cq-calc-label">
                <span>PLAYERS</span>
                <span className="cq-calc-label-tag">totalPlayers</span>
              </label>
              <input
                id="calc-input-players"
                type="number"
                min="0"
                step="1"
                value={calcPlayers}
                onChange={(e) => {
                  setCalcPlayers(e.target.value);
                  setHasUserEdited(true);
                }}
                className="cq-calc-input"
                placeholder="0"
              />
            </div>

            {/* INPUT 3: VALID ENTRIES */}
            <div className="cq-calc-input-group">
              <label htmlFor="calc-input-entries" className="cq-calc-label">
                <span>VALID ENTRIES</span>
                <span className="cq-calc-label-tag">totalValidEntries</span>
              </label>
              <input
                id="calc-input-entries"
                type="number"
                min="0"
                step="1"
                value={calcValidEntries}
                onChange={(e) => {
                  setCalcValidEntries(e.target.value);
                  setHasUserEdited(true);
                }}
                className="cq-calc-input"
                placeholder="0"
              />
            </div>

            {/* INPUT 4: COMPLETED QUESTS */}
            <div className="cq-calc-input-group">
              <label htmlFor="calc-input-quests" className="cq-calc-label">
                <span>COMPLETED QUESTS</span>
                <span className="cq-calc-label-tag">totalCompletedQuests</span>
              </label>
              <input
                id="calc-input-quests"
                type="number"
                min="0"
                step="1"
                value={calcCompletedQuests}
                onChange={(e) => {
                  setCalcCompletedQuests(e.target.value);
                  setHasUserEdited(true);
                }}
                className="cq-calc-input"
                placeholder="0"
              />
            </div>
          </div>

          {calcError && (
            <div className="cq-calc-error-banner" role="alert">
              <AlertCircle size={15} aria-hidden="true" />
              <span>{calcError}</span>
            </div>
          )}

          <div className="cq-calc-actions-row">
            <button type="submit" className="cq-calc-submit-btn">
              <Calculator size={15} aria-hidden="true" />
              <span>CALCULATE</span>
            </button>
            <button
              type="button"
              onClick={handleResetToOfficial}
              className="cq-calc-reset-action-btn"
            >
              <RotateCcw size={14} aria-hidden="true" />
              <span>RESET TO OFFICIAL NUMBERS</span>
            </button>
          </div>
        </form>

        {/* LOCAL CALCULATOR RESULT DISPLAY */}
        <div className="cq-calc-result-panel">
          <div className="cq-calc-result-header">
            <span className="cq-calc-result-title">CALCULATED FINAL QUEST NUMBER (LOCAL BIGINT):</span>
            {hasUserEdited && (
              <span className="cq-calc-user-edited-badge">Custom Local Inputs</span>
            )}
          </div>
          <div className="cq-calc-result-equation">
            <code>{calcSubstitutedEquation || `${calcCqNumber} × ${calcPlayers} × ${calcValidEntries} × ${calcCompletedQuests} = ${calcResult}`}</code>
          </div>
          <div className="cq-calc-result-value-box">
            <span className="cq-calc-result-value-digits">{calcResult}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export { FinalQuestVerifierPanel };
