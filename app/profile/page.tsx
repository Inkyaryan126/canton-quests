'use client';

import React, { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Compass,
  Eye,
  EyeOff,
  ImagePlus,
  Lock,
  Map,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  Upload,
  User,
  Zap,
  LogOut,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';
import { Achievement, Player, PlayerAchievement, Quest, StartingPath } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  PLAYER_AVATAR_PRESETS,
  PLAYER_CARD_BADGE_SLOT_COUNT,
  getAvatarPresetPath,
} from '@/lib/player-command-center';

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
  const [profileVisibility, setProfileVisibility] = useState<'public' | 'private'>('public');
  const [playerImageVisibility, setPlayerImageVisibility] = useState<'public' | 'private'>('private');
  const [cropZoom, setCropZoom] = useState(1);
  const [cropX, setCropX] = useState(50);
  const [cropY, setCropY] = useState(50);
  const [featuredBadgeSlugs, setFeaturedBadgeSlugs] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);

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
      setAvatarPresetKey(nextData.player.avatarPresetKey || '1');
      setSelectedStartingPath(nextData.player.selectedStartingPath || 'family');
      setProfileVisibility(nextData.player.profileVisibility || 'public');
      setPlayerImageVisibility(nextData.player.playerImageVisibility || 'private');
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

  const avatarImage = pendingPreviewUrl || data?.player.profileImageUrl || getAvatarPresetPath(avatarPresetKey);
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
          avatarUrl: getAvatarPresetPath(avatarPresetKey),
          selectedStartingPath,
          profileVisibility,
          playerImageVisibility,
          profileImageCropZoom: cropZoom,
          profileImageCropX: cropX,
          profileImageCropY: cropY,
          featuredBadgeSlugs,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Profile save failed.');
      setMessage({ type: 'success', text: 'Command Center profile saved.' });
      await loadCommandCenter();
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Profile save failed.') });
    } finally {
      setSaving(false);
    }
  };

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(file);
    setPendingPreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const uploadPhoto = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.set('file', pendingFile);
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
      setPendingFile(null);
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
      setPendingPreviewUrl(null);
      setMessage({ type: 'success', text: 'Player image uploaded.' });
      await loadCommandCenter();
    } catch (error) {
      setMessage({ type: 'error', text: getErrorMessage(error, 'Upload failed.') });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    setUploading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/player/profile-image', { method: 'DELETE', headers: authHeaders() });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'Remove failed.');
      setMessage({ type: 'success', text: 'Custom player image removed.' });
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
    <div className="min-h-screen bg-[#080b10] text-stone-100 flex flex-col font-body antialiased">
      <CinematicNav eventHref="/events/canton-weekend-1" />
      <main className="cq-command-shell">
        <div className="cq-command-hero">
          <div>
            <p className="cq-command-eyebrow">Authenticated Player Command Center</p>
            <h1>{data?.player.displayName || 'Canton Agent'}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/quests" className="cq-command-primary-link">
              <Compass size={18} />
              <span>All Quests</span>
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 hover:text-red-400 font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md"
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
              <div className="cq-player-card-wrap">
                <Image
                  src="/canton-quests/player_card.png"
                  alt=""
                  fill
                  priority
                  sizes="(max-width: 640px) 96vw, 420px"
                  className="cq-player-card-art"
                />
                <div
                  className="cq-card-photo"
                  style={{
                    backgroundImage: `url(${avatarImage})`,
                    backgroundSize: `${cropZoom * 100}%`,
                    backgroundPosition: `${cropX}% ${cropY}%`,
                  }}
                  role="img"
                  aria-label={`${displayName || 'Player'} avatar preview`}
                />
                <div className="cq-card-callsign">{displayName || 'Canton Agent'}</div>
                <div className="cq-card-path">{data.startingDistrict.label}</div>
                <div className="cq-card-district">{data.startingDistrict.district}</div>
                <div className="cq-card-stat cq-card-xp">{data.stats.totalXp}</div>
                <div className="cq-card-stat cq-card-rank">{data.stats.cityRank ? `#${data.stats.cityRank}` : 'Unranked'}</div>
                <div className="cq-card-stat cq-card-completed">{data.stats.completedQuests}</div>
                <div className="cq-card-stat cq-card-entries">{data.stats.prizeEntries}</div>
                <div className="cq-card-member">Since {formatDate(data.player.createdAt)}</div>
                <div className="cq-card-badges">
                  {Array.from({ length: data.badges.maxFeatured }).map((_, index) => {
                    const badge = featuredBadges[index];
                    return (
                      <div key={index} className="cq-card-badge-slot">
                        {badge && <Image src={badge.iconPath} alt={badge.name} width={42} height={42} />}
                      </div>
                    );
                  })}
                </div>
              </div>
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
                ['Prize Entries', data.stats.prizeEntries],
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
                <h2 id="settings-heading">Profile / Privacy Settings</h2>
                <Lock size={18} />
              </div>
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
                <label>
                  <span>Profile Visibility</span>
                  <select value={profileVisibility} onChange={(event) => setProfileVisibility(event.target.value as 'public' | 'private')}>
                    <option value="public">Public</option>
                    <option value="private">Private</option>
                  </select>
                </label>
                <label>
                  <span>Player Image Visibility</span>
                  <select value={playerImageVisibility} onChange={(event) => setPlayerImageVisibility(event.target.value as 'public' | 'private')}>
                    <option value="private">Hide my player image publicly</option>
                    <option value="public">Show my player image publicly</option>
                  </select>
                </label>
              </div>

              <div className="cq-avatar-controls">
                <div>
                  <h3><User size={16} /> CQ Avatar Presets</h3>
                  <div className="cq-avatar-grid">
                    {PLAYER_AVATAR_PRESETS.map((key) => (
                      <button
                        type="button"
                        key={key}
                        onClick={() => setAvatarPresetKey(key)}
                        className={avatarPresetKey === key ? 'is-selected' : ''}
                        aria-label={`Select CQ avatar ${key}`}
                      >
                        <Image src={`/canton-quests/${key}.png`} alt="" width={58} height={58} />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <h3><Camera size={16} /> Custom Player Image</h3>
                  <label className="cq-file-picker">
                    <ImagePlus size={18} />
                    <span>{pendingFile ? pendingFile.name : 'Choose image'}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseFile} />
                  </label>
                  <div className="cq-range-grid">
                    <label><span>Zoom</span><input type="range" min="1" max="3" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} /></label>
                    <label><span>Horizontal</span><input type="range" min="0" max="100" value={cropX} onChange={(event) => setCropX(Number(event.target.value))} /></label>
                    <label><span>Vertical</span><input type="range" min="0" max="100" value={cropY} onChange={(event) => setCropY(Number(event.target.value))} /></label>
                  </div>
                  <div className="cq-button-row">
                    <button type="button" onClick={uploadPhoto} disabled={!pendingFile || uploading}><Upload size={16} />Upload</button>
                    <button type="button" onClick={removePhoto} disabled={uploading || !data.player.profileImagePath}><RotateCcw size={16} />Remove</button>
                  </div>
                </div>
              </div>

              <div className="cq-privacy-note">
                {profileVisibility === 'private' || playerImageVisibility === 'private' ? <EyeOff size={16} /> : <Eye size={16} />}
                <span>The authenticated owner can always see this card. Public image exposure follows these privacy controls.</span>
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
