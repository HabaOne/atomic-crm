-- Remove API key infrastructure
-- This migration removes all API key related tables, functions, and policies
-- Existing API keys will be permanently deleted - this is intentional

-- Remove master key policies from all tables FIRST (they depend on is_master_api_key function)
DROP POLICY IF EXISTS "master_key_full_access" ON contacts;
DROP POLICY IF EXISTS "master_key_full_access" ON contact_notes;
DROP POLICY IF EXISTS "master_key_full_access" ON companies;
DROP POLICY IF EXISTS "master_key_full_access" ON deals;
DROP POLICY IF EXISTS "master_key_full_access" ON deal_notes;
DROP POLICY IF EXISTS "master_key_full_access" ON tasks;
DROP POLICY IF EXISTS "master_key_full_access" ON tags;
DROP POLICY IF EXISTS "master_key_full_access" ON sales;
DROP POLICY IF EXISTS "master_key_full_access" ON organizations;
-- Note: activities table may not exist, so we skip it

-- Drop API keys table (existing keys will be deleted)
DROP TABLE IF EXISTS api_keys CASCADE;

-- Remove is_service_account column from sales
ALTER TABLE sales DROP COLUMN IF EXISTS is_service_account;

-- Remove is_master_api_key() function (now safe since policies are gone)
DROP FUNCTION IF EXISTS is_master_api_key();

-- Revert get_user_organization_id() to simple version (removes API key session var checks)
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  org_id bigint;
BEGIN
  SELECT organization_id INTO org_id
  FROM sales
  WHERE user_id = auth.uid();

  RETURN org_id;
END;
$$;
