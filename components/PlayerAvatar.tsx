'use client';

import React, { useEffect, useState } from 'react';
import { getAvatarCropStyle, isImageAvatarUrl } from '@/lib/avatar-crop';

export interface PlayerAvatarProps {
  avatarUrl?: string | null;
  cropZoom?: number | null;
  cropX?: number | null;
  cropY?: number | null;
  size: number;
  className?: string;
  style?: React.CSSProperties;
  fallback?: React.ReactNode;
  ariaLabel?: string;
}

/**
 * Canonical avatar renderer. Any surface that shows a player's photo
 * (nav bar, PlayerCard, command center previews, leaderboard, etc.) should
 * render through this component so the crop math only lives in one place.
 *
 * A hidden probe <img> detects load failures (private/removed custom photo,
 * network error) and falls back to the initials/emoji fallback instead of
 * showing a broken image — this matters most on surfaces like the
 * leaderboard, which can render another player's avatar whose
 * playerImageVisibility is 'private' and whose /api/player/{id}/avatar
 * route will 403 for non-owners.
 */
export default function PlayerAvatar({
  avatarUrl,
  cropZoom,
  cropX,
  cropY,
  size,
  className = '',
  style,
  fallback = '⚡',
  ariaLabel = 'Player avatar',
}: PlayerAvatarProps) {
  const trimmed = avatarUrl?.trim();
  const isImage = isImageAvatarUrl(trimmed);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
    if (!isImage || !trimmed) return;
    const probe = new Image();
    probe.onerror = () => setLoadFailed(true);
    probe.src = trimmed;
    return () => {
      probe.onerror = null;
    };
  }, [trimmed, isImage]);

  if (!isImage || loadFailed) {
    return (
      <span
        className={className}
        role="img"
        aria-label={ariaLabel}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          ...style,
        }}
      >
        {!isImage && trimmed ? trimmed : fallback}
      </span>
    );
  }

  return (
    <div
      className={className}
      role="img"
      aria-label={ariaLabel}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: '50%',
        backgroundImage: `url(${trimmed})`,
        ...getAvatarCropStyle(cropZoom, cropX, cropY),
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
