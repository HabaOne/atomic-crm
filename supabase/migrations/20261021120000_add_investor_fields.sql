-- Investor fields for companies and contacts, used by the investor import
-- (2026-10-21). All columns are nullable or defaulted, so existing rows and the
-- current UI keep working. RLS is unchanged: the existing tenant policies on
-- companies and contacts cover the new columns.

ALTER TABLE "public"."companies"
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_keys text[],
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS investor_type text,
  ADD COLUMN IF NOT EXISTS stages text[],
  ADD COLUMN IF NOT EXISTS sectors text[],
  ADD COLUMN IF NOT EXISTS sectors_raw text[],
  ADD COLUMN IF NOT EXISTS check_size text,
  ADD COLUMN IF NOT EXISTS geography_focus text;

ALTER TABLE "public"."contacts"
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS imported_at timestamptz,
  ADD COLUMN IF NOT EXISTS contact_type text,
  ADD COLUMN IF NOT EXISTS seniority text,
  ADD COLUMN IF NOT EXISTS is_primary_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_confidence text;

-- Closed value sets keep the filters clean. Drop first so the file can run
-- again (for example by hand in the SQL editor, then via supabase db push).
ALTER TABLE "public"."companies"
  DROP CONSTRAINT IF EXISTS companies_investor_type_check,
  DROP CONSTRAINT IF EXISTS companies_stages_check,
  ADD CONSTRAINT companies_investor_type_check CHECK (
    investor_type IS NULL OR investor_type IN
      ('vc_fund', 'angel_network', 'pe', 'family_office', 'investment_firm')
  ),
  ADD CONSTRAINT companies_stages_check CHECK (
    stages IS NULL OR stages <@ ARRAY['pre_seed', 'seed', 'series_a', 'series_b', 'growth', 'late']
  );

ALTER TABLE "public"."contacts"
  DROP CONSTRAINT IF EXISTS contacts_seniority_check,
  DROP CONSTRAINT IF EXISTS contacts_email_confidence_check,
  ADD CONSTRAINT contacts_seniority_check CHECK (
    seniority IS NULL OR seniority IN ('partner', 'principal', 'director', 'founder', 'investor')
  ),
  ADD CONSTRAINT contacts_email_confidence_check CHECK (
    email_confidence IS NULL OR email_confidence IN ('published', 'verified_external', 'pattern')
  );

-- Idempotent re-import: one row per source id and organization.
CREATE UNIQUE INDEX IF NOT EXISTS companies_org_external_id_key
  ON "public"."companies" (organization_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_org_external_id_key
  ON "public"."contacts" (organization_id, external_id)
  WHERE external_id IS NOT NULL;

-- Filter indexes.
CREATE INDEX IF NOT EXISTS companies_stages_idx ON "public"."companies" USING gin (stages);
CREATE INDEX IF NOT EXISTS companies_sectors_idx ON "public"."companies" USING gin (sectors);
CREATE INDEX IF NOT EXISTS companies_investor_type_idx ON "public"."companies" (investor_type);
CREATE INDEX IF NOT EXISTS contacts_contact_type_idx ON "public"."contacts" (contact_type);
