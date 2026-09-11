// Canton Quests — Media Storage & Client Compression Service (Phase 4)

import { supabase, isSupabaseConfigured } from './supabase';
import { normalizeEvidenceContentType } from './quest-evidence';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Compresses an image File client-side before upload to reduce bandwidth and storage overhead.
 */
export async function compressImageClientSide(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<Blob> {
  const { maxWidth = 1600, maxHeight = 1600, quality = 0.85 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Image could not be processed.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Image could not be processed.'));
            }
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = (err) => reject(err);
    };

    reader.onerror = (err) => reject(err);
  });
}

/**
 * Uploads quest evidence to the private `quest-proofs` Storage bucket using
 * the server-issued signed-upload flow (Master Launch Pivot). The server
 * (POST /api/game/quest-proofs/authorize-upload) verifies the authenticated
 * player, event, and quest, then mints a one-time upload token scoped to a
 * brand-new, unpredictable object path — the client never picks the path
 * and never uploads anywhere the server didn't explicitly authorize.
 *
 * On success, returns the object `path` (never a public URL — the bucket
 * is private) to submit as `proofUrl` to POST /api/game/submit, which
 * independently re-verifies the object actually exists at that exact path
 * before awarding anything.
 */
export async function uploadQuestEvidence(
  file: File,
  eventId: string,
  questId: string
): Promise<{ success: boolean; path?: string; message: string }> {
  const maxSizeBytes = 25_000_000;
  const originalContentType = normalizeEvidenceContentType(file.type, file.name);
  if (!originalContentType) {
    return { success: false, message: 'Unsupported photo format. Choose a common JPG, PNG, HEIC/HEIF, WebP, or video file.' };
  }

  let uploadBlob: Blob = file;
  let uploadContentType = originalContentType;
  if (originalContentType.startsWith('image/')) {
    try {
      uploadBlob = await compressImageClientSide(file);
      uploadContentType = 'image/jpeg';
    } catch (e) {
      console.warn('Image compression fallback to original file', e);
    }
  }

  if (uploadBlob.size > maxSizeBytes) {
    return { success: false, message: 'This file is still over 25 MB after processing. Choose a smaller photo.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, message: 'Evidence storage is not configured on this environment.' };
  }

  try {
    const authRes = await fetch('/api/game/quest-proofs/authorize-upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventId, questId, contentType: uploadContentType, filename: file.name }),
    });
    const auth = await authRes.json().catch(() => ({}));
    if (!authRes.ok || !auth.success) {
      return { success: false, message: auth.error || 'Upload authorization failed. Check your connection and try again.' };
    }

    const { error } = await supabase.storage
      .from('quest-proofs')
      .uploadToSignedUrl(auth.path, auth.token, uploadBlob, { contentType: uploadContentType });

    if (error) {
      console.error('Supabase signed-upload error:', error);
      return { success: false, message: 'Secure storage could not save this evidence. Tap to try again.' };
    }

    return { success: true, path: auth.path, message: 'Evidence uploaded securely.' };
  } catch (err: any) {
    console.error('Upload exception:', err);
    return { success: false, message: 'Upload failed. Check your connection and try again.' };
  }
}
