/**
 * CANTON QUESTS — SERVER QUEST PROOF TARGET HASH REGISTRY & DIGEST UTILITIES
 *
 * Provides server-authoritative SHA-256 target hashes for quest completions,
 * multi-step fragment ciphers, and secret codes.
 *
 * Statically bundled for Next.js / Vercel Serverless runtimes without dynamic
 * filesystem I/O to guarantee zero missing module errors.
 */

import crypto from 'crypto';

export function proofDigest(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (typeof crypto !== 'undefined' && typeof crypto.createHash === 'function') {
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
  return '';
}

export function proofMatches(inputValue: string | undefined, targetValue: string | undefined): boolean {
  const input = (inputValue || '').trim().toUpperCase();
  const target = (targetValue || '').trim();
  if (!input || !target) return false;
  if (target.toLowerCase().startsWith('sha256:')) {
    return proofDigest(input) === target.slice('sha256:'.length).toLowerCase();
  }
  return input === target.toUpperCase();
}

/**
 * Same as proofMatches, but also accepts any of a list of synonym answers
 * (e.g. "whale" / "blue whale" / "a whale" all completing the same quest).
 * `variants` is optional so every existing single-answer quest is unaffected.
 */
export function proofMatchesAny(
  inputValue: string | undefined,
  targetValue: string | undefined,
  variants?: string[]
): boolean {
  if (proofMatches(inputValue, targetValue)) return true;
  return (variants || []).some((variant) => proofMatches(inputValue, variant));
}

export interface ServerProofSecretMaps {
  QUEST_TARGET_CODE_HASHES: Record<string, string>;
  STEP_TARGET_CODE_HASHES?: Record<string, string>;
  SECRET_CODE_HASHES: Record<string, string>;
}

export const CANONICAL_QUEST_PROOF_SECRETS: ServerProofSecretMaps = {
  QUEST_TARGET_CODE_HASHES: {
    'qst-mckinley-cipher': 'sha256:0e3c49c57d4ab2494d55671730c356687405eb0423cc755381399f2f431b2d16',
    'e0000001-0000-4000-8000-000000000002': 'sha256:0e3c49c57d4ab2494d55671730c356687405eb0423cc755381399f2f431b2d16',
    'qst-aura-coffee-qr': 'sha256:a3cd92f342c2b4d31e2025bd95b19b10ed3f996b3360dcfd57fe3233767ac8c9',
    'e0000001-0000-4000-8000-000000000004': 'sha256:a3cd92f342c2b4d31e2025bd95b19b10ed3f996b3360dcfd57fe3233767ac8c9',
    'qst-palace-theatre-year': 'sha256:3d5d2c29712a98874d8142d229c4bce09158a144ad376c2b68411f240878a9c1',
    'e0000001-0000-4000-8000-000000000006': 'sha256:3d5d2c29712a98874d8142d229c4bce09158a144ad376c2b68411f240878a9c1',
    'qst-onesto-brass-motto': 'sha256:1d3c51271f477ae14e45c93c4de9d71c88e659ec9df9ac491b917fcbee0987eb',
    'e0000001-0000-4000-8000-000000000008': 'sha256:1d3c51271f477ae14e45c93c4de9d71c88e659ec9df9ac491b917fcbee0987eb',
    'qst-hof-legend-qr': 'sha256:e5ec5382a5c868db291798d6f727c21b8b2e6e589a09849c8dbf4c5e981a24bd',
    'e0000001-0000-4000-8000-000000000009': 'sha256:e5ec5382a5c868db291798d6f727c21b8b2e6e589a09849c8dbf4c5e981a24bd',
    'qst-secret-cipher-77': 'sha256:aaa637bb2b24bc3e307a3201e22c694cdc4566365c991ccd64fa93bae23f3996',
    'e0000001-0000-4000-8000-000000000011': 'sha256:aaa637bb2b24bc3e307a3201e22c694cdc4566365c991ccd64fa93bae23f3996',
    'qst-founders-secret-clue': 'sha256:036b0ec8125ea4188177e958f876254c06724168970a02060c29551e083595c6',
    'e0000001-0000-4000-8000-000000000012': 'sha256:036b0ec8125ea4188177e958f876254c06724168970a02060c29551e083595c6',
    'qst-palace-flash-popup': 'sha256:e49c9702b08e49280244ca823d1a747df7a3386f0cc67a990a6e5fd9094c6a70',
    'e0000001-0000-4000-8000-000000000013': 'sha256:e49c9702b08e49280244ca823d1a747df7a3386f0cc67a990a6e5fd9094c6a70',
    'qst-grand-finale-cipher': 'sha256:8a2199b47b3f30d63a023f8dcfc82edc66bf863b3b23189703224923ad25c56f',
    'e0000001-0000-4000-8000-000000000015': 'sha256:8a2199b47b3f30d63a023f8dcfc82edc66bf863b3b23189703224923ad25c56f',
    // Challenge sector — C1-C4 (DRAFT/CONTENT_LOCKED, coordinates not yet supplied)
    'qst-challenge-blue-signal': 'sha256:c1e524f5325e090e0c4b6d2025b3b73eb6ea4608bd1f42c55d580db5480eaeac', // WHALE
    'qst-challenge-what-survived': 'sha256:22c71fc75f2ccec3be35306272851ffc48e0587cabced42e87880a9fdcb3c0be', // BLUE WHALE
    'qst-challenge-the-lost-page': 'sha256:557e111d453d6b864d4aeb1c3f801b1f440f711a8d0ebd1cd5f6e373161a056c', // WHALE-CAT-GINGERBREAD-WOLF
  },
  STEP_TARGET_CODE_HASHES: {
    'step-secret-founder-fragment': 'sha256:be562e8a568bb4e0d791bca32216ff5ab972809bee874b937820e267f1e27106',
    'f0000001-0000-4000-8000-000000000001': 'sha256:be562e8a568bb4e0d791bca32216ff5ab972809bee874b937820e267f1e27106',
    'step-secret-mural-fragment': 'sha256:a0075b8e48f2cb31f4d2dc97a9c7326856d300fe0a733099686390f4ae4d632d',
    'f0000001-0000-4000-8000-000000000002': 'sha256:a0075b8e48f2cb31f4d2dc97a9c7326856d300fe0a733099686390f4ae4d632d',
    'step-secret-brass-fragment': 'sha256:3a5272225a330aba73b7dd79c961313b53c7dbb5dd75d6376505ee2bf5d8403c',
    'f0000001-0000-4000-8000-000000000003': 'sha256:3a5272225a330aba73b7dd79c961313b53c7dbb5dd75d6376505ee2bf5d8403c',
    // Challenge sector — C2 Storybook Witness (three observations)
    'step-challenge-storybook-cat': 'sha256:15b89a569474240a616f9a94dd045b2711d445dde955b62bf4b8f2a2afaf0f6b', // CAT
    'step-challenge-storybook-gingerbread': 'sha256:afb6d23fcb0a3ab17ba8ad4968a2f5b9e4ef32b936afe66491ccd8f41ffbd293', // GINGERBREAD MAN
    'step-challenge-storybook-wolf': 'sha256:7b8f72c65b9fbbf971301567da244175a694378f89f2bb33a7313ce752e9e8bd', // WOLF
  },
  SECRET_CODE_HASHES: {
    'code-founder-2026': 'sha256:67a9464364c6f818e5ee997ee0a2b4ce41132639b4498d2a8ceedf70b0d90834',
    '50000001-0000-4000-8000-000000000001': 'sha256:67a9464364c6f818e5ee997ee0a2b4ce41132639b4498d2a8ceedf70b0d90834',
    'code-courier-77': 'sha256:02afa6fe2b15c793aad3c73636cbc91539816da99dc43144712b3bf405933eca',
    '50000001-0000-4000-8000-000000000002': 'sha256:02afa6fe2b15c793aad3c73636cbc91539816da99dc43144712b3bf405933eca',
  },
};

/**
 * Returns the server proof secret maps, incorporating optional environment overrides.
 */
export function getServerProofSecretMaps(): ServerProofSecretMaps {
  if (typeof process !== 'undefined' && process.env && process.env.QUEST_PROOF_SECRETS_OVERRIDE_JSON) {
    try {
      const parsed = JSON.parse(process.env.QUEST_PROOF_SECRETS_OVERRIDE_JSON);
      if (parsed && typeof parsed === 'object') {
        return {
          QUEST_TARGET_CODE_HASHES: {
            ...CANONICAL_QUEST_PROOF_SECRETS.QUEST_TARGET_CODE_HASHES,
            ...(parsed.QUEST_TARGET_CODE_HASHES || {}),
          },
          STEP_TARGET_CODE_HASHES: {
            ...CANONICAL_QUEST_PROOF_SECRETS.STEP_TARGET_CODE_HASHES,
            ...(parsed.STEP_TARGET_CODE_HASHES || {}),
          },
          SECRET_CODE_HASHES: {
            ...CANONICAL_QUEST_PROOF_SECRETS.SECRET_CODE_HASHES,
            ...(parsed.SECRET_CODE_HASHES || {}),
          },
        };
      }
    } catch {
      // Fail closed to canonical hashes
    }
  }

  return CANONICAL_QUEST_PROOF_SECRETS;
}

export function getServerQuestTargetCode(questId: string): string | undefined {
  const maps = getServerProofSecretMaps();
  return maps.QUEST_TARGET_CODE_HASHES[questId];
}

export function getServerQuestStepTargetCode(stepId: string): string | undefined {
  const maps = getServerProofSecretMaps();
  return maps.STEP_TARGET_CODE_HASHES?.[stepId];
}
