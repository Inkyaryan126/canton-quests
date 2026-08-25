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
  Map,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Zap,
  LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';
import { Achievement, Player, PlayerAchievement, Quest, StartingPath } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import PlayerCard from '@/components/PlayerCard';
import PlayerAvatar from '@/components/PlayerAvatar';
import {
  CUSTOM_AVATAR_KEY,
  PLAYER_AVATAR_PRESETS,
  PLAYER_CARD_BADGE_SLOT_COUNT,
  STARTING_DISTRICTS,
  getAvatarPresetPath,
  hasValidAvatar,
  hasValidStartingPath,
} from '@/lib/player-command-center';
import { showGameMoment } from '@/lib/game-effects';

type BadgeCatalogItem = Achievement & {
  iconPath: string;
  earned: boolean;
  earnedAt?: string;
};

type CommandCenterData = {
  eventId: string;
  player: Player & { avatarPresetPath?: string };
  startingDistrict: { label: string; district: string; color: string };
  stats: {
    totalXp: number;
    cityRank: number | null;
    completedQuests: number;
    prizeEntries: number;
    badgesEarned: number;
  };
  quests: {
    recommended: Quest[];
    startingDistrict: Quest[];
    citywide: Quest[];
    allAvailable: Quest[];
  };
  districtProgress: Array<{ path: string; label: string; completed: number; total: number }>;
  badges: {
    earned: PlayerAchievement[];
    catalog: BadgeCatalogItem[];
    featuredSlugs: string[];
    maxFeatured: number;
  };
  recentActivity: Array<{ id: string; label: string; detail: string; occurredAt: string }>;
  founderKeys?: { mark: boolean; code: boolean; word: boolean };
};

const pathOptions: Array<{ value: StartingPath; label: string; district: string }> = [
  { value: 'family', label: 'FAMILY', district: 'Arts District' },
  { value: 'challenge', label: 'CHALLENGE', district: '9th St Skate Park area' },
  { value: 'secret', label: 'SECRET', district: 'West Lawn Cemetery / McKinley area' },
];

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
function announceProfileCompletion(payload: { profileCompletionReward?: boolean; profileCompletionXp?: number; player?: Player }) {
  if (!payload.profileCompletionReward) return;
  const path = payload.player?.selectedStartingPath;
  showGameMoment({
    type: 'reward-token',
    kind: 'xp',
    headline: 'IDENTITY CONFIRMED',
    primaryText: 'PLAYER PROFILE ACTIVE',
    secondaryText: 'You are officially on the board.',
    xpAmount: payload.profileCompletionXp || 100,
    pathColor: path ? STARTING_DISTRICTS[path].color : undefined,
    cta: 'ENTER COMMAND CENTER',
  });
}

function QuestList({ title, quests }: { title: string; quests: Quest[] }) {
  return (
    <section className="cq-command-section" aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}>
      <div className="cq-command-section-head">
        <h2 id={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}>{title}</h2>
      </div>
      {quests.length === 0 ? (
        <p className="cq-empty-state">No active signals in this group yet.</p>
      ) : (
        <div className="cq-command-quest-grid">
          {quests.map((quest) => (
            <Link key={quest.id} href={`/events/canton-weekend-1/quests/${quest.id}`} className="cq-command-quest-card">
              <span className="cq-command-quest-meta">{quest.location?.name || quest.startingPath || 'Canton'} • {quest.difficulty}</span>
              <strong>{quest.title}</strong>
              <span>{quest.xpReward || quest.pointValue} XP</span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [data, setData] = useState<CommandCenterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarPresetKey, setAvatarPresetKey] = useState('1');
  const [selectedStartingPath, setSelectedStartingPath] = useState<StartingPath>('family');
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
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Command Center unavailable.');
      const nextData = payload as CommandCenterData & { success: true };
      setData(nextData);
      setDisplayName(nextData.player.displayName || '');
      const loadedPresetKey = nextData.player.avatarPresetKey || '1';
      setAvatarPresetKey(loadedPresetKey);
      if (PLAYER_AVATAR_PRESETS.includes(loadedPresetKey as (typeof PLAYER_AVATAR_PRESETS)[number])) {
        setLastNumberedPresetKey(loadedPresetKey);
      }
      setSelectedStartingPath(nextData.player.selectedStartingPath || 'family');
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
  const nextMove = data?.quests.recommended[0];

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
          avatarPresetKey,
          selectedStartingPath,
          profileImageCropZoom: cropZoom,
          profileImageCropX: cropX,
          profileImageCropY: cropY,
          featuredBadgeSlugs,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Profile save failed.');
      setMessage({ type: 'success', text: 'Command Center profile saved.' });
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
      setMessage({ type: 'success', text: 'Custom photo uploaded and selected. Adjust crop below, then Save Command Center.' });
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
      <CinematicNav eventHref="/events/canton-weekend-1" />
      <main className="cq-command-shell">
        <div className="cq-command-hero">
          <div>
            <p className="cq-command-eyebrow">Authenticated Player Command Center</p>
            <h1>{data?.player.displayName || 'Canton Agent'}</h1>
          </div>
          <div className="cq-command-actions">
            <Link href="/quests" className="cq-command-primary-link">
              <Compass size={18} />
              <span>All Quests</span>
            </Link>
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
                startingPathLabel={data.startingDistrict.label}
                startingDistrictName={data.startingDistrict.district}
                avatarImage={avatarImage}
                cropZoom={cropZoom}
                cropX={cropX}
                cropY={cropY}
                totalXp={data.stats.totalXp}
                completedQuests={data.stats.completedQuests}
                prizeEntries={data.stats.prizeEntries}
                cityRank={data.stats.cityRank}
                memberSinceDate={data.player.createdAt ? formatDate(data.player.createdAt).toUpperCase() : 'AUG 2026'}
                playerCode={data.player.id ? `CQ-${data.player.id.slice(-4).toUpperCase()}` : 'CQ-2026'}
                playerLevelText={`LEVEL ${Math.max(1, Math.floor((data.stats.totalXp || 0) / 500) + 1)} // ${data.startingDistrict.label}`}
                clearanceLevelText="VOL. 1 OPERATIVE"
                featuredBadges={featuredBadges}
              />
            </section>

            <section className="cq-command-section cq-next-move" aria-labelledby="next-move-heading">
              <div className="cq-command-section-head">
                <h2 id="next-move-heading">Commander&apos;s Next Move</h2>
                <Zap size={18} />
              </div>
              {nextMove ? (
                <Link href={`/events/canton-weekend-1/quests/${nextMove.id}`} className="cq-next-move-card">
                  <span>{nextMove.location?.name || data.startingDistrict.district}</span>
                  <strong>{nextMove.title}</strong>
                  <em>{nextMove.xpReward || nextMove.pointValue} XP // {nextMove.verificationType}</em>
                </Link>
              ) : (
                <p className="cq-empty-state">No open recommendation. The full city board remains available.</p>
              )}
              <div className="cq-starting-district" style={{ borderColor: data.startingDistrict.color }}>
                <Map size={18} />
                <div>
                  <span>Starting District</span>
                  <strong>{data.startingDistrict.district}</strong>
                </div>
              </div>
              <p className="cq-open-city-copy">Your path recommends where to begin. The entire city remains open.</p>
            </section>

            <section className="cq-command-stats" aria-label="Player stats">
              {[
                ['XP', data.stats.totalXp],
                ['City Rank', data.stats.cityRank ? `#${data.stats.cityRank}` : 'Unranked'],
                ['Completed', data.stats.completedQuests],
                ['Drawing Entries', data.stats.prizeEntries],
                ['BADGES', data.stats.badgesEarned],
              ].map(([label, value]) => (
                <div key={label} className="cq-command-stat">
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </section>

            <QuestList title="Recommended Quests" quests={data.quests.startingDistrict} />
            <QuestList title="Other Districts / Citywide Access" quests={data.quests.citywide} />

            <section className="cq-command-section" aria-labelledby="district-progress-heading">
              <div className="cq-command-section-head">
                <h2 id="district-progress-heading">District Progress</h2>
              </div>
              <div className="cq-progress-stack">
                {data.districtProgress.map((district) => {
                  const pct = district.total ? Math.round((district.completed / district.total) * 100) : 0;
                  return (
                    <div key={district.path} className="cq-progress-row">
                      <span>{district.label}</span>
                      <strong>{district.completed} / {district.total}</strong>
                      <div><i style={{ width: `${pct}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="cq-command-section" aria-labelledby="drawing-entries-heading">
              <div className="cq-command-section-head">
                <h2 id="drawing-entries-heading">DRAWING ENTRIES</h2>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.5rem', color: '#f59e0b', fontWeight: 900 }}>
                  {data.stats.prizeEntries}
                </span>
              </div>
              <p className="cq-section-note">Each entry gives you another chance at one of the random cash drawings.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(8,11,16,0.75)' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700, display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '0.08em' }}>RANDOM CASH PRIZES</span>
                  <span style={{ color: '#fff' }}>$100 + $50 + $50 = $200</span>
                </div>
                <div style={{ padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(8,11,16,0.75)' }}>
                  <span style={{ color: '#f59e0b', fontWeight: 700, display: 'block', marginBottom: '4px', textTransform: 'uppercase', fontSize: '0.62rem', letterSpacing: '0.08em' }}>HOW TO EARN</span>
                  <span style={{ color: '#ccc' }}>+1 signup · +1 per verified quest</span>
                </div>
              </div>
              <p className="cq-section-note" style={{ marginTop: '8px' }}>Drawing entries do not affect leaderboard placement. XP determines rank.</p>
            </section>

            <section className="cq-command-section" aria-labelledby="master-key-heading">
              <div className="cq-command-section-head">
                <h2 id="master-key-heading">FOUNDER&apos;S THREE LOCKS</h2>
                <ShieldCheck size={18} />
              </div>
              <p className="cq-section-note">Complete each district path to claim the three keys. All three unlock THE FOUNDER&apos;S THREE LOCKS finale chain.</p>
              <div className="cq-master-key-grid">
                {[
                  { id: 'mark', label: 'THE MARK', path: 'FAMILY / RECORD', acquired: data.founderKeys?.mark ?? false, color: '#f59e0b' },
                  { id: 'code', label: 'THE CODE', path: 'CHALLENGE / TRIAL', acquired: data.founderKeys?.code ?? false, color: '#ef4444' },
                  { id: 'word', label: 'THE WORD', path: 'SECRET / ARCHIVE', acquired: data.founderKeys?.word ?? false, color: '#a855f7' },
                ].map((key) => (
                  <div key={key.id} className={`cq-master-key-slot${key.acquired ? ' is-acquired' : ' is-locked'}`} style={key.acquired ? { borderColor: key.color } : {}}>
                    <span className="cq-master-key-label" style={key.acquired ? { color: key.color } : {}}>{key.label}</span>
                    <span className="cq-master-key-path">{key.path}</span>
                    <span className="cq-master-key-status">{key.acquired ? 'ACQUIRED' : 'LOCKED'}</span>
                  </div>
                ))}
              </div>
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

            <section className="cq-command-section" aria-labelledby="activity-heading">
              <div className="cq-command-section-head">
                <h2 id="activity-heading">Recent Field Activity</h2>
              </div>
              {data.recentActivity.length === 0 ? (
                <p className="cq-empty-state">No verified activity yet. Start with the recommended district signal.</p>
              ) : (
                <div className="cq-activity-list">
                  {data.recentActivity.map((item) => (
                    <div key={item.id}>
                      <span>{item.label}</span>
                      <strong>{item.detail}</strong>
                      <em>{formatDate(item.occurredAt)}</em>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="cq-command-section" aria-labelledby="settings-heading">
              <div className="cq-command-section-head">
                <h2 id="settings-heading">Profile Settings</h2>
                <Lock size={18} />
              </div>

              {(() => {
                const pathDone = hasValidStartingPath(data.player);
                const avatarDone = hasValidAvatar(data.player);
                const identityComplete = pathDone && avatarDone;
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
                        <span className="cq-identity-status-item">{pathDone ? '✓' : '○'} Choose your district</span>
                        <span className="cq-identity-status-item">{avatarDone ? '✓' : '○'} Select your player image</span>
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
                  <span>Starting Path</span>
                  <select value={selectedStartingPath} onChange={(event) => setSelectedStartingPath(event.target.value as StartingPath)}>
                    {pathOptions.map((path) => (
                      <option key={path.value} value={path.value}>{path.label} • {path.district}</option>
                    ))}
                  </select>
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
                    <p className="cq-avatar-active-note">Custom photo selected — your active avatar. Save Command Center to apply it everywhere.</p>
                  )}
                </div>
              </div>

              <button type="submit" disabled={saving} className="cq-save-command">
                <Save size={18} />
                <span>{saving ? 'Saving...' : 'Save Command Center'}</span>
              </button>
            </section>
          </form>
        )}
      </main>
      <CinematicFooter />
    </div>
  );
}
