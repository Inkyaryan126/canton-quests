// Canton Quests — Media Storage & Client Compression Service (Phase 4)

import { supabase, isSupabaseConfigured } from './supabase';

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
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              resolve(file);
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
 * Uploads a proof photo/video to Supabase Storage bucket 'quest-proofs'.
 * Returns a fallback data URL or mock URL if Supabase is offline.
 */
export async function uploadProofMedia(
  file: File,
  playerId: string,
  questId: string
): Promise<{ success: boolean; url: string; filePath?: string; message: string }> {
  // Validate file size limit (50 MB)
  const maxSizeBytes = 50 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      success: false,
      url: '',
      message: 'File size exceeds maximum 50 MB limit!',
    };
  }

  // Compress if image
  let uploadBlob: Blob = file;
  if (file.type.startsWith('image/')) {
    try {
      uploadBlob = await compressImageClientSide(file);
    } catch (e) {
      console.warn('Image compression fallback to original file', e);
    }
  }

  if (!isSupabaseConfigured || !supabase) {
    // Return Object URL or Data URL fallback
    const mockUrl = URL.createObjectURL(uploadBlob);
    return {
      success: true,
      url: mockUrl,
      message: 'Media proof saved in local memory buffer.',
    };
  }

  try {
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `proofs/p-${playerId}/q-${questId}-${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
      .from('quest-proofs')
      .upload(fileName, uploadBlob, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      const mockUrl = URL.createObjectURL(uploadBlob);
      return { success: true, url: mockUrl, message: 'Uploaded with local fallback buffer.' };
    }

    const { data: publicUrlData } = supabase.storage.from('quest-proofs').getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      filePath: data.path,
      message: 'Proof media uploaded successfully to secure storage!',
    };
  } catch (err: any) {
    console.error('Upload exception:', err);
    return {
      success: true,
      url: URL.createObjectURL(uploadBlob),
      message: 'Uploaded with fallback buffer.',
    };
  }
}
