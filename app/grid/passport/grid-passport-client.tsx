'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Crown,
  Globe2,
  Loader2,
  LockKeyhole,
  MapPinned,
  Radio,
  ShieldCheck,
  Sparkles,
  Stamp,
  Trophy,
} from 'lucide-react';
import type { GridPassportProjection } from '@/lib/grid/core/passport-types';
import type { GridPassportCityLabel } from '@/lib/grid/server/passport-read-port';

type CacheState = 'missing' | 'ready' | 'invalid';

interface PassportResponse {
  success: boolean;
  cacheState?: CacheState;
  passport?: GridPassportProjection | null;
  cities?: GridPassportCityLabel[];
  error?: string;
}

function formatDate(value: string | null): string {
  if (!value) return 'NO EVENTS YET';
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return 'UNKNOWN';
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(parsed).toUpperCase();
}

export default function GridPassportClient() {
  const [passport, setPassport] = useState<GridPassportProjection | null>(null);
  const [cities, setCities] = useState<GridPassportCityLabel[]>([]);
  const [cacheState, setCacheState] = useState<CacheState | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [runtimeLocked, setRuntimeLocked] = useState(false);
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
          setRuntimeLocked(true);
          return null;
        }
        const payload = (await response.json()) as PassportResponse;
        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? 'Grid Passport unavailable.');
        }
        return payload;
      })
      .then((payload) => {
        if (!payload || cancelled) return;
        setCacheState(payload.cacheState ?? 'missing');
        setPassport(payload.passport ?? null);
        setCities(payload.cities ?? []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Grid Passport unavailable.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const cityBySlug = useMemo(
    () => new Map(cities.map((city) => [city.slug, city] as const)),
    [cities],
  );
  const rankByCity = useMemo(
    () => new Map((passport?.cityRanks ?? []).map((rank) => [rank.citySlug, rank] as const)),
    [passport],
  );
  const achievementCount = passport
    ? passport.championships.length + passport.landmarkAchievements.length +
      passport.allianceChampionships.length + passport.seasonalTrophies.length
    : 0;

  return (
    <main className="cq-grid-passport-shell">
      <div className="cq-grid-passport-grid" aria-hidden="true" />
      <div className="cq-grid-passport-wrap">
        <header className="cq-grid-passport-header">
          <Link href="/grid/return" className="cq-grid-passport-back">
            <ArrowLeft size={15} aria-hidden="true" /> RETURN BRIEF
          </Link>
          <div className="cq-grid-passport-kicker">
            <Radio size={13} aria-hidden="true" /> PERMANENT RECORD // GRID PASSPORT
          </div>
          <h1 className="cq-grid-passport-title">YOUR CITY HISTORY<br /><span>TRAVELS WITH YOU.</span></h1>
          <p className="cq-grid-passport-intro">
            Local wealth and territory reset with city seasons. Your Home City, achievements,
            ranks, reputation, and cross-city record become part of your permanent identity.
          </p>
        </header>

        {loading ? (
          <section className="cq-grid-passport-state">
            <Loader2 size={25} className="cq-grid-passport-spin" aria-hidden="true" />
            <strong>RECONSTRUCTING PASSPORT</strong>
          </section>
        ) : authRequired ? (
          <section className="cq-grid-passport-state">
            <LockKeyhole size={30} aria-hidden="true" /><h2>PLAYER AUTHENTICATION REQUIRED</h2>
            <p>Sign in to view your private permanent Grid record.</p>
            <Link href="/login" className="cq-grid-passport-action">SIGN IN</Link>
          </section>
        ) : runtimeLocked ? (
          <section className="cq-grid-passport-state">
            <ShieldCheck size={30} aria-hidden="true" /><h2>PASSPORT SIGNAL STAGED</h2>
            <p>The permanent record system is built but private Grid runtime reads are not enabled here.</p>
          </section>
        ) : error ? (
          <section className="cq-grid-passport-state cq-grid-passport-state-error">
            <h2>PASSPORT SIGNAL LOST</h2><p>{error}</p>
          </section>
        ) : cacheState === 'invalid' ? (
          <section className="cq-grid-passport-state cq-grid-passport-state-error">
            <ShieldCheck size={30} aria-hidden="true" /><h2>PASSPORT REBUILD REQUIRED</h2>
            <p>Your permanent ledger is intact, but its cached Passport projection failed validation.</p>
          </section>
        ) : cacheState === 'missing' || !passport ? (
          <section className="cq-grid-passport-state">
            <MapPinned size={30} aria-hidden="true" /><h2>FIRST STAMP WAITING</h2>
            <p>Confirm Home City to create your first permanent Passport event.</p>
            <Link href="/grid/onboarding" className="cq-grid-passport-action">BEGIN GRID ONBOARDING</Link>
          </section>
        ) : (
          <>
            <section className="cq-grid-passport-metrics" aria-label="Passport summary">
              <article><Globe2 size={19} aria-hidden="true" /><span>CITIES ENTERED</span><strong>{passport.citiesEntered.length}</strong></article>
              <article><Crown size={19} aria-hidden="true" /><span>NATIONAL REPUTATION</span><strong>{passport.nationalReputation}</strong></article>
              <article><MapPinned size={19} aria-hidden="true" /><span>LIFETIME TERRITORIES</span><strong>{passport.lifetimeTerritoriesControlled}</strong></article>
              <article><Trophy size={19} aria-hidden="true" /><span>PEAK CITY RANK</span><strong>{passport.peakRank ?? '—'}</strong></article>
            </section>

            <section className="cq-grid-passport-book">
              <div className="cq-grid-passport-book-heading">
                <div><span>CROSS-CITY RECORD</span><h2>CITIES ON YOUR PASSPORT</h2></div>
                <div className="cq-grid-passport-seal"><Stamp size={26} aria-hidden="true" /> GRID</div>
              </div>
              <ol className="cq-grid-passport-cities">
                {passport.citiesEntered.map((slug, index) => {
                  const city = cityBySlug.get(slug);
                  const rank = rankByCity.get(slug);
                  return (
                    <li key={slug} className="cq-grid-passport-city">
                      <div className="cq-grid-passport-city-number">{String(index + 1).padStart(2, '0')}</div>
                      <div className="cq-grid-passport-city-body">
                        <div className="cq-grid-passport-city-topline">
                          <h3>{city?.name ?? slug.replace(/-/g, ' ').toUpperCase()}</h3>
                          {passport.homeCitySlug === slug ? <span className="cq-grid-passport-home">HOME CITY</span> : null}
                        </div>
                        <p>{city ? `${city.regionCode} // ${city.countryCode} // ${slug.toUpperCase()}` : slug.toUpperCase()}</p>
                        <div className="cq-grid-passport-rankline">
                          <span>CURRENT RANK <strong>{rank?.currentRank ?? '—'}</strong></span>
                          <span>PEAK RANK <strong>{rank?.peakRank ?? '—'}</strong></span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>

            <section className="cq-grid-passport-record-grid">
              <article><Award size={20} aria-hidden="true" /><span>ACHIEVEMENTS</span><strong>{achievementCount}</strong><p>Championships, landmarks, alliance wins, and seasonal trophies.</p></article>
              <article><Sparkles size={20} aria-hidden="true" /><span>RARE COSMETICS</span><strong>{passport.rareCosmetics.length}</strong><p>Permanent cosmetic unlocks earned across The Grid.</p></article>
              <article><Stamp size={20} aria-hidden="true" /><span>LEDGER EVENTS</span><strong>{passport.processedEventCount}</strong><p>Unique permanent events replayed into this Passport.</p></article>
            </section>

            <div className="cq-grid-passport-footnote">
              LAST PASSPORT EVENT // {formatDate(passport.lastUpdatedAt)}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
