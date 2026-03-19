-- Add extended contact fields for communication channels, location, and professional details.
-- All new columns are nullable to avoid breaking existing records.

ALTER TABLE "public"."contacts"
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS twitter_url text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS telegram_handle text,
  ADD COLUMN IF NOT EXISTS other_handles jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS preferred_language text,
  ADD COLUMN IF NOT EXISTS preferred_channel text;

-- The contacts_summary view uses `co.*` so new columns are automatically included.
-- Recreate it to ensure the view cache is refreshed.
DROP VIEW IF EXISTS "public"."contacts_summary";

CREATE VIEW "public"."contacts_summary"
  WITH (security_invoker=on)
AS
SELECT
  co.*,
  c.name as company_name,
  count(distinct t.id) as nb_tasks
FROM
  "public"."contacts" co
LEFT JOIN
  "public"."tasks" t
  ON co.id = t.contact_id
  AND co.organization_id = t.organization_id
LEFT JOIN
  "public"."companies" c
  ON co.company_id = c.id
  AND co.organization_id = c.organization_id
GROUP BY
  co.id, c.name;

COMMENT ON VIEW contacts_summary IS 'Aggregates contact data with task counts, company name, and extended detail fields. Tenant-aware joins ensure data isolation.';
