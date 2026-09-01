'use client';

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  CheckCircle2,
  Compass,
  ImagePlus,
  Lock,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  User,
  LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';
import { Achievement, Player, PlayerAchievement } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import PlayerCard from '@/components/PlayerCard';
import PlayerAvatar from '@/components/PlayerAvatar';
import {
  CUSTOM_AVATAR_KEY,
  PLAYER_AVATAR_PRESETS,
  PLAYER_CARD_BADGE_SLOT_COUNT,
  getAvatarPresetPath,
  hasValidAvatar,
} from '@/lib/player-command-center';
import { showGameMoment } from '@/lib/game-effects';
import { getPathTone } from '@/lib/path-tone';

type BadgeCatalogItem = Achievement & {
  iconPath: string;
  earned: boolean;
  earnedAt?: string;
};

// Permanent Player File data only — this page renders the Player Card,
// Badge Selection, and Profile Settings. /api/player/command-center is
// scoped to exactly this data; Mission-specific data (path, district,
// quest recommendations, finale-key state) is fetched by Mission pages
// directly, never through this endpoint. See
// app/api/player/command-center/route.ts.
type CommandCenterData = {
  player: Player & { avatarPresetPath?: string };
  playerSignalStatus: 'STANDBY' | 'ACTIVE' | 'ON MISSION';
  stats: {
    totalXp: number;
    cityRank: number | null;
    completedQuests: number;
    prizeEntries: number;
    participatedQuestCount: number;
  };
  badges: {
    catalog: BadgeCatalogItem[];
    featuredSlugs: string[];
    maxFeatured: number;
  };
};

// Matches the server-side limit enforced in app/api/player/profile/route.ts
// (tagline: cleanString(body.tagline, 60)) and fits the Player Card's Motto
// panel (3 clamped lines) without overflow.
const MOTTO_MAX_LENGTH = 60;

function authHeaders(): Record<string, string> {
  return {};
}

function formatDate(value?: string) {
  if (!value) return 'Unavailable';
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

/**
 * The Player Identity onboarding cinematic — only ever fired when the
 * server confirms a genuinely new grant (payload.profileCompletionReward),
 * never inferred client-side from the form state.
 */
function announceProfileCompletion(payload: {
  profileCompletionReward?: boolean;
  profileCompletionXp?: number;
  player?: Player;
  newAchievement?: PlayerAchievement;
}) {
  if (!payload.profileCompletionReward) return;
  showGameMoment({
    type: 'reward-token',
    kind: 'xp',
    headline: 'IDENTITY CONFIRMED',
    primaryText: 'PLAYER PROFILE ACTIVE',
    secondaryText: 'You are officially on the board.',
    xpAmount: payload.profileCompletionXp || 100,
    cta: 'VIEW PLAYER FILE',
  });

  // A real, permanent badge alongside the XP — queued right after so it
  // never overlaps the reward-token moment above.
  const ach = payload.newAchievement?.achievement;
  if (ach) {
    showGameMoment({
      type: 'achievement',
      achievementId: ach.slug,
      title: ach.name,
      description: ach.description,
      icon: ach.badgeSymbol || '🏅',
      category: ach.category,
    });
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [motto, setMotto] = useState('');
  const [avatarPresetKey, setAvatarPresetKey] = useState('1');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [featuredBadgeSlugs, setFeaturedBadgeSlugs] = useState<string[]>([]);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [lastNumberedPresetKey, setLastNumberedPresetKey] = useState('1');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('canton_auth_token');
        window.localStorage.removeItem('canton_refresh_token');
        window.localStorage.removeItem('canton_quests_current_player');
        window.localStorage.removeItem('canton_player_profile');
      }
      router.push('/');
      router.refresh();
    }
  };

  const loadCommandCenter = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/player/command-center', { headers: authHeaders() });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Player File unavailable.');
      const nextData = payload as CommandCenterData & { success: true };
      setData(nextData);
      setDisplayName(nextData.player.displayName || '');
      setMotto(nextData.player.tagline || '');
      const loadedPresetKey = nextData.player.avatarPresetKey || '1';
      setAvatarPresetKey(loadedPresetKey);
      if (PLAYER_AVATAR_PRESETS.includes(loadedPresetKey as (typeof PLAYER_AVATAR_PRESETS)[number])) {
        setLastNumberedPresetKey(loadedPresetKey);
      }
      setCropZoom(nextData.player.profileImageCropZoom || 1);
      setCropX(nextData.player.profileImageCropX ?? 50);
      setCropY(nextData.player.profileImageCropY ?? 50);
      setFeaturedBadgeSlugs(nextData.badges.featuredSlugs || []);
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Unable to load player profile.') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommandCenter();
  }, []);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const isCustomSelected = avatarPresetKey === CUSTOM_AVATAR_KEY;
  const hasCustomPhoto = Boolean(data?.player.profileImagePath);
  const customPhotoPreviewUrl = pendingPreviewUrl || data?.player.profileImageUrl || undefined;
  const avatarImage = isCustomSelected
    ? customPhotoPreviewUrl || getAvatarPresetPath(avatarPresetKey)
    : getAvatarPresetPath(avatarPresetKey);
  const resetCrop = () => {
    setCropZoom(1);
    setCropX(50);
    setCropY(50);
  };
  const featuredBadges = useMemo(
    () => featuredBadgeSlugs
      .map((slug) => data?.badges.catalog.find((badge) => badge.slug === slug && badge.earned))
      .filter((badge): badge is BadgeCatalogItem => Boolean(badge)),
    [data, featuredBadgeSlugs]
  );
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/player/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          playerId: data?.player.id,
          displayName,
          tagline: motto,
          avatarPresetKey,
          profileImageCropZoom: cropZoom,
          profileImageCropX: cropX,
          profileImageCropY: cropY,
          featuredBadgeSlugs,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Profile save failed.');
      setMessage({ type: 'success', text: 'Player File saved.' });
      announceProfileCompletion(payload);
      await loadCommandCenter();
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Profile save failed.') });
    } finally {
      setSaving(false);
    }
  };

  const handleFileChosen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (!file) return;

    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    const localPreviewUrl = URL.createObjectURL(file);
    setPendingPreviewUrl(localPreviewUrl);
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('cropZoom', String(cropZoom));
      form.set('cropX', String(cropX));
      form.set('cropY', String(cropY));
      const response = await fetch('/api/player/profile-image', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Upload failed.');
      setMessage({ type: 'success', text: 'Custom photo uploaded and selected. Adjust crop below, then Save Player File.' });
      announceProfileCompletion(payload);
      await loadCommandCenter();
      URL.revokeObjectURL(localPreviewUrl);
      setPendingPreviewUrl(null);
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Upload failed.') });
      URL.revokeObjectURL(localPreviewUrl);
      setPendingPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/player/profile-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ lastNumberedPresetKey }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Remove failed.');
      setMessage({ type: 'success', text: 'Custom player image removed.' });
      announceProfileCompletion(payload);
      await loadCommandCenter();
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Remove failed.') });
    } finally {
      setUploading(false);
    }
  };

  const toggleFeaturedBadge = (slug: string) => {
    setFeaturedBadgeSlugs((current) => {
      if (current.includes(slug)) return current.filter((item) => item !== slug);
      if (current.length >= PLAYER_CARD_BADGE_SLOT_COUNT) return current;
      return [...current, slug];
    });
  };

  return (
    <div className="cq-home-shell">
      <CinematicNav eventHref="/events/canton-weekend-1" context="global" />
      <main className="cq-command-shell">
        <div className="cq-command-hero">
          <div>
            <p className="cq-command-eyebrow">Permanent Player Identity</p>
            <h1>{data?.player.displayName || 'Canton Agent'}</h1>
          </div>
          <div className="cq-command-actions">
            <button
              type="button"
              onClick={handleLogout}
              className="cq-command-logout-btn"
              title="Explicit Log Out"
            >
              <LogOut size={15} />
              <span>LOG OUT</span>
            </button>
          </div>
        </div>

        {message && (
          <div className={`cq-command-alert ${message.type === 'success' ? 'is-success' : 'is-error'}`} role="status">
            {message.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldCheck size={18} />}
            <span>{message.text}</span>
          </div>
        )}

        {loading ? (
          <div className="cq-command-loading">Opening encrypted field terminal...</div>
        ) : !data ? (
          <div className="cq-command-loading">
            <p>Authentication required.</p>
            <Link href="/" className="cq-command-primary-link">Return to Start</Link>
          </div>
        ) : (
          <form onSubmit={saveProfile} className="cq-command-grid">
            <section className="cq-player-card-panel" aria-label="Player ID Card preview">
              <PlayerCard
                displayName={displayName || 'Canton Agent'}
                motto={motto}
                avatarImage={avatarImage}
                cropZoom={cropZoom}
                cropX={cropX}
                cropY={cropY}
                totalXp={data.stats.totalXp}
                completedQuests={data.stats.completedQuests}
                prizeEntries={data.stats.prizeEntries}
                cityRank={data.stats.cityRank}
                participatedQuestCount={data.stats.participatedQuestCount || 0}
                memberSinceDate={data.player.createdAt ? formatDate(data.player.createdAt).toUpperCase() : 'AUG 2026'}
                playerCode={data.player.id ? `CQ-${data.player.id.slice(-4).toUpperCase()}` : 'CQ-2026'}
                signalStatusText={data.playerSignalStatus}
                clearanceLevelText="VOL. 1 OPERATIVE"
                featuredBadges={featuredBadges}
              />
            </section>

            <section className="cq-command-section" aria-labelledby="badges-heading">
              <div className="cq-command-section-head">
                <h2 id="badges-heading">BADGES</h2>
                <BadgeCheck size={18} />
              </div>
              <p className="cq-section-note">Select up to {data.badges.maxFeatured} earned BADGES for the round ID Card slots.</p>
              <div className="cq-badge-grid">
                {data.badges.catalog.map((badge) => (
                  <button
                    type="button"
                    key={badge.slug}
                    disabled={!badge.earned}
                    onClick={() => toggleFeaturedBadge(badge.slug)}
                    className={`cq-badge-button ${badge.earned ? 'is-earned' : 'is-locked'} ${featuredBadgeSlugs.includes(badge.slug) ? 'is-featured' : ''}`}
                  >
                    <Image src={badge.iconPath} alt="" width={44} height={44} />
                    <span>{badge.name}</span>
                    <em>{badge.earned ? `${badge.rarity}${badge.earnedAt ? ` // ${formatDate(badge.earnedAt)}` : ''}` : 'Locked'}</em>
                  </button>
                ))}
              </div>
            </section>

            {/* CHOSEN PATH — the player's universal identity/tone preference
                (players.selected_starting_path), not a Mission-specific
                district or eligibility. Same FAMILY/CHALLENGE/SECRET value
                everywhere across Canton Quests, never a Mission's own
                geography. */}
            <section className="cq-command-section" aria-labelledby="path-heading">
              <div className="cq-command-section-head">
                <h2 id="path-heading">CHOSEN PATH</h2>
                <Compass size={18} />
              </div>
              {(() => {
                const tone = getPathTone(data.player.selectedStartingPath);
                if (!tone) {
                  return (
                    <div className="cq-identity-status">
                      <span>NO PATH CHOSEN YET</span>
                      <Link href="/#choose-path" className="cq-command-primary-link">
                        Choose your path →
                      </Link>
                    </div>
                  );
                }
                return (
                  <div className="cq-identity-status is-complete" style={{ borderColor: `${tone.color}50` }}>
                    <CheckCircle2 size={15} style={{ color: tone.color }} />
                    <span style={{ color: tone.color }}>{tone.label}</span>
                    <em>{tone.styleTag}</em>
                  </div>
                );
              })()}
              <p className="cq-section-note">
                Your path shapes how Canton Quests talks to you — tone, flavor text, and Commander wording. Every
                player can play every Quest no matter which path they chose.
              </p>
            </section>

            <section className="cq-command-section" aria-labelledby="settings-heading">
              <div className="cq-command-section-head">
                <h2 id="settings-heading">Profile Settings</h2>
                <Lock size={18} />
              </div>

              {(() => {
                const identityComplete = hasValidAvatar(data.player);
                return (
                  <div className={`cq-identity-status${identityComplete ? ' is-complete' : ''}`}>
                    {identityComplete ? (
                      <>
                        <CheckCircle2 size={15} />
                        <span>PLAYER IDENTITY COMPLETE</span>
                        <em>+100 XP CLAIMED</em>
                      </>
                    ) : (
                      <>
                        <span className="cq-identity-status-title">PLAYER IDENTITY</span>
                        <span className="cq-identity-status-item">○ Select your player image</span>
                        <em>Complete your identity <strong>+100 XP</strong></em>
                      </>
                    )}
                  </div>
                );
              })()}

              <div className="cq-settings-grid">
                <label>
                  <span>Callsign</span>
                  <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={30} required />
                </label>
                <label>
                  <span>Motto ({MOTTO_MAX_LENGTH - motto.length} left)</span>
                  <input
                    value={motto}
                    onChange={(event) => setMotto(event.target.value)}
                    maxLength={MOTTO_MAX_LENGTH}
                    placeholder="Optional — a short personal tagline for your Player Card"
                  />
                </label>
              </div>

              <div className="cq-avatar-controls">
                <div className="cq-avatar-controls-full">
                  <h3><User size={16} /> Custom Avatar</h3>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileChosen}
                    style={{ display: 'none' }}
                  />
                  <div className="cq-avatar-grid">
                    {hasCustomPhoto ? (
                      <button
                        type="button"
                        onClick={() => setAvatarPresetKey(CUSTOM_AVATAR_KEY)}
                        className={isCustomSelected ? 'is-selected' : ''}
                        aria-label="Select your uploaded custom photo"
                        title="Custom photo"
                      >
                        {data.player.profileImageUrl && (
                          <Image src={data.player.profileImageUrl} alt="" width={58} height={58} unoptimized />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cq-avatar-add-tile"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Add a custom photo"
                        disabled={uploading}
                      >
                        <Plus size={20} />
                        <span>Add Photo</span>
                      </button>
                    )}
                    {PLAYER_AVATAR_PRESETS.map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => {
                          setAvatarPresetKey(key);
                          setLastNumberedPresetKey(key);
                        }}
                        className={avatarPresetKey === key ? 'is-selected' : ''}
                        aria-label={`Select CQ avatar ${key}`}
                      >
                        <Image src={`/canton-quests/${key}.png`} alt="" width={58} height={58} />
                      </button>
                    ))}
                  </div>

                  {isCustomSelected && hasCustomPhoto && (
                    <div className="cq-avatar-crop-editor">
                      <div className="cq-avatar-crop-preview-col">
                        <span className="cq-avatar-crop-preview-label">Live Avatar Preview</span>
                        <div className="cq-avatar-crop-preview-ring">
                          <PlayerAvatar
                            avatarUrl={customPhotoPreviewUrl}
                            cropZoom={cropZoom}
                            cropX={cropX}
                            cropY={cropY}
                            size={130}
                            className="cq-avatar-crop-preview-img"
                            ariaLabel="Live avatar crop preview"
                          />
                        </div>
                        <div className="cq-avatar-crop-nav-demo">
                          <PlayerAvatar
                            avatarUrl={customPhotoPreviewUrl}
                            cropZoom={cropZoom}
                            cropX={cropX}
                            cropY={cropY}
                            size={44}
                            className="cq-avatar-crop-nav-demo-img"
                            ariaLabel="Navigation bar avatar preview"
                          />
                          <span>Nav Size</span>
                        </div>
                      </div>

                      <div className="cq-avatar-crop-controls-col">
                        <label className="cq-crop-slider-row">
                          <div className="cq-crop-slider-head">
                            <span>Zoom</span>
                            <em>{cropZoom.toFixed(2)}&times;</em>
                          </div>
                          <input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} />
                        </label>
                        <label className="cq-crop-slider-row">
                          <div className="cq-crop-slider-head">
                            <span>Horizontal</span>
                            <em>{Math.round(cropX)}%</em>
                          </div>
                          <input type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} />
                        </label>
                        <label className="cq-crop-slider-row">
                          <div className="cq-crop-slider-head">
                            <span>Vertical</span>
                            <em>{Math.round(cropY)}%</em>
                          </div>
                          <input type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} />
                        </label>
                        <button type="button" className="cq-reset-crop-btn" onClick={resetCrop}>
                          <RotateCcw size={13} />
                          <span>Reset Crop</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {hasCustomPhoto && (
                    <div className="cq-button-row">
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                        <ImagePlus size={16} />
                        {uploading ? 'Uploading...' : 'Change Photo'}
                      </button>
                      <button type="button" onClick={removePhoto} disabled={uploading}>
                        <RotateCcw size={16} />
                        Remove Photo
                      </button>
                    </div>
                  )}
                  {isCustomSelected && (
                    <p className="cq-avatar-active-note">Custom photo selected — your active avatar. Save Player File to apply it everywhere.</p>
                  )}
                </div>
              </div>

              <button type="submit" disabled={saving} className="cq-save-command">
                <Save size={18} />
                <span>{saving ? 'Saving...' : 'Save Player File'}</span>
              </button>
            </section>
          </form>
        )}
      </main>
      <CinematicFooter />
    </div>
  );
}
