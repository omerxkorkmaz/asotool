-- ASO Tool — Historical metrics schema
-- ============================================================
-- NASIL ÇALIŞTIRILIR:
-- 1. Supabase Dashboard → projenizi açın
-- 2. Sol menü → SQL Editor → New query
-- 3. Bu dosyanın tamamını yapıştırın → Run
-- ============================================================

CREATE TABLE IF NOT EXISTS apps_daily_metrics (
  id BIGSERIAL PRIMARY KEY,
  app_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  rating REAL,
  rating_count INTEGER,
  installs_range TEXT,
  installs_min BIGINT,
  installs_max BIGINT,
  review_count INTEGER,
  title TEXT,
  short_description TEXT,
  version TEXT,
  last_updated TIMESTAMPTZ,
  price TEXT,
  developer_name TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (app_id, platform, date)
);

CREATE TABLE IF NOT EXISTS keyword_rankings_history (
  id BIGSERIAL PRIMARY KEY,
  keyword TEXT NOT NULL,
  app_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios')),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  rank INTEGER,
  total_results INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (keyword, app_id, platform, date)
);

CREATE INDEX IF NOT EXISTS idx_metrics_app_date ON apps_daily_metrics(app_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_keyword_date ON keyword_rankings_history(keyword, date DESC);
CREATE INDEX IF NOT EXISTS idx_keywords_app ON keyword_rankings_history(app_id);
