-- Contact lifecycle stages (per-organization pipeline board) and timed tasks
-- (appointments). Additive only: every new column is nullable or has a
-- default, so existing contacts and tasks keep their current values.

ALTER TABLE "public"."contacts"
  ADD COLUMN IF NOT EXISTS lifecycle_stage text,
  ADD COLUMN IF NOT EXISTS lifecycle_substatus text,
  ADD COLUMN IF NOT EXISTS lifecycle_updated_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_contacts_organization_lifecycle_stage
  ON "public"."contacts" (organization_id, lifecycle_stage);

ALTER TABLE "public"."tasks"
  ADD COLUMN IF NOT EXISTS has_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duration_minutes integer;

ALTER TABLE "public"."tasks"
  DROP CONSTRAINT IF EXISTS tasks_duration_minutes_positive;
ALTER TABLE "public"."tasks"
  ADD CONSTRAINT tasks_duration_minutes_positive
  CHECK (duration_minutes IS NULL OR duration_minutes > 0);

-- Notes the app writes by itself (for example "Stage: Lead -> Prospect")
-- do not count as contact with the person.
ALTER TABLE "public"."contact_notes"
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_contact_notes_contact_id
  ON "public"."contact_notes" (contact_id);

-- Recreate contacts_summary with contact activity: a contact counts as
-- contacted once it has a note (other than a system note) or a done task.
DROP VIEW IF EXISTS "public"."contacts_summary";

CREATE VIEW "public"."contacts_summary"
  WITH (security_invoker=on)
AS
SELECT
  co.*,
  c.name as company_name,
  c.stages as company_stages,
  count(distinct t.id) as nb_tasks,
  greatest(
    (
      SELECT max(n.date)
      FROM "public"."contact_notes" n
      WHERE n.contact_id = co.id
        AND n.organization_id = co.organization_id
        AND NOT n.is_system
    ),
    max(t.done_date)
  ) as last_contacted_at,
  (
    EXISTS (
      SELECT 1
      FROM "public"."contact_notes" n
      WHERE n.contact_id = co.id
        AND n.organization_id = co.organization_id
        AND NOT n.is_system
    )
    OR bool_or(t.done_date IS NOT NULL)
  ) IS TRUE as is_contacted
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
  co.id, c.name, c.stages;

COMMENT ON VIEW contacts_summary IS 'Aggregates contact data with task counts, company name and stages, and contact activity (last_contacted_at, is_contacted). Tenant-aware joins ensure data isolation.';

-- companies_summary selects c.*, which Postgres expands when the view is
-- created, so it does not show the investor columns added on 2026-10-21
-- (stages, investor_type, ...). Recreate it unchanged to pick them up.
DROP VIEW IF EXISTS "public"."companies_summary";

CREATE VIEW "public"."companies_summary"
  WITH (security_invoker=on)
AS
SELECT
  c.*,
  count(distinct d.id) as nb_deals,
  count(distinct co.id) as nb_contacts
FROM
  "public"."companies" c
LEFT JOIN
  "public"."deals" d
  ON c.id = d.company_id
  AND c.organization_id = d.organization_id
LEFT JOIN
  "public"."contacts" co
  ON c.id = co.company_id
  AND c.organization_id = co.organization_id
GROUP BY
  c.id;
