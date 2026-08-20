-- =============================================================================
-- Canton Quests Migration: QR Street Team 2026 Canonical Seed Repair
-- Version: 20260814040000
-- Description: Non-destructive, idempotent repair migration that restores the
--              canonical Canton Quests Street Team 2026 promotional campaign,
--              3 flyer variants (Family, Challenge, Secret), 3 distributors
--              (Dustin, Employee 1, Employee 2), and 9 QR tracking assignments
--              (f1..f3, c1..c3, s1..s3).
--
-- Invariants Enforced:
--  1. Fully Idempotent (safe to execute multiple times).
--  2. Zero Destructive Operations: zero deletes, zero table wipes, preserves
--     all existing user visit logs and non-canonical campaigns.
--  3. Natural-key conflict resilience: handles both primary key ('id') and
--     natural unique constraints ('slug', 'tracking_slug', 'campaign_id + name').
--  4. Deterministic Foreign Key hierarchy: parent campaign is resolved/seeded
--     before child flyer variants, distributors, and QR code tracking entries.
-- =============================================================================

DO $$
DECLARE
  v_campaign_id TEXT;
  v_variant_family_id TEXT;
  v_variant_challenge_id TEXT;
  v_variant_secret_id TEXT;
  v_dist_dustin_id TEXT;
  v_dist_emp1_id TEXT;
  v_dist_emp2_id TEXT;
BEGIN

  -- ---------------------------------------------------------------------------
  -- 1. Restore Canonical Campaign: Canton Quests Street Team 2026
  -- ---------------------------------------------------------------------------
  SELECT id INTO v_campaign_id
  FROM public.qr_campaigns
  WHERE id = 'camp-street-team-2026'
     OR slug = 'canton-quests-street-team-2026'
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    INSERT INTO public.qr_campaigns (id, name, slug, destination_url, description, notes, status)
    VALUES (
      'camp-street-team-2026',
      'Canton Quests Street Team 2026',
      'canton-quests-street-team-2026',
      '/quests',
      'Promotional QR flyer campaign distributed by the Canton street team across Canton, Ohio.',
      'Canonical street team campaign for flyers and short slugs.',
      'active'
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      destination_url = EXCLUDED.destination_url,
      description = EXCLUDED.description,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
    RETURNING id INTO v_campaign_id;
  ELSE
    UPDATE public.qr_campaigns
    SET
      name = 'Canton Quests Street Team 2026',
      slug = 'canton-quests-street-team-2026',
      destination_url = '/quests',
      description = 'Promotional QR flyer campaign distributed by the Canton street team across Canton, Ohio.',
      notes = 'Canonical street team campaign for flyers and short slugs.',
      status = 'active',
      updated_at = NOW()
    WHERE id = v_campaign_id;
  END IF;

  -- Ensure non-null campaign reference
  IF v_campaign_id IS NULL THEN
    SELECT id INTO v_campaign_id FROM public.qr_campaigns WHERE slug = 'canton-quests-street-team-2026';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. Restore 3 Canonical Flyer Variants (Family, Challenge, Secret)
  -- ---------------------------------------------------------------------------
  
  -- Variant 1: Family
  SELECT id INTO v_variant_family_id
  FROM public.campaign_flyer_variants
  WHERE (campaign_id = v_campaign_id AND name = 'Family') OR id = 'flyer-family'
  LIMIT 1;

  IF v_variant_family_id IS NULL THEN
    INSERT INTO public.campaign_flyer_variants (id, campaign_id, name, description, notes, status)
    VALUES ('flyer-family', v_campaign_id, 'Family', 'All-ages family adventure flyer', 'Destination /start/family', 'active')
    ON CONFLICT (id) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
    RETURNING id INTO v_variant_family_id;
  ELSE
    UPDATE public.campaign_flyer_variants
    SET
      campaign_id = v_campaign_id,
      name = 'Family',
      description = 'All-ages family adventure flyer',
      notes = 'Destination /start/family',
      status = 'active'
    WHERE id = v_variant_family_id;
  END IF;

  -- Variant 2: Challenge
  SELECT id INTO v_variant_challenge_id
  FROM public.campaign_flyer_variants
  WHERE (campaign_id = v_campaign_id AND name = 'Challenge') OR id = 'flyer-challenge'
  LIMIT 1;

  IF v_variant_challenge_id IS NULL THEN
    INSERT INTO public.campaign_flyer_variants (id, campaign_id, name, description, notes, status)
    VALUES ('flyer-challenge', v_campaign_id, 'Challenge', 'Competitive squad challenge flyer', 'Destination /start/challenge', 'active')
    ON CONFLICT (id) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
    RETURNING id INTO v_variant_challenge_id;
  ELSE
    UPDATE public.campaign_flyer_variants
    SET
      campaign_id = v_campaign_id,
      name = 'Challenge',
      description = 'Competitive squad challenge flyer',
      notes = 'Destination /start/challenge',
      status = 'active'
    WHERE id = v_variant_challenge_id;
  END IF;

  -- Variant 3: Secret
  SELECT id INTO v_variant_secret_id
  FROM public.campaign_flyer_variants
  WHERE (campaign_id = v_campaign_id AND name = 'Secret') OR id = 'flyer-secret'
  LIMIT 1;

  IF v_variant_secret_id IS NULL THEN
    INSERT INTO public.campaign_flyer_variants (id, campaign_id, name, description, notes, status)
    VALUES ('flyer-secret', v_campaign_id, 'Secret', 'Unlisted mystery entry flyer', 'Destination /start/secret', 'active')
    ON CONFLICT (id) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      name = EXCLUDED.name,
      description = EXCLUDED.description,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
    RETURNING id INTO v_variant_secret_id;
  ELSE
    UPDATE public.campaign_flyer_variants
    SET
      campaign_id = v_campaign_id,
      name = 'Secret',
      description = 'Unlisted mystery entry flyer',
      notes = 'Destination /start/secret',
      status = 'active'
    WHERE id = v_variant_secret_id;
  END IF;

  -- Re-query authoritative variant IDs
  SELECT id INTO v_variant_family_id FROM public.campaign_flyer_variants WHERE campaign_id = v_campaign_id AND name = 'Family';
  SELECT id INTO v_variant_challenge_id FROM public.campaign_flyer_variants WHERE campaign_id = v_campaign_id AND name = 'Challenge';
  SELECT id INTO v_variant_secret_id FROM public.campaign_flyer_variants WHERE campaign_id = v_campaign_id AND name = 'Secret';

  -- ---------------------------------------------------------------------------
  -- 3. Restore 3 Canonical Distributors (Dustin, Employee 1, Employee 2)
  -- ---------------------------------------------------------------------------

  -- Distributor 1: Dustin
  SELECT id INTO v_dist_dustin_id
  FROM public.campaign_distributors
  WHERE (campaign_id = v_campaign_id AND name = 'Dustin') OR id = 'dist-dustin'
  LIMIT 1;

  IF v_dist_dustin_id IS NULL THEN
    INSERT INTO public.campaign_distributors (id, campaign_id, name, notes, status)
    VALUES ('dist-dustin', v_campaign_id, 'Dustin', 'Street team lead', 'active')
    ON CONFLICT (id) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      name = EXCLUDED.name,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
    RETURNING id INTO v_dist_dustin_id;
  ELSE
    UPDATE public.campaign_distributors
    SET
      campaign_id = v_campaign_id,
      name = 'Dustin',
      notes = 'Street team lead',
      status = 'active'
    WHERE id = v_dist_dustin_id;
  END IF;

  -- Distributor 2: Employee 1
  SELECT id INTO v_dist_emp1_id
  FROM public.campaign_distributors
  WHERE (campaign_id = v_campaign_id AND name = 'Employee 1') OR id = 'dist-emp-1'
  LIMIT 1;

  IF v_dist_emp1_id IS NULL THEN
    INSERT INTO public.campaign_distributors (id, campaign_id, name, notes, status)
    VALUES ('dist-emp-1', v_campaign_id, 'Employee 1', 'Street team distributor 1', 'active')
    ON CONFLICT (id) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      name = EXCLUDED.name,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
    RETURNING id INTO v_dist_emp1_id;
  ELSE
    UPDATE public.campaign_distributors
    SET
      campaign_id = v_campaign_id,
      name = 'Employee 1',
      notes = 'Street team distributor 1',
      status = 'active'
    WHERE id = v_dist_emp1_id;
  END IF;

  -- Distributor 3: Employee 2
  SELECT id INTO v_dist_emp2_id
  FROM public.campaign_distributors
  WHERE (campaign_id = v_campaign_id AND name = 'Employee 2') OR id = 'dist-emp-2'
  LIMIT 1;

  IF v_dist_emp2_id IS NULL THEN
    INSERT INTO public.campaign_distributors (id, campaign_id, name, notes, status)
    VALUES ('dist-emp-2', v_campaign_id, 'Employee 2', 'Street team distributor 2', 'active')
    ON CONFLICT (id) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      name = EXCLUDED.name,
      notes = EXCLUDED.notes,
      status = EXCLUDED.status
    RETURNING id INTO v_dist_emp2_id;
  ELSE
    UPDATE public.campaign_distributors
    SET
      campaign_id = v_campaign_id,
      name = 'Employee 2',
      notes = 'Street team distributor 2',
      status = 'active'
    WHERE id = v_dist_emp2_id;
  END IF;

  -- Re-query authoritative distributor IDs
  SELECT id INTO v_dist_dustin_id FROM public.campaign_distributors WHERE campaign_id = v_campaign_id AND name = 'Dustin';
  SELECT id INTO v_dist_emp1_id FROM public.campaign_distributors WHERE campaign_id = v_campaign_id AND name = 'Employee 1';
  SELECT id INTO v_dist_emp2_id FROM public.campaign_distributors WHERE campaign_id = v_campaign_id AND name = 'Employee 2';

  -- ---------------------------------------------------------------------------
  -- 4. Restore 9 Canonical QR Tracking Codes (f1..f3, c1..c3, s1..s3)
  -- ---------------------------------------------------------------------------

  -- Code f1: Family / Dustin
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 'f1' OR id = 'cqr-canonical-f1') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_family_id,
      distributor_id = v_dist_dustin_id,
      internal_name = 'Canton Quests Street Team 2026 / Family / Dustin',
      destination_url = '/start/family',
      tracking_slug = 'f1',
      status = 'active'
    WHERE tracking_slug = 'f1' OR id = 'cqr-canonical-f1';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-f1', v_campaign_id, v_variant_family_id, v_dist_dustin_id, 'Canton Quests Street Team 2026 / Family / Dustin', '/start/family', 'f1', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code f2: Family / Employee 1
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 'f2' OR id = 'cqr-canonical-f2') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_family_id,
      distributor_id = v_dist_emp1_id,
      internal_name = 'Canton Quests Street Team 2026 / Family / Employee 1',
      destination_url = '/start/family',
      tracking_slug = 'f2',
      status = 'active'
    WHERE tracking_slug = 'f2' OR id = 'cqr-canonical-f2';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-f2', v_campaign_id, v_variant_family_id, v_dist_emp1_id, 'Canton Quests Street Team 2026 / Family / Employee 1', '/start/family', 'f2', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code f3: Family / Employee 2
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 'f3' OR id = 'cqr-canonical-f3') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_family_id,
      distributor_id = v_dist_emp2_id,
      internal_name = 'Canton Quests Street Team 2026 / Family / Employee 2',
      destination_url = '/start/family',
      tracking_slug = 'f3',
      status = 'active'
    WHERE tracking_slug = 'f3' OR id = 'cqr-canonical-f3';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-f3', v_campaign_id, v_variant_family_id, v_dist_emp2_id, 'Canton Quests Street Team 2026 / Family / Employee 2', '/start/family', 'f3', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code c1: Challenge / Dustin
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 'c1' OR id = 'cqr-canonical-c1') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_challenge_id,
      distributor_id = v_dist_dustin_id,
      internal_name = 'Canton Quests Street Team 2026 / Challenge / Dustin',
      destination_url = '/start/challenge',
      tracking_slug = 'c1',
      status = 'active'
    WHERE tracking_slug = 'c1' OR id = 'cqr-canonical-c1';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-c1', v_campaign_id, v_variant_challenge_id, v_dist_dustin_id, 'Canton Quests Street Team 2026 / Challenge / Dustin', '/start/challenge', 'c1', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code c2: Challenge / Employee 1
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 'c2' OR id = 'cqr-canonical-c2') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_challenge_id,
      distributor_id = v_dist_emp1_id,
      internal_name = 'Canton Quests Street Team 2026 / Challenge / Employee 1',
      destination_url = '/start/challenge',
      tracking_slug = 'c2',
      status = 'active'
    WHERE tracking_slug = 'c2' OR id = 'cqr-canonical-c2';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-c2', v_campaign_id, v_variant_challenge_id, v_dist_emp1_id, 'Canton Quests Street Team 2026 / Challenge / Employee 1', '/start/challenge', 'c2', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code c3: Challenge / Employee 2
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 'c3' OR id = 'cqr-canonical-c3') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_challenge_id,
      distributor_id = v_dist_emp2_id,
      internal_name = 'Canton Quests Street Team 2026 / Challenge / Employee 2',
      destination_url = '/start/challenge',
      tracking_slug = 'c3',
      status = 'active'
    WHERE tracking_slug = 'c3' OR id = 'cqr-canonical-c3';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-c3', v_campaign_id, v_variant_challenge_id, v_dist_emp2_id, 'Canton Quests Street Team 2026 / Challenge / Employee 2', '/start/challenge', 'c3', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code s1: Secret / Dustin
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 's1' OR id = 'cqr-canonical-s1') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_secret_id,
      distributor_id = v_dist_dustin_id,
      internal_name = 'Canton Quests Street Team 2026 / Secret / Dustin',
      destination_url = '/start/secret',
      tracking_slug = 's1',
      status = 'active'
    WHERE tracking_slug = 's1' OR id = 'cqr-canonical-s1';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-s1', v_campaign_id, v_variant_secret_id, v_dist_dustin_id, 'Canton Quests Street Team 2026 / Secret / Dustin', '/start/secret', 's1', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code s2: Secret / Employee 1
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 's2' OR id = 'cqr-canonical-s2') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_secret_id,
      distributor_id = v_dist_emp1_id,
      internal_name = 'Canton Quests Street Team 2026 / Secret / Employee 1',
      destination_url = '/start/secret',
      tracking_slug = 's2',
      status = 'active'
    WHERE tracking_slug = 's2' OR id = 'cqr-canonical-s2';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-s2', v_campaign_id, v_variant_secret_id, v_dist_emp1_id, 'Canton Quests Street Team 2026 / Secret / Employee 1', '/start/secret', 's2', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

  -- Code s3: Secret / Employee 2
  IF EXISTS (SELECT 1 FROM public.campaign_qr_codes WHERE tracking_slug = 's3' OR id = 'cqr-canonical-s3') THEN
    UPDATE public.campaign_qr_codes
    SET
      campaign_id = v_campaign_id,
      flyer_variant_id = v_variant_secret_id,
      distributor_id = v_dist_emp2_id,
      internal_name = 'Canton Quests Street Team 2026 / Secret / Employee 2',
      destination_url = '/start/secret',
      tracking_slug = 's3',
      status = 'active'
    WHERE tracking_slug = 's3' OR id = 'cqr-canonical-s3';
  ELSE
    INSERT INTO public.campaign_qr_codes (id, campaign_id, flyer_variant_id, distributor_id, internal_name, destination_url, tracking_slug, status)
    VALUES ('cqr-canonical-s3', v_campaign_id, v_variant_secret_id, v_dist_emp2_id, 'Canton Quests Street Team 2026 / Secret / Employee 2', '/start/secret', 's3', 'active')
    ON CONFLICT (tracking_slug) DO UPDATE SET
      campaign_id = EXCLUDED.campaign_id,
      flyer_variant_id = EXCLUDED.flyer_variant_id,
      distributor_id = EXCLUDED.distributor_id,
      internal_name = EXCLUDED.internal_name,
      destination_url = EXCLUDED.destination_url,
      status = EXCLUDED.status;
  END IF;

END $$;
