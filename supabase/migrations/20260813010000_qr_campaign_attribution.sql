-- Canton Quests — QR campaign attribution for promotional flyers.
-- Local migration only until applied through the production migration workflow.

CREATE TABLE IF NOT EXISTS public.qr_campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  destination_url text NOT NULL,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_flyer_variants (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, name)
);

CREATE TABLE IF NOT EXISTS public.campaign_distributors (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  name text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, name)
);

CREATE TABLE IF NOT EXISTS public.campaign_qr_codes (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  flyer_variant_id text NOT NULL REFERENCES public.campaign_flyer_variants(id) ON DELETE CASCADE,
  distributor_id text NOT NULL REFERENCES public.campaign_distributors(id) ON DELETE CASCADE,
  internal_name text NOT NULL,
  destination_url text NOT NULL,
  tracking_slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, flyer_variant_id, distributor_id)
);

CREATE TABLE IF NOT EXISTS public.campaign_visits (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.qr_campaigns(id) ON DELETE CASCADE,
  flyer_variant_id text NOT NULL REFERENCES public.campaign_flyer_variants(id) ON DELETE CASCADE,
  distributor_id text NOT NULL REFERENCES public.campaign_distributors(id) ON DELETE CASCADE,
  qr_code_id text NOT NULL REFERENCES public.campaign_qr_codes(id) ON DELETE CASCADE,
  destination_url text NOT NULL,
  anonymous_visitor_id text NOT NULL,
  referrer text,
  user_agent_class text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_flyers_campaign ON public.campaign_flyer_variants(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_distributors_campaign ON public.campaign_distributors(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qrs_campaign ON public.campaign_qr_codes(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_qrs_slug_active ON public.campaign_qr_codes(tracking_slug, status);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_campaign_created ON public.campaign_visits(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_flyer ON public.campaign_visits(campaign_id, flyer_variant_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_distributor ON public.campaign_visits(campaign_id, distributor_id);
CREATE INDEX IF NOT EXISTS idx_campaign_visits_combination ON public.campaign_visits(qr_code_id, anonymous_visitor_id);

ALTER TABLE public.qr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_flyer_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_distributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_qr_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "GM admin manages qr campaigns" ON public.qr_campaigns;
DROP POLICY IF EXISTS "GM admin manages campaign flyer variants" ON public.campaign_flyer_variants;
DROP POLICY IF EXISTS "GM admin manages campaign distributors" ON public.campaign_distributors;
DROP POLICY IF EXISTS "GM admin manages campaign qr codes" ON public.campaign_qr_codes;
DROP POLICY IF EXISTS "GM admin reads campaign visits" ON public.campaign_visits;

CREATE POLICY "GM admin manages qr campaigns"
  ON public.qr_campaigns
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "GM admin manages campaign flyer variants"
  ON public.campaign_flyer_variants
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "GM admin manages campaign distributors"
  ON public.campaign_distributors
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "GM admin manages campaign qr codes"
  ON public.campaign_qr_codes
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

CREATE POLICY "GM admin reads campaign visits"
  ON public.campaign_visits
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.players p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

REVOKE ALL ON public.qr_campaigns FROM anon, authenticated;
REVOKE ALL ON public.campaign_flyer_variants FROM anon, authenticated;
REVOKE ALL ON public.campaign_distributors FROM anon, authenticated;
REVOKE ALL ON public.campaign_qr_codes FROM anon, authenticated;
REVOKE ALL ON public.campaign_visits FROM anon, authenticated;
