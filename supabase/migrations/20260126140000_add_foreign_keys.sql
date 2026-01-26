-- Migration 4: Add foreign key constraints for organization_id
-- This enforces referential integrity and enables CASCADE DELETE

-- Add FK constraint from sales to organizations
ALTER TABLE "public"."sales"
  ADD CONSTRAINT "sales_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add FK constraint from companies to organizations
ALTER TABLE "public"."companies"
  ADD CONSTRAINT "companies_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add FK constraint from contacts to organizations
ALTER TABLE "public"."contacts"
  ADD CONSTRAINT "contacts_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add FK constraint from contact_notes to organizations
ALTER TABLE "public"."contact_notes"
  ADD CONSTRAINT "contact_notes_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add FK constraint from deals to organizations
ALTER TABLE "public"."deals"
  ADD CONSTRAINT "deals_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add FK constraint from deal_notes to organizations
ALTER TABLE "public"."deal_notes"
  ADD CONSTRAINT "deal_notes_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add FK constraint from tasks to organizations
ALTER TABLE "public"."tasks"
  ADD CONSTRAINT "tasks_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;

-- Add FK constraint from tags to organizations
ALTER TABLE "public"."tags"
  ADD CONSTRAINT "tags_organization_id_fkey"
  FOREIGN KEY (organization_id)
  REFERENCES organizations(id)
  ON DELETE CASCADE;
