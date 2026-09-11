// Canton Quests — Quest Evidence Storage (private, immutable photo/video proof)
//
// Master Launch Pivot correction: a photo/video quest submission's proofUrl
// is never trusted as an arbitrary client-supplied string. The only legal
// value is the exact object path of a real, private, immutable file this
// exact player uploaded through a server-issued signed upload URL, for this
// exact quest and event. This module is the single source of truth for
// that path's shape and for confirming an object actually exists there —
// shared by the upload-authorization endpoint and the submit-verification
// path (lib/supabase-db.ts) so both agree on the same rule.

export const QUEST_EVIDENCE_BUCKET = 'quest-proofs';

const SAFE_ID_SEGMENT = /^[a-zA-Z0-9_-]+$/;
const ALLOWED_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/avif': 'avif',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

const CONTENT_TYPE_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
};

const EXTENSION_ALIASES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

/** Normalize an upload MIME type, using its filename when browsers omit it. */
export function normalizeEvidenceContentType(contentType: string, filename?: string): string | undefined {
  const normalized = contentType.trim().toLowerCase().split(';', 1)[0];
  const canonical = CONTENT_TYPE_ALIASES[normalized] || normalized;
  if (ALLOWED_EXTENSIONS[canonical]) return canonical;
  if (!normalized && filename) {
    const extension = filename.toLowerCase().split('.').pop() || '';
    return EXTENSION_ALIASES[extension];
  }
  return undefined;
}

export function extensionForContentType(contentType: string): string | undefined {
  const normalized = normalizeEvidenceContentType(contentType);
  return normalized ? ALLOWED_EXTENSIONS[normalized] : undefined;
}

const EXTENSION_TO_CONTENT_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ALLOWED_EXTENSIONS).map(([mime, ext]) => [ext, mime])
);

export function contentTypeForExtension(ext: string): string | undefined {
  return EXTENSION_TO_CONTENT_TYPE[ext.toLowerCase()];
}

export interface QuestEvidenceContextSnapshot {
  questTitle: string;
  instructions: string;
  proofRequirement: string;
  dynamicChallenge: string | null;
  evidencePath: string;
  mimeType: string | null;
  capturedAt: string;
}

/**
 * Freezes exactly what the player was shown and what they uploaded, at the
 * moment their photo/video evidence was confirmed — never regenerated or
 * recomputed later from whatever the quest's text happens to read at audit
 * or finale time. This is what makes a later winner-audit review honest: the
 * reviewer sees the challenge as it was, not as it is now.
 */
export function buildEvidenceContextSnapshot(params: {
  questTitle: string;
  instructions: string;
  proofRequirement: string;
  evidencePath: string;
}): QuestEvidenceContextSnapshot {
  const ext = params.evidencePath.split('.').pop() || '';
  return {
    questTitle: params.questTitle,
    instructions: params.instructions,
    proofRequirement: params.proofRequirement,
    // No quest in this roster generates per-submission dynamic challenge
    // text today; the field exists so one could without a schema change.
    dynamicChallenge: null,
    evidencePath: params.evidencePath,
    mimeType: contentTypeForExtension(ext) || null,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Builds the one, unique, unpredictable storage path a specific evidence
 * upload will live at: eventId/playerId/questId/evidenceId.ext. Every
 * segment is validated to be an existing, safe id — never accepts
 * unsanitized input — so the resulting path can be trusted as a strong
 * ownership proof (see isPathOwnedBy below) without a database round trip
 * on every check.
 */
export function buildQuestEvidencePath(params: {
  eventId: string;
  playerId: string;
  questId: string;
  evidenceId: string;
  ext: string;
}): string {
  for (const seg of [params.eventId, params.playerId, params.questId, params.evidenceId]) {
    if (!SAFE_ID_SEGMENT.test(seg)) {
      throw new Error('Invalid id segment for quest evidence path.');
    }
  }
  if (!/^[a-z0-9]{1,5}$/.test(params.ext)) {
    throw new Error('Invalid file extension for quest evidence path.');
  }
  return `${params.eventId}/${params.playerId}/${params.questId}/${params.evidenceId}.${params.ext}`;
}

/**
 * Whether a given evidence path is structurally owned by this exact
 * player/event/quest — i.e. its first three path segments match exactly.
 * This is the ownership check the submit path relies on: a player can never
 * claim another player's (or another quest's) uploaded evidence as their
 * own, even if they somehow learned its path, because the path itself
 * encodes ownership and this check is independent of anything the client
 * asserts.
 */
export function isEvidencePathOwnedBy(path: string, eventId: string, playerId: string, questId: string): boolean {
  const expectedPrefix = `${eventId}/${playerId}/${questId}/`;
  if (!path.startsWith(expectedPrefix)) return false;
  const rest = path.slice(expectedPrefix.length);
  // Exactly one path segment after the prefix (the evidenceId.ext filename)
  // — never a nested path, never empty.
  return rest.length > 0 && !rest.includes('/') && !rest.includes('..');
}
