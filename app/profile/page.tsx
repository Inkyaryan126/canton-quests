'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Compass,
  Crown,
  Edit3,
  HelpCircle,
  KeyRound,
  Lock,
  Palette,
  Save,
  Shield,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Zap,
} from 'lucide-react';
import CinematicNav from '@/components/CinematicNav';
import CinematicFooter from '@/components/CinematicFooter';
import { Player, PlayerAchievement, Achievement, StartingPath } from '@/lib/types';
import { SEED_ACHIEVEMENTS } from '@/lib/seed-data';
import { cqImages } from '@/lib/marketing-assets';
import { showGameMoment } from '@/lib/game-effects';

const AVATAR_OPTIONS = ['⚡', '🧭', '🔍', '🏆', '🎯', '🦅', '👾', '🔥', '⚔️', '🦁', '🌟', '🚀'];
const FLAIR_OPTIONS = [
  'Canton Pioneer',
  'Cipher Hound',
  'Speed Runner',
  'Arts Detective',
  'Street Legend',
  'Night Stalker',
  'Master Explorer',
  'Day 1 Veteran',
];
const PLAY_STYLES = [
  'Casual Landmark Walking',
  'Speed & Kinetic Challenge',
  'Cryptic Mystery & Ciphers',
  'Arts & Cultural Exploration',
  'Leaderboard Domination',
];
const THEME_COLORS = [
  { name: 'Amber Gold', hex: '#f59e0b' },
  { name: 'Challenge Red', hex: '#ef4444' },
  { name: 'Mystery Violet', hex: '#a855f7' },
  { name: 'Cyber Cyan', hex: '#06b6d4' },
  { name: 'Emerald Forest', hex: '#10b981' },
];

export default function ProfilePage() {
  const [player, setPlayer] = useState<Player | null>(null);
  const [achievements, setAchievements] = useState<PlayerAchievement[]>([]);
  const [allCatalogAchievements, setAllCatalogAchievements] = useState<Achievement[]>(SEED_ACHIEVEMENTS);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('⚡');
  const [selectedStartingPath, setSelectedStartingPath] = useState<StartingPath>('family');
  const [tagline, setTagline] = useState('');
  const [bio, setBio] = useState('');
  const [hometown, setHometown] = useState('');
  const [themeColor, setThemeColor] = useState('#f59e0b');
  const [favoriteStyle, setFavoriteStyle] = useState('');
  const [selectedFlair, setSelectedFlair] = useState('');
  const [isMinor, setIsMinor] = useState(false);

  useEffect(() => {
    const headers: Record<string, string> = {};
    const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('canton_auth_token') : null;
    if (authToken) {
      headers['authorization'] = `Bearer ${authToken}`;
    }

    fetch('/api/auth/me', { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data.isAuthenticated && data.player) {
          initPlayerData(data.player);
        } else {
          // Fallback to local player
          const stored = window.localStorage.getItem('canton_quests_current_player');
          if (stored) {
            initPlayerData(JSON.parse(stored));
          }
        }
        if (data.achievements) {
          setAchievements(data.achievements);
        }
      })
      .catch(() => {
        const stored = window.localStorage.getItem('canton_quests_current_player');
        if (stored) {
          initPlayerData(JSON.parse(stored));
        }
      });
  }, []);

  const initPlayerData = (p: Player) => {
    setPlayer(p);
    setDisplayName(p.displayName || '');
    setAvatarUrl(p.avatarUrl || '⚡');
    setSelectedStartingPath(p.selectedStartingPath || 'family');
    setTagline(p.tagline || '');
    setBio(p.bio || '');
    setHometown(p.hometown || '');
    setThemeColor(p.themeColor || '#f59e0b');
    setFavoriteStyle(p.favoriteStyle || PLAY_STYLES[0]);
    setSelectedFlair(p.selectedFlair || FLAIR_OPTIONS[0]);
    setIsMinor(Boolean(p.isMinor));
  };

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('canton_auth_token');
        window.localStorage.removeItem('canton_quests_current_player');
        window.localStorage.removeItem('canton_player_profile');
      }
      window.location.href = '/';
    } catch {
      window.location.href = '/';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || displayName.trim().length < 2) {
      setStatusMessage({ type: 'error', text: 'Callsign must be at least 2 characters.' });
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authToken = typeof window !== 'undefined' ? window.localStorage.getItem('canton_auth_token') : null;
      if (authToken) {
        headers['authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/player/profile', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          playerId: player?.id,
          displayName: displayName.trim(),
          avatarUrl,
          selectedStartingPath,
          tagline: tagline.trim() || undefined,
          bio: bio.trim() || undefined,
          hometown: hometown.trim() || undefined,
          themeColor,
          favoriteStyle,
          selectedFlair,
          isMinor,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to update profile.');
      }

      setPlayer(data.player);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('canton_quests_current_player', JSON.stringify(data.player));
        window.localStorage.setItem('canton_player_profile', JSON.stringify(data.player));
      }

      setIsEditing(false);
      setStatusMessage({ type: 'success', text: 'Agent Profile updated successfully!' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error updating profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const earnedAchievementSlugs = new Set(achievements.map((a) => a.achievementSlug || a.achievement?.slug));

  const pathBadgeConfig: Record<StartingPath, { label: string; icon: any; color: string; area: string }> = {
    family: { label: 'Family (Arts District)', icon: Compass, color: '#f59e0b', area: 'Arts District' },
    challenge: { label: 'Challenge (Mother Goose Land)', icon: Zap, color: '#ef4444', area: 'Mother Goose Land' },
    secret: { label: 'Secret (Monument Park)', icon: KeyRound, color: '#a855f7', area: 'Monument Park' },
  };

  const currentPathMeta = pathBadgeConfig[selectedStartingPath] || pathBadgeConfig.family;
  const CurrentPathIcon = currentPathMeta.icon;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col font-body antialiased">
      <CinematicNav eventHref="/events/canton-weekend-1" />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8">
        {/* Back Link & Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link
            href="/quests"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-stone-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Back to Live Quests</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-mono text-emerald-400">Agent Network Connected</span>
          </div>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`p-3.5 mb-6 rounded-xl border text-xs font-mono flex items-center gap-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
                : 'bg-red-950/80 border-red-500/50 text-red-300'
            }`}
          >
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <span>⚠️</span>}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* AGENT IDENTITY CARD */}
        <div className="glass-panel p-6 rounded-3xl border border-stone-800 bg-stone-900/90 shadow-2xl mb-8 relative overflow-hidden">
          <Image
            src={cqImages.playerProfileBg}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1000px"
            className="object-cover opacity-15 pointer-events-none"
          />
          <div
            className="absolute top-0 left-0 right-0 h-1.5 z-10"
            style={{ backgroundColor: player?.themeColor || themeColor }}
          />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
            {/* Avatar & Core Bio */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-stone-950 border-2 flex items-center justify-center text-3xl sm:text-4xl shrink-0 shadow-inner"
                style={{ borderColor: player?.themeColor || themeColor }}
              >
                {avatarUrl}
              </div>

              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight">
                    {player?.displayName || 'Canton Agent'}
                  </h1>
                  {player?.selectedFlair && (
                    <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      ★ {player.selectedFlair}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs font-mono">
                  <span className="px-2 py-0.5 rounded bg-stone-800 text-stone-300 border border-stone-700">
                    Level {player?.level || 1}
                  </span>
                  <span className="text-amber-400 font-bold">
                    {player?.totalXp || 0} Total XP
                  </span>
                  <span className="text-stone-400">
                    {achievements.length} Achievements
                  </span>
                </div>

                {player?.tagline && (
                  <p className="text-xs text-stone-300 italic mt-2 font-body">
                    &quot;{player.tagline}&quot;
                  </p>
                )}
              </div>
            </div>

            {/* Edit Profile & Sign Out Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 border border-stone-600 text-white text-xs font-mono font-bold flex items-center gap-2 transition-all shadow-md cursor-pointer"
              >
                <Edit3 size={14} className="text-amber-400" />
                <span>{isEditing ? 'Cancel Edit' : 'Edit Profile'}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-500/40 text-red-300 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Sign out of Canton Quests"
              >
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Starting Path & District Summary Pill */}
          <div className="mt-5 pt-4 border-t border-stone-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="p-1.5 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${currentPathMeta.color}20`, color: currentPathMeta.color }}
              >
                <CurrentPathIcon size={16} />
              </span>
              <div>
                <div className="font-mono font-bold text-white flex items-center gap-1.5">
                  <span>Starting Path: {currentPathMeta.label}</span>
                </div>
                <div className="text-stone-400 text-[11px] font-mono">
                  {currentPathMeta.area}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-stone-400">
              <span className="px-2 py-1 rounded bg-stone-950 border border-stone-800">
                Acquisition: {player?.acquisitionSource || 'main_site'}
              </span>
              <span className="px-2 py-1 rounded bg-stone-950 border border-stone-800">
                Leaderboard: Individual City Grid
              </span>
            </div>
          </div>
        </div>

        {/* PROFILE EDIT FORM (OPTIONAL PERSONALIZATION) */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfile}
            className="glass-panel p-6 rounded-3xl border border-amber-500/40 bg-stone-900/95 shadow-2xl mb-8 space-y-5 animate-fadeIn"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <h2 className="font-display font-black text-lg text-white uppercase tracking-tight flex items-center gap-2">
                <Palette size={18} className="text-amber-400" />
                <span>Customize Agent Profile (Optional)</span>
              </h2>
              <span className="text-xs font-mono text-stone-400">
                Personalization is 100% optional
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Callsign */}
              <div>
                <label className="block text-xs font-mono font-bold text-stone-300 mb-1">
                  Callsign / Display Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  maxLength={30}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-xs font-mono font-bold text-stone-300 mb-1">
                  Player Motto / Tagline
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="e.g. Always looking up. Solver of ciphers."
                  maxLength={60}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Starting Path Choice */}
              <div>
                <label className="block text-xs font-mono font-bold text-stone-300 mb-1">
                  Starting Path District
                </label>
                <select
                  value={selectedStartingPath}
                  onChange={(e) => setSelectedStartingPath(e.target.value as StartingPath)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                >
                  <option value="family">Family (Arts District)</option>
                  <option value="challenge">Challenge (Mother Goose Land)</option>
                  <option value="secret">Secret (Monument Park)</option>
                </select>
                <p className="text-[10px] text-stone-400 mt-1">
                  Paths determine starting recommendations, never restrict which quests you can solve.
                </p>
              </div>

              {/* Title Flair */}
              <div>
                <label className="block text-xs font-mono font-bold text-stone-300 mb-1">
                  Title Flair
                </label>
                <select
                  value={selectedFlair}
                  onChange={(e) => setSelectedFlair(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                >
                  {FLAIR_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Hometown */}
              <div>
                <label className="block text-xs font-mono font-bold text-stone-300 mb-1">
                  Hometown / Area
                </label>
                <input
                  type="text"
                  value={hometown}
                  onChange={(e) => setHometown(e.target.value)}
                  placeholder="e.g. Downtown Canton, North Canton, Massillon"
                  maxLength={40}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Favorite Play Style */}
              <div>
                <label className="block text-xs font-mono font-bold text-stone-300 mb-1">
                  Preferred Play Style
                </label>
                <select
                  value={favoriteStyle}
                  onChange={(e) => setFavoriteStyle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                >
                  {PLAY_STYLES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Avatar Selection */}
            <div>
              <label className="block text-xs font-mono font-bold text-stone-300 mb-1.5">
                Choose Avatar Symbol
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setAvatarUrl(emoji)}
                    className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition-all shrink-0 ${
                      avatarUrl === emoji
                        ? 'border-amber-400 bg-amber-500/20 scale-110 shadow-md'
                        : 'border-stone-800 bg-stone-950 hover:bg-stone-800'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Theme Color Selection */}
            <div>
              <label className="block text-xs font-mono font-bold text-stone-300 mb-1.5">
                Theme Color Accent
              </label>
              <div className="flex items-center gap-3">
                {THEME_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setThemeColor(c.hex)}
                    className={`w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center ${
                      themeColor === c.hex ? 'scale-125 border-white shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={`Select ${c.name}`}
                  />
                ))}
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="block text-xs font-mono font-bold text-stone-300 mb-1">
                Bio / Field Notes
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell fellow Canton explorers about yourself..."
                rows={2}
                maxLength={200}
                className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Minor Toggle */}
            <div className="pt-2 border-t border-stone-800">
              <label className="flex items-center gap-3 cursor-pointer text-xs font-mono text-cyan-300">
                <input
                  type="checkbox"
                  checked={isMinor}
                  onChange={(e) => setIsMinor(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-700 bg-stone-950 text-cyan-400"
                />
                <span>
                  Minor participant designation (under 18) — Applies strict privacy protection on public recap boards.
                </span>
              </label>
            </div>

            {/* Save Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-mono font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-black uppercase tracking-wider flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSaving ? 'Saving...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        )}

        {/* ACHIEVEMENTS SHELF */}
        <section className="relative overflow-hidden p-6 rounded-3xl border border-stone-800 bg-stone-950 mb-8 shadow-2xl" aria-labelledby="achievements-heading">
          <Image
            src={cqImages.achievementBadges}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1000px"
            className="object-cover opacity-10 pointer-events-none"
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 id="achievements-heading" className="font-display font-black text-xl text-white uppercase tracking-tight flex items-center gap-2">
                  <Award size={20} className="text-amber-400" />
                  <span>Achievements Shelf</span>
                </h2>
                <p className="text-xs text-stone-400 font-mono mt-0.5">
                  Unlocked badges for district sweeps, starting path mastery, and speed milestones.
                </p>
              </div>
              <span className="text-xs font-mono px-3 py-1 rounded-full bg-stone-900 border border-stone-700 text-amber-300 font-bold">
                {achievements.length} / {allCatalogAchievements.length} Unlocked
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {allCatalogAchievements.map((ach) => {
                const isEarned = earnedAchievementSlugs.has(ach.slug);
                const playerRecord = achievements.find((a) => a.achievementSlug === ach.slug || a.achievement?.slug === ach.slug);

                const rarityColors: Record<string, string> = {
                  common: 'border-stone-700 text-stone-300',
                  rare: 'border-cyan-500/50 text-cyan-300 bg-cyan-950/20',
                  epic: 'border-purple-500/50 text-purple-300 bg-purple-950/20',
                  legendary: 'border-amber-500/60 text-amber-300 bg-amber-950/30',
                };

                return (
                  <div
                    key={ach.id}
                    onClick={() => {
                      if (isEarned) {
                        showGameMoment({
                          type: 'achievement',
                          achievementId: ach.id,
                          title: ach.name,
                          description: ach.description,
                          icon: ach.badgeSymbol,
                          category: ach.category,
                        });
                      }
                    }}
                    role={isEarned ? 'button' : undefined}
                    tabIndex={isEarned ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isEarned && (e.key === 'Enter' || e.key === ' ')) {
                        showGameMoment({
                          type: 'achievement',
                          achievementId: ach.id,
                          title: ach.name,
                          description: ach.description,
                          icon: ach.badgeSymbol,
                          category: ach.category,
                        });
                      }
                    }}
                    className={`p-4 rounded-2xl border transition-all ${
                      isEarned
                        ? `${rarityColors[ach.rarity] || 'border-amber-500/40 bg-stone-900/90'} shadow-lg cursor-pointer hover:scale-[1.02]`
                        : 'border-stone-800/80 bg-stone-950/50 opacity-60 cursor-default'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-stone-900/90 border border-stone-700 flex items-center justify-center text-xl shrink-0 shadow-inner">
                        {ach.badgeSymbol}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-stone-700 bg-stone-900 text-stone-300">
                          {ach.rarity}
                        </span>
                        {isEarned ? (
                          <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                        ) : (
                          <Lock size={13} className="text-stone-500 shrink-0" />
                        )}
                      </div>
                    </div>

                    <h3 className="font-display font-bold text-sm text-white mb-1">
                      {ach.name}
                    </h3>
                    <p className="text-xs text-stone-300 font-body leading-snug">
                      {ach.description}
                    </p>

                    {isEarned && playerRecord?.earnedAt && (
                      <div className="mt-3 pt-2 border-t border-stone-800/80 text-[10px] font-mono text-emerald-400">
                        ✓ Earned: {new Date(playerRecord.earnedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* PRIZE DRAWING REWARDS TRANSPARENCY CARD */}
        <section className="relative overflow-hidden p-6 sm:p-8 rounded-3xl border border-amber-500/30 bg-stone-950 shadow-2xl" aria-labelledby="prize-info-heading">
          <Image
            src={cqImages.prizeVault}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 1000px"
            className="object-cover opacity-15 pointer-events-none"
          />
          <div className="relative z-10">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="prize-info-heading" className="font-display font-black text-lg text-white uppercase tracking-tight flex items-center gap-2">
                <Trophy size={18} className="text-amber-400" />
                <span>Transparent Prize Drawing Entries</span>
              </h2>
              <Link
                href="/events/canton-weekend-1/drawing"
                className="text-xs font-mono text-amber-400 hover:text-amber-300 underline underline-offset-2 font-bold"
              >
                Public Drawing Ledger →
              </Link>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed font-body">
              Every completed quest gives you <strong>1 entry ticket</strong> into the Sunday night automated drawing. Complete 1 quest = 1 entry. Complete 5 quests = 5 entries. Complete 10 quests = 10 entries. Winners are selected through a deterministic, publicly verifiable algorithm.
            </p>
          </div>
        </section>
      </main>

      <CinematicFooter />
    </div>
  );
}
