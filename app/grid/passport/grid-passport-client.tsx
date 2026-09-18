'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Globe2, Loader2, LockKeyhole, MapPinned, Radio, ShieldCheck, Stamp } from 'lucide-react';

interface PassportStamp {
  cityId: string;
  firstEnteredAt: string;
  lastEnteredAt: string;
  entryCount: number;
  isHomeCity: boolean;
}

interface PassportCity {
  cityId: string;
  slug: string;
  name: string;
  regionCode: string;
  countryCode: string;
}

interface PassportView {
  homeCityId: string | null;
  globalReputation: number;
  history: {
    version: 1;
    homeCityId: string | null;
    citiesEntered: number;
    entriesRecorded: number;
    stamps: PassportStamp[];
  };
  cities: PassportCity[];
}

interface PassportResponse {
  success: boolean;
  passport?: PassportView | null;
  error?: string;
}

function displayDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}

export default function GridPassportClient() {
  const [passport, setPassport] = useState<PassportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/grid/passport', { cache: 'no-store' })
      .then(async (response) => {
        if (cancelled) return null;
        if (response.status === 401) {
          setAuthRequired(true);
          return null;
        }
        if (response.status === 404) {
          setLocked(true);
          return null;
        }
        const payload = (await response.json()) as PassportResponse;
        if (!response.ok || !payload.success) throw new Error(payload.error ?? 'Grid Passport unavailable.');
        return payload.passport ?? null;
      })
      .then((nextPassport) => {
        if (!cancelled && nextPassport !== undefined) setPassport(nextPassport);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Grid Passport unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const cityById = useMemo(
    () => new Map((passport?.cities ?? []).map((city) => [city.cityId, city] as const)),
    [passport],
  );

  return (
    <main className="cq-grid-passport-shell">
      <div className="cq-grid-passport-grid" aria-hidden="true" />
      <div className="cq-grid-passport-wrap">
        <header className="cq-grid-passport-header">
          <Link href="/grid" className="cq-grid-passport-back">
            <ArrowLeft size={15} aria-hidden="true" /> THE GRID
          </Link>
          <div className="cq-grid-passport-kicker"><Radio size={13} aria-hidden="true" /> PERMANENT RECORD // GRID PASSPORT</div>
          <h1 className="cq-grid-passport-title">YOUR CITY HISTORY<br /><span>TRAVELS WITH YOU.</span></h1>
          <p className="cq-grid-passport-intro">Local power resets. Your record does not. Every city you enter becomes part of a permanent cross-city identity.</p>
        </header>

        {loading ? (
          <section className="cq-grid-passport-state"><Loader2 size={24} className="cq-grid-passport-spin" aria-hidden="true" /><strong>READING PASSPORT</strong></section>
        ) : authRequired ? (
          <section className="cq-grid-passport-state"><LockKeyhole size={30} aria-hidden="true" /><h2>PLAYER AUTHENTICATION REQUIRED</h2><p>Sign in to view your private permanent Grid record.</p><Link href="/login" className="cq-grid-passport-action">SIGN IN</Link></section>
        ) : locked ? (
          <section className="cq-grid-passport-state"><ShieldCheck size={30} aria-hidden="true" /><h2>PASSPORT SYSTEM STAGED</h2><p>The permanent record system is built but not enabled in this environment.</p></section>
        ) : error ? (
          <section className="cq-grid-passport-state cq-grid-passport-state-error"><h2>PASSPORT SIGNAL LOST</h2><p>{error}</p></section>
        ) : !passport ? (
          <section className="cq-grid-passport-state"><MapPinned size={30} aria-hidden="true" /><h2>NO GRID PROFILE YET</h2><p>Confirm your Home City and enter a Grid season to begin your permanent record.</p><Link href="/grid/onboarding" className="cq-grid-passport-action">BEGIN GRID ONBOARDING</Link></section>
        ) : (
          <>
            <section className="cq-grid-passport-metrics" aria-label="Passport summary">
              <article><Globe2 size={19} aria-hidden="true" /><span>CITIES ENTERED</span><strong>{passport.history.citiesEntered}</strong></article>
              <article><Stamp size={19} aria-hidden="true" /><span>CITY ENTRIES</span><strong>{passport.history.entriesRecorded}</strong></article>
              <article><ShieldCheck size={19} aria-hidden="true" /><span>NATIONAL REPUTATION</span><strong>{passport.globalReputation}</strong></article>
            </section>

            <section className="cq-grid-passport-book">
              <div className="cq-grid-passport-book-heading">
                <div><span>PERMANENT STAMPS</span><h2>CITIES ON YOUR RECORD</h2></div>
                <div className="cq-grid-passport-seal"><Stamp size={26} aria-hidden="true" /> GRID</div>
              </div>

              {passport.history.stamps.length === 0 ? (
                <div className="cq-grid-passport-empty"><Stamp size={30} aria-hidden="true" /><h3>FIRST STAMP WAITING</h3><p>Your Home City is confirmed. Your first recorded city entry will appear here.</p></div>
              ) : (
                <ol className="cq-grid-passport-stamps">
                  {passport.history.stamps.map((stamp, index) => {
                    const city = cityById.get(stamp.cityId);
                    return (
                      <li key={stamp.cityId} className="cq-grid-passport-stamp">
                        <div className="cq-grid-passport-stamp-number">{String(index + 1).padStart(2, '0')}</div>
                        <div className="cq-grid-passport-stamp-body">
                          <div className="cq-grid-passport-stamp-topline">
                            <h3>{city?.name ?? 'Archived Grid City'}</h3>
                            {stamp.isHomeCity ? <span className="cq-grid-passport-home">HOME CITY</span> : null}
                          </div>
                          <p>{city ? `${city.regionCode} // ${city.countryCode} // ${city.slug.toUpperCase()}` : 'CITY RECORD RETAINED'}</p>
                          <dl className="cq-grid-passport-stamp-facts">
                            <div><dt>FIRST ENTRY</dt><dd>{displayDate(stamp.firstEnteredAt)}</dd></div>
                            <div><dt>LATEST ENTRY</dt><dd>{displayDate(stamp.lastEnteredAt)}</dd></div>
                            <div><dt>ENTRIES</dt><dd>{stamp.entryCount}</dd></div>
                          </dl>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
