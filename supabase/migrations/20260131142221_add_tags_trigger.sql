-- Migration: Add organization_id auto-population trigger for tags table
-- This fixes contact import bug where tags are created without organization_id
-- causing 403 Forbidden errors due to RLS policy enforcement

-- The tags table already has:
-- - organization_id column (added in 20260126120000_add_organization_columns.sql)
-- - RLS policies (added in 20260126150000_tenant_isolation.sql)
-- - Index on organization_id
-- But is MISSING the trigger that auto-populates organization_id on INSERT

-- Create function to auto-populate organization_id on INSERT for tags
-- Tags table doesn't have sales_id, so we need a dedicated function
CREATE OR REPLACE FUNCTION set_tags_organization_id()
RETURNS TRIGGER AS $$
DECLARE
  current_org_id bigint;
BEGIN
  -- Get current user's organization_id
  SELECT organization_id INTO current_org_id
  FROM sales
  WHERE user_id = auth.uid();

  -- Set organization_id from current user's organization
  -- This is critical for tenant isolation
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := current_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-populate organization_id on INSERT
CREATE TRIGGER set_tags_organization_id_trigger
BEFORE INSERT ON tags
FOR EACH ROW
EXECUTE FUNCTION set_tags_organization_id();

-- Add comment for documentation
COMMENT ON TRIGGER set_tags_organization_id_trigger ON tags IS
  'Auto-populates organization_id from current user before INSERT. Required for multi-tenancy and RLS policies. Without this trigger, tag creation fails with 403 Forbidden because RLS policy requires organization_id = get_user_organization_id().';
