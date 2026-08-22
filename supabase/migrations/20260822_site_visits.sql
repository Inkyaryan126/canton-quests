-- Canton Quests: Site Visitor Analytics
-- Run this migration in the Supabase SQL editor.

CREATE TABLE IF NOT EXISTS site_visits (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_hash  TEXT,
  page_path     TEXT        NOT NULL DEFAULT '/',
  country       TEXT,
  country_code  TEXT,
  region        TEXT,
  city          TEXT,
  latitude      FLOAT,
  longitude     FLOAT,
  device_type   TEXT,       -- 'mobile' | 'tablet' | 'desktop' | 'bot'
  referrer      TEXT,
  visited_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_visits_visited_at_idx  ON site_visits (visited_at DESC);
CREATE INDEX IF NOT EXISTS site_visits_session_hash_idx ON site_visits (session_hash);
CREATE INDEX IF NOT EXISTS site_visits_country_code_idx ON site_visits (country_code);
CREATE INDEX IF NOT EXISTS site_visits_page_path_idx   ON site_visits (page_path);

-- Optional: auto-purge visits older than 365 days (requires pg_cron or a scheduled function)
-- CREATE POLICY delete_old_visits ON site_visits FOR DELETE USING (visited_at < now() - interval '365 days');
