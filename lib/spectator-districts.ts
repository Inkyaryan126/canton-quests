/**
 * Canton Quests — Authoritative District Configuration & Scoping
 * =============================================================
 * Single source of truth for spectator district activity across all Operations.
 *
 * CANONICAL FOUNDER'S CIPHER STRUCTURE:
 * Exactly THREE player districts matching canonical player starting paths:
 *   1. FAMILY   => Arts District / downtown Canton family-sector locations
 *   2. CHALLENGE=> Mother Goose Land / 9th Street challenge-sector locations
 *   3. SECRET   => Monument Park / McKinley / secret-sector locations
 *
 * NOTE: West Lawn is the POST-MASTER-CIPHER final objective destination.
 * It is NEVER a fourth player district.
 *
 * FAIR QR HUNT STRUCTURE:
 * The 4 Stark County Fairgrounds zones (Grandstand, Midway, Exhibition, Food Row).
 *
 * FUTURE OPERATIONS:
 * Do not inherit Founder's Cipher-specific district data unless configured.
 */

import { isKnownCantonLaunchSlug } from './launch-status';

export type DistrictActivityLevel = 'HIGH' | 'MODERATE' | 'QUIET' | 'NO ACTIVITY';

export interface DistrictInfo {
  id: string;
  name: string;
  landmark: string;
  activityLevel: DistrictActivityLevel;
  agentCount: number;
  activeQuestsCount: number;
  path?: 'family' | 'challenge' | 'secret';
}

export type DistrictActivity = DistrictInfo;

export interface DistrictConfig {
  id: string;
  name: string;
  path: 'family' | 'challenge' | 'secret';
  landmark: string;
  keywords: string[];
  color: string;
}

export const FOUNDER_CIPHER_CANONICAL_DISTRICTS: DistrictConfig[] = [
  {
    id: 'dist-family',
    name: 'Family (Arts District)',
    path: 'family',
    landmark: 'Centennial Plaza & Downtown Arts Corridor',
    color: '#f59e0b',
    keywords: ['family', 'arts', 'centennial', 'palace', 'mural', 'onesto', 'aura', 'downtown'],
  },
  {
    id: 'dist-challenge',
    name: 'Challenge (Mother Goose Land)',
    path: 'challenge',
    landmark: 'Mother Goose Land & 9th St Skate Park',
    color: '#ef4444',
    keywords: ['challenge', 'mother goose', 'skate', '9th st', '9th street', 'athletic', 'speed', 'sprint', 'southside'],
  },
  {
    id: 'dist-secret',
    name: 'Secret (Monument Park)',
    path: 'secret',
    landmark: 'McKinley National Memorial & Monument Park',
    color: '#a855f7',
    keywords: ['secret', 'monument', 'mckinley', 'cipher', 'stone stair', 'fragment'],
  },
];

export const FAIR_QR_HUNT_DISTRICT_CONFIGS = [
  {
    id: 'dist-grandstand',
    name: 'Grandstand & Track Area',
    landmark: 'Grandstand Arena & Track Perimeter',
    color: '#ff3b3b',
    keywords: ['grandstand', 'track', 'arena'],
  },
  {
    id: 'dist-midway',
    name: 'Midway & Carnival Plaza',
    landmark: 'Central Rides & Carnival Plaza',
    color: '#ffcf3f',
    keywords: ['midway', 'carnival', 'rides', 'plaza'],
  },
  {
    id: 'dist-exhibition',
    name: 'Exhibition & Agri Pavilion',
    landmark: 'Livestock Barns & Exhibition Pavilion',
    color: '#00f0ff',
    keywords: ['exhibition', 'agri', 'pavilion', 'barns'],
  },
  {
    id: 'dist-food-row',
    name: 'South Gate & Food Row',
    landmark: 'Fair Concessions & South Gate Food Row',
    color: '#10b981',
    keywords: ['food', 'south gate', 'concessions'],
  },
];

export function isFairOperation(eventIdOrSlug?: string | null): boolean {
  if (!eventIdOrSlug) return false;
  const lower = eventIdOrSlug.trim().toLowerCase();
  return lower.includes('fair') || lower === 'fair-qr-hunt';
}

export function isFounderCipherOperation(eventIdOrSlug?: string | null): boolean {
  if (!eventIdOrSlug) return true; // Default event in spectator is Founder's Cipher
  if (isFairOperation(eventIdOrSlug)) return false;
  const normalized = eventIdOrSlug.trim().toLowerCase();
  if (
    normalized === 'default-event' ||
    normalized === 'canton-weekend-1' ||
    normalized === 'evt-canton-vol-1' ||
    normalized === 'b0000001-0000-4000-8000-000000000001' ||
    normalized.startsWith('evt-') ||
    normalized.startsWith('test-') ||
    normalized.includes('cipher') ||
    normalized.includes('district') ||
    normalized.includes('weekend') ||
    normalized.includes('canton') ||
    normalized.includes('launch') ||
    normalized.includes('vol')
  ) {
    return true;
  }
  return isKnownCantonLaunchSlug(normalized);
}

export function getDefaultDistrictsForEvent(eventIdOrSlug?: string | null): DistrictInfo[] {
  if (isFounderCipherOperation(eventIdOrSlug)) {
    return FOUNDER_CIPHER_CANONICAL_DISTRICTS.map((d) => ({
      id: d.id,
      name: d.name,
      landmark: d.landmark,
      activityLevel: 'NO ACTIVITY' as DistrictActivityLevel,
      agentCount: 0,
      activeQuestsCount: 0,
      path: d.path,
    }));
  }

  if (isFairOperation(eventIdOrSlug)) {
    return FAIR_QR_HUNT_DISTRICT_CONFIGS.map((d) => ({
      id: d.id,
      name: d.name,
      landmark: d.landmark,
      activityLevel: 'NO ACTIVITY' as DistrictActivityLevel,
      agentCount: 0,
      activeQuestsCount: 0,
    }));
  }

  // Future unconfigured Operation
  return [];
}
