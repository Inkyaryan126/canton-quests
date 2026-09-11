import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { signedUpload } = vi.hoisted(() => ({ signedUpload: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { storage: { from: () => ({ uploadToSignedUrl: signedUpload }) } },
}));

import { uploadQuestEvidence } from '../lib/media';

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('mobile photo evidence upload processing', () => {
  let compressedBytes = 10;

  beforeEach(() => {
    vi.restoreAllMocks();
    compressedBytes = 10;
    signedUpload.mockReset();
    signedUpload.mockResolvedValue({ error: null });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ success: true, path: 'evt/plr/qst/evidence.jpg', token: 'token' })));
    vi.stubGlobal('FileReader', class {
      result = 'data:image/png;base64,fixture';
      onload: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      readAsDataURL() { queueMicrotask(() => this.onload?.({ target: this })); }
    });
    vi.stubGlobal('Image', class {
      width = 100;
      height = 100;
      onload: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage: vi.fn() }),
        toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob([new Uint8Array(compressedBytes)], { type: 'image/jpeg' })),
      }),
    });
  });

  it('uploads compressed PNG bytes as JPEG with a .jpg-authorized path and content type', async () => {
    const file = new File([new Uint8Array(30_000_000)], 'camera.png', { type: 'image/png' });
    const result = await uploadQuestEvidence(file, 'evt', 'qst');
    expect(result.success).toBe(true);
    expect(result.path).toMatch(/\.jpg$/);
    expect(JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body).contentType).toBe('image/jpeg');
    expect(signedUpload).toHaveBeenCalledWith('evt/plr/qst/evidence.jpg', 'token', expect.any(Blob), { contentType: 'image/jpeg' });
  });

  it('allows an original video under 25,000,000 bytes and rejects one over the storage limit', async () => {
    const accepted = await uploadQuestEvidence(new File([new Uint8Array(25_000_000)], 'clip.mp4', { type: 'video/mp4' }), 'evt', 'qst');
    expect(accepted.success).toBe(true);
    const rejected = await uploadQuestEvidence(new File([new Uint8Array(25_000_001)], 'clip.mp4', { type: 'video/mp4' }), 'evt', 'qst');
    expect(rejected).toEqual({ success: false, message: 'This file is still over 25 MB after processing. Choose a smaller photo.' });
  });

  it('allows an original photo larger than the limit when compression reduces the final blob', async () => {
    const result = await uploadQuestEvidence(new File([new Uint8Array(25_000_001)], 'camera.webp', { type: 'image/webp' }), 'evt', 'qst');
    expect(result.success).toBe(true);
  });

  it('exposes mobile-friendly instructions and does not force camera capture', () => {
    const source = readSource('app/events/[slug]/quests/[questId]/page.tsx');
    expect(source).toContain('UPLOAD QUEST EVIDENCE');
    expect(source).toContain('Take a new photo or choose one from your phone.');
    expect(source).toContain('Most phone photo formats are accepted, including JPG, PNG, HEIC/HEIF and WebP.');
    expect(source).toContain('Maximum final upload: 25 MB.');
    expect(source).toContain('Your evidence is private and used for quest verification.');
    expect(source).not.toContain('capture="environment"');
  });
});
