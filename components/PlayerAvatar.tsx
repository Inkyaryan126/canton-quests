'use client';

import React, { useState } from 'react';

export interface PlayerAvatarProps {
  avatarUrl?: string | null;
  displayName?: string | null;
  size?: number | 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  borderColor?: string;
  showRing?: boolean;
}

/**
 * Determines whether the avatarUrl string represents an image file/URL
 * or a raw emoji/character fallback.
 */
export function isImageAvatar(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.includes('.png') ||
    trimmed.includes('.jpg') ||
    trimmed.includes('.jpeg') ||
    trimmed.includes('.webp') ||
    trimmed.includes('.svg')
  );
}

const SIZE_MAP: Record<string, { container: string; text: string; px: number }> = {
  xs: { container: 'w-6 h-6', text: 'text-[11px]', px: 24 },
  sm: { container: 'w-8 h-8', text: 'text-sm', px: 32 },
  md: { container: 'w-10 h-10', text: 'text-base', px: 40 },
  lg: { container: 'w-12 h-12', text: 'text-xl', px: 48 },
  xl: { container: 'w-16 h-16', text: 'text-3xl', px: 64 },
};

export default function PlayerAvatar({
  avatarUrl,
  displayName,
  size = 'sm',
  className = '',
  borderColor,
  showRing = true,
}: PlayerAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const isImage = isImageAvatar(avatarUrl) && !imgError;
  const cleanName = (displayName || 'Agent').trim();
  const altText = `${cleanName}'s avatar`;

  const sizeMeta = typeof size === 'number'
    ? { container: '', text: size > 40 ? 'text-2xl' : 'text-sm', px: size }
    : SIZE_MAP[size] || SIZE_MAP.sm;

  const customStyle: React.CSSProperties = typeof size === 'number'
    ? { width: `${size}px`, height: `${size}px` }
    : {};

  if (borderColor) {
    customStyle.borderColor = borderColor;
  }

  const ringClasses = showRing
    ? 'ring-1 ring-amber-400/30 border border-stone-800/80 shadow-md shadow-black/40'
    : '';

  return (
    <div
      className={`relative rounded-full overflow-hidden shrink-0 bg-stone-900 flex items-center justify-center select-none ${sizeMeta.container} ${ringClasses} ${className}`}
      style={customStyle}
      aria-label={altText}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl!.trim()}
          alt={altText}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover rounded-full"
          loading="eager"
        />
      ) : (
        <span className={`font-mono font-bold leading-none select-none text-amber-300 ${sizeMeta.text}`}>
          {avatarUrl && avatarUrl.trim() && !isImageAvatar(avatarUrl)
            ? avatarUrl.trim()
            : (cleanName.slice(0, 2).toUpperCase() || '⚡')}
        </span>
      )}
    </div>
  );
}
