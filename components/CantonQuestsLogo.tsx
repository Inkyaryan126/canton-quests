import Image from 'next/image';
import { cqBrand } from '@/lib/marketing-assets';

export interface CantonQuestsLogoProps {
  /**
   * 'full': Complete official master lockup with CQ compass emblem and Canton Quests typography.
   * 'mark': Central interlocking CQ compass emblem mark only (ideal for icons, tight headers, mobile marks, stamps).
   */
  variant?: 'full' | 'mark';
  /**
   * Shorthand square dimension in pixels. Sets both width and height.
   */
  size?: number;
  width?: number;
  height?: number;
  priority?: boolean;
  className?: string;
  alt?: string;
}

/**
 * CantonQuestsLogo
 * Canonical Canton Quests Brand Identity Component.
 *
 * Master Asset: /brand/canton-quests-master-logo.png
 * Deterministic Mark Crop: /brand/canton-quests-mark.png
 */
export default function CantonQuestsLogo({
  variant = 'full',
  size,
  width,
  height,
  priority = false,
  className = '',
  alt,
}: CantonQuestsLogoProps) {
  const isMark = variant === 'mark';
  const defaultSize = isMark ? 40 : 160;
  const finalWidth = width ?? size ?? defaultSize;
  const finalHeight = height ?? size ?? defaultSize;
  const defaultAlt = isMark ? 'Canton Quests emblem' : 'Canton Quests official logo';
  const src = isMark ? cqBrand.mark : cqBrand.masterLogo;

  return (
    <Image
      src={src}
      alt={alt ?? defaultAlt}
      width={finalWidth}
      height={finalHeight}
      priority={priority}
      className={`object-contain ${className}`.trim()}
    />
  );
}
