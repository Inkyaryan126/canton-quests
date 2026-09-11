-- Keep the private quest evidence bucket configuration reproducible.
-- This updates limits and accepted upload formats only; privacy and RLS
-- remain governed by the private evidence storage migration.
UPDATE storage.buckets
SET
  file_size_limit = 25000000,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png',
    'image/webp', 'image/heic', 'image/heif', 'image/avif', 'image/gif',
    'image/bmp', 'image/tiff', 'video/mp4', 'video/quicktime'
  ]
WHERE id = 'quest-proofs';
