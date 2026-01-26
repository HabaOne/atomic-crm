-- Migration 2: Add organization_id columns to all tables
-- Columns are nullable initially to allow data migration in next step

-- Add organization_id to sales table
ALTER TABLE "public"."sales" ADD COLUMN "organization_id" bigint;

-- Add organization_id to companies table
ALTER TABLE "public"."companies" ADD COLUMN "organization_id" bigint;

-- Add organization_id to contacts table
ALTER TABLE "public"."contacts" ADD COLUMN "organization_id" bigint;

-- Add organization_id to contact_notes table
ALTER TABLE "public"."contact_notes" ADD COLUMN "organization_id" bigint;

-- Add organization_id to deals table
ALTER TABLE "public"."deals" ADD COLUMN "organization_id" bigint;

-- Add organization_id to deal_notes table
ALTER TABLE "public"."deal_notes" ADD COLUMN "organization_id" bigint;

-- Add organization_id to tasks table
ALTER TABLE "public"."tasks" ADD COLUMN "organization_id" bigint;

-- Add organization_id to tags table
ALTER TABLE "public"."tags" ADD COLUMN "organization_id" bigint;

-- Create indexes for RLS performance (CRITICAL)
-- These indexes are essential for efficient RLS filtering
CREATE INDEX idx_sales_organization_id ON sales(organization_id);
CREATE INDEX idx_companies_organization_id ON companies(organization_id);
CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);
CREATE INDEX idx_contact_notes_organization_id ON contact_notes(organization_id);
CREATE INDEX idx_deals_organization_id ON deals(organization_id);
CREATE INDEX idx_deal_notes_organization_id ON deal_notes(organization_id);
CREATE INDEX idx_tasks_organization_id ON tasks(organization_id);
CREATE INDEX idx_tags_organization_id ON tags(organization_id);

-- Add comments for documentation
COMMENT ON COLUMN sales.organization_id IS 'Foreign key to organizations table for multi-tenancy';
COMMENT ON COLUMN companies.organization_id IS 'Foreign key to organizations table for multi-tenancy';
COMMENT ON COLUMN contacts.organization_id IS 'Foreign key to organizations table for multi-tenancy';
COMMENT ON COLUMN contact_notes.organization_id IS 'Foreign key to organizations table for multi-tenancy';
COMMENT ON COLUMN deals.organization_id IS 'Foreign key to organizations table for multi-tenancy';
COMMENT ON COLUMN deal_notes.organization_id IS 'Foreign key to organizations table for multi-tenancy';
COMMENT ON COLUMN tasks.organization_id IS 'Foreign key to organizations table for multi-tenancy';
COMMENT ON COLUMN tags.organization_id IS 'Foreign key to organizations table for multi-tenancy';
