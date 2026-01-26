-- Migration 7: Update database views with tenant-aware joins
-- This ensures views respect organization boundaries and don't leak data across tenants

-- ========================================
-- Update companies_summary view
-- ========================================
-- Add organization_id to JOIN conditions to prevent cross-tenant data leaks

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
  AND c.organization_id = d.organization_id  -- Tenant-aware join
LEFT JOIN
  "public"."contacts" co
  ON c.id = co.company_id
  AND c.organization_id = co.organization_id  -- Tenant-aware join
GROUP BY
  c.id;

-- ========================================
-- Update contacts_summary view
-- ========================================
-- Add organization_id to JOIN conditions to prevent cross-tenant data leaks

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
  AND co.organization_id = t.organization_id  -- Tenant-aware join
LEFT JOIN
  "public"."companies" c
  ON co.company_id = c.id
  AND co.organization_id = c.organization_id  -- Tenant-aware join
GROUP BY
  co.id, c.name;

-- Add comments for documentation
COMMENT ON VIEW companies_summary IS 'Aggregates company data with deal and contact counts. Tenant-aware joins ensure data isolation.';
COMMENT ON VIEW contacts_summary IS 'Aggregates contact data with task counts and company name. Tenant-aware joins ensure data isolation.';
