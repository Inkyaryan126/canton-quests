import type { CSSProperties } from 'react';

export const AVATAR_CROP_ZOOM_MIN = 1;
export const AVATAR_CROP_ZOOM_MAX = 3;
export const AVATAR_CROP_AXIS_MIN = 0;
export const AVATAR_CROP_AXIS_MAX = 100;
export const DEFAULT_AVATAR_CROP = { zoom: 1, x: 50, y: 50 } as const;

export function clampAvatarCropZoom(zoom?: number | null): number {
  const value = Number(zoom);
  if (!Number.isFinite(value)) return DEFAULT_AVATAR_CROP.zoom;
  return Math.min(AVATAR_CROP_ZOOM_MAX, Math.max(AVATAR_CROP_ZOOM_MIN, value));
}

export function clampAvatarCropAxis(axis?: number | null): number {
  const value = Number(axis);
  if (!Number.isFinite(value)) return DEFAULT_AVATAR_CROP.x;
  return Math.min(AVATAR_CROP_AXIS_MAX, Math.max(AVATAR_CROP_AXIS_MIN, value));
}

/**
 * The single source of truth for turning stored crop values into the CSS
 * background-position/size pair. Every place that renders a player's custom
 * photo (the live editor preview, PlayerCard, nav, etc.) must derive its
 * crop from this function so the saved avatar renders identically everywhere.
 */
export function getAvatarCropStyle(zoom?: number | null, x?: number | null, y?: number | null): CSSProperties {
  const safeZoom = clampAvatarCropZoom(zoom);
  const safeX = clampAvatarCropAxis(x);
  const safeY = clampAvatarCropAxis(y);
  const zoomPercent = Math.round(safeZoom * 10000) / 100;
  return {
    backgroundSize: `${zoomPercent}%`,
    backgroundPosition: `${safeX}% ${safeY}%`,
    backgroundRepeat: 'no-repeat',
  };
}

/**
 * True when an avatarUrl string is renderable as an actual image (a path,
 * absolute URL, or data URI) rather than an emoji/text fallback.
 */
export function isImageAvatarUrl(avatarUrl?: string | null): boolean {
  if (!avatarUrl) return false;
  const trimmed = avatarUrl.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    /\.(png|jpe?g|webp|svg|gif)($|\?)/i.test(trimmed)
  );
}
