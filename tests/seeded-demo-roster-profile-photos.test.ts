import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  resolveAvatarUrl,
  hasValidAvatar,
  isProfileIdentityComplete,
  CUSTOM_AVATAR_KEY,
} from '../lib/player-command-center';
import { getAvatarCropStyle, isImageAvatarUrl } from '../lib/avatar-crop';
import { getPlayerRosterDB } from '../lib/supabase-db';
import { Player } from '../lib/types';
import { setCurrentPlayer, initializeGameEngine } from '../lib/game-engine';

const DEMO_PLAYERS_DATA = [
  {
    displayName: 'RavenNorth',
    cropZoom: 1.0,
    cropX: 50,
    cropY: 50,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...RavenFace',
  },
  {
    displayName: 'NikoCanton',
    cropZoom: 1.08,
    cropX: 51,
    cropY: 49,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...NikoFace',
  },
  {
    displayName: 'AshCoded',
    cropZoom: 1.12,
    cropX: 52,
    cropY: 48,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...AshFace',
  },
  {
    displayName: 'MasonR',
    cropZoom: 1.18,
    cropX: 50,
    cropY: 48,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...MasonFace',
  },
  {
    displayName: 'BreeNorthside',
    cropZoom: 1.25,
    cropX: 49,
    cropY: 46,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...BreeFace',
  },
  {
    displayName: 'KJ_330',
    cropZoom: 1.28,
    cropX: 50,
    cropY: 47,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...KJFace',
  },
  {
    displayName: 'ToriTracks',
    cropZoom: 1.32,
    cropX: 48,
    cropY: 47,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...ToriFace',
  },
  {
    displayName: 'JayceOnFoot',
    cropZoom: 1.4,
    cropX: 50,
    cropY: 45,
    avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBD...JayceFace',
  },
];

describe('Seeded Demo Roster Profile Photos Regression Suite', () => {
  it('1. RavenNorth resolves a custom face instead of preset', () => {
    const raven: Pick<Player, 'id' | 'displayName' | 'avatarUrl' | 'acquisitionSource' | 'profileImagePath' | 'avatarPresetKey'> = {
      id: 'plr-demo-raven',
      displayName: 'RavenNorth',
      avatarUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...ravenface',
      acquisitionSource: 'seeded_demo',
      profileImagePath: null,
      avatarPresetKey: undefined,
    };

    const resolved = resolveAvatarUrl(raven);
    expect(resolved).toBe(raven.avatarUrl);
    expect(resolved).not.toBe('/canton-quests/1.png');
    expect(resolved.startsWith('data:image/')).toBe(true);
  });

  it('2. seeded_demo data:image avatar is allowed on public roster', () => {
    const seededPlayer = {
      id: 'plr-demo-test',
      displayName: 'DemoPlayer',
      avatarUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...',
      acquisitionSource: 'seeded_demo',
      profileImagePath: null,
    };

    const resolved = resolveAvatarUrl(seededPlayer);
    expect(resolved).toBe(seededPlayer.avatarUrl);
    expect(isImageAvatarUrl(resolved)).toBe(true);
    expect(hasValidAvatar(seededPlayer)).toBe(true);
    expect(isProfileIdentityComplete(seededPlayer)).toBe(true);
  });

  it('3. normal real user data:image injection is NOT automatically allowed', () => {
    const attacker1 = {
      id: 'plr-attacker-1',
      displayName: 'AttackerOne',
      avatarUrl: 'data:image/jpeg;base64,injectedFaceData',
      acquisitionSource: 'main_site',
      profileImagePath: null,
      avatarPresetKey: '3',
    };

    const attacker2 = {
      id: 'plr-attacker-2',
      displayName: 'AttackerTwo',
      avatarUrl: 'data:image/jpeg;base64,injectedFaceData',
      acquisitionSource: 'family_flyer',
      profileImagePath: null,
      avatarPresetKey: undefined,
    };

    const attacker3 = {
      id: 'plr-attacker-3',
      displayName: 'AttackerThree',
      avatarUrl: 'data:image/jpeg;base64,injectedFaceData',
      acquisitionSource: undefined,
      profileImagePath: null,
      avatarPresetKey: '5',
    };

    expect(resolveAvatarUrl(attacker1)).toBe('/canton-quests/3.png');
    expect(resolveAvatarUrl(attacker2)).toBe('/canton-quests/1.png');
    expect(resolveAvatarUrl(attacker3)).toBe('/canton-quests/5.png');

    // Ensure hasValidAvatar does not validate real user unauthenticated data URIs without an upload or preset
    expect(hasValidAvatar({ ...attacker2, avatarPresetKey: undefined })).toBe(false);
  });

  it('4. real custom profile photo flow remains unchanged and takes top priority', () => {
    // Normal real user with an uploaded custom photo in private storage bucket
    const realUserWithUpload = {
      id: 'plr-real-001',
      displayName: 'RealExplorer',
      avatarPresetKey: CUSTOM_AVATAR_KEY,
      profileImagePath: 'plr-real-001/1788288000000.jpg',
      acquisitionSource: 'main_site',
    };

    expect(resolveAvatarUrl(realUserWithUpload)).toBe('/api/player/plr-real-001/avatar');

    // If a seeded demo player also has an actual custom upload, the upload takes precedence
    const demoWithUploadedPhoto = {
      id: 'plr-demo-uploaded',
      displayName: 'DemoWithUpload',
      avatarPresetKey: CUSTOM_AVATAR_KEY,
      profileImagePath: 'plr-demo-uploaded/1788288000000.jpg',
      avatarUrl: 'data:image/jpeg;base64,fallbackData',
      acquisitionSource: 'seeded_demo',
    };

    expect(resolveAvatarUrl(demoWithUploadedPhoto)).toBe('/api/player/plr-demo-uploaded/avatar');
  });

  it('5. preset fallback still works', () => {
    expect(resolveAvatarUrl({ id: 'p1', avatarPresetKey: '1', profileImagePath: null })).toBe('/canton-quests/1.png');
    expect(resolveAvatarUrl({ id: 'p2', avatarPresetKey: '4', profileImagePath: null })).toBe('/canton-quests/4.png');
    expect(resolveAvatarUrl({ id: 'p3', avatarPresetKey: '8', profileImagePath: null })).toBe('/canton-quests/8.png');
    expect(resolveAvatarUrl({ id: 'p4', avatarPresetKey: undefined, profileImagePath: null })).toBe('/canton-quests/1.png');
    expect(resolveAvatarUrl({ id: 'p5', avatarPresetKey: 'invalid', profileImagePath: null })).toBe('/canton-quests/1.png');
  });

  it('6. crop zoom/X/Y are applied with identical CSS math', () => {
    for (const player of DEMO_PLAYERS_DATA) {
      const style = getAvatarCropStyle(player.cropZoom, player.cropX, player.cropY);
      const expectedZoomPercent = Math.round(player.cropZoom * 10000) / 100;
      expect(style.backgroundSize).toBe(`${expectedZoomPercent}%`);
      expect(style.backgroundPosition).toBe(`${player.cropX}% ${player.cropY}%`);
      expect(style.backgroundRepeat).toBe('no-repeat');
    }

    // Specific calibrations for all 8 players
    expect(getAvatarCropStyle(1.0, 50, 50)).toEqual({ backgroundSize: '100%', backgroundPosition: '50% 50%', backgroundRepeat: 'no-repeat' });
    expect(getAvatarCropStyle(1.08, 51, 49)).toEqual({ backgroundSize: '108%', backgroundPosition: '51% 49%', backgroundRepeat: 'no-repeat' });
    expect(getAvatarCropStyle(1.12, 52, 48)).toEqual({ backgroundSize: '112%', backgroundPosition: '52% 48%', backgroundRepeat: 'no-repeat' });
    expect(getAvatarCropStyle(1.18, 50, 48)).toEqual({ backgroundSize: '118%', backgroundPosition: '50% 48%', backgroundRepeat: 'no-repeat' });
    expect(getAvatarCropStyle(1.25, 49, 46)).toEqual({ backgroundSize: '125%', backgroundPosition: '49% 46%', backgroundRepeat: 'no-repeat' });
    expect(getAvatarCropStyle(1.28, 50, 47)).toEqual({ backgroundSize: '128%', backgroundPosition: '50% 47%', backgroundRepeat: 'no-repeat' });
    expect(getAvatarCropStyle(1.32, 48, 47)).toEqual({ backgroundSize: '132%', backgroundPosition: '48% 47%', backgroundRepeat: 'no-repeat' });
    expect(getAvatarCropStyle(1.4, 50, 45)).toEqual({ backgroundSize: '140%', backgroundPosition: '50% 45%', backgroundRepeat: 'no-repeat' });
  });

  it('7. no email/user_id/profile_image_path leaks in public roster payload or types', async () => {
    const dbSource = fs.readFileSync(path.join(process.cwd(), 'lib/supabase-db.ts'), 'utf8');
    const typesSource = fs.readFileSync(path.join(process.cwd(), 'lib/types.ts'), 'utf8');

    // Verify PublicRosterEntry interface does not have email, userId, profileImagePath
    expect(typesSource).toContain('export interface PublicRosterEntry {');
    const publicRosterEntryStart = typesSource.indexOf('export interface PublicRosterEntry {');
    const publicRosterEntryEnd = typesSource.indexOf('}', publicRosterEntryStart);
    const publicRosterEntryDef = typesSource.slice(publicRosterEntryStart, publicRosterEntryEnd);

    expect(publicRosterEntryDef).not.toContain('email');
    expect(publicRosterEntryDef).not.toContain('userId');
    expect(publicRosterEntryDef).not.toContain('user_id');
    expect(publicRosterEntryDef).not.toContain('profileImagePath');
    expect(publicRosterEntryDef).not.toContain('profile_image_path');

    // Verify getPlayerRosterDB does not expose email or user_id or raw storage paths in the returned map
    const getPlayerRosterDBStart = dbSource.indexOf('export async function getPlayerRosterDB');
    const getPlayerRosterDBEnd = dbSource.indexOf('export async function getLeaderboardDB', getPlayerRosterDBStart);
    const getPlayerRosterDBSrc = dbSource.slice(getPlayerRosterDBStart, getPlayerRosterDBEnd);

    // Ensure email / user_id are not selected or returned
    expect(getPlayerRosterDBSrc).not.toContain('email');
    expect(getPlayerRosterDBSrc).not.toContain('user_id');
    expect(getPlayerRosterDBSrc).not.toContain('userId');

    // Verify local DB and Supabase DB calls return clean PublicRosterEntry objects
    const roster = await getPlayerRosterDB();
    expect(Array.isArray(roster)).toBe(true);
    for (const entry of roster) {
      expect((entry as any).email).toBeUndefined();
      expect((entry as any).userId).toBeUndefined();
      expect((entry as any).user_id).toBeUndefined();
      expect((entry as any).profileImagePath).toBeUndefined();
      expect((entry as any).profile_image_path).toBeUndefined();
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.displayName).toBe('string');
      expect(typeof entry.avatarUrl).toBe('string');
    }
  });

  it('8. all eight affected demo players resolve face images', () => {
    for (const item of DEMO_PLAYERS_DATA) {
      const demoPlayer: Pick<Player, 'id' | 'displayName' | 'avatarUrl' | 'acquisitionSource' | 'profileImagePath' | 'avatarPresetKey'> = {
        id: `plr-demo-${item.displayName.toLowerCase()}`,
        displayName: item.displayName,
        avatarUrl: item.avatarUrl,
        acquisitionSource: 'seeded_demo',
        profileImagePath: null,
      };

      const resolved = resolveAvatarUrl(demoPlayer);
      expect(resolved).toBe(item.avatarUrl);
      expect(resolved.startsWith('data:image/')).toBe(true);
      expect(isImageAvatarUrl(resolved)).toBe(true);
    }
  });

  it('9. roster still displays all players and handles searching', async () => {
    initializeGameEngine();
    const testPlayer = setCurrentPlayer(`RosterAgent_${Date.now()}`, '⚡');

    const fullRoster = await getPlayerRosterDB();
    expect(fullRoster.length).toBeGreaterThan(0);
    const found = fullRoster.find((p) => p.id === testPlayer.id || p.displayName === testPlayer.displayName);
    expect(found).toBeDefined();

    // Search filter works
    const searchedRoster = await getPlayerRosterDB(testPlayer.displayName);
    expect(searchedRoster.length).toBeGreaterThanOrEqual(1);
    expect(searchedRoster.some((p) => p.displayName.includes(testPlayer.displayName))).toBe(true);
  });
});
