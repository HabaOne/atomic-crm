-- Migration: Update RLS function to support API key authentication
-- This enables API keys to work alongside JWT-based authentication

-- ========================================
-- UPDATE get_user_organization_id() FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  org_id bigint;
  api_key_org_id text;
  is_master_key text;
BEGIN
  -- PRIORITY 1: Check for API key context (set by edge function via session variables)
  api_key_org_id := current_setting('app.api_key_organization_id', true);
  is_master_key := current_setting('app.api_key_is_master', true);

  IF is_master_key = 'true' THEN
    -- Master API key: return NULL to signal bypass
    -- Master key policies will handle access
    RETURN NULL;
  ELSIF api_key_org_id IS NOT NULL AND api_key_org_id != '' THEN
    -- Organization API key: return the org_id from session variable
    RETURN api_key_org_id::bigint;
  END IF;

  -- PRIORITY 2: JWT-based authentication (existing behavior)
  -- Extract organization_id from sales table using auth.uid() from JWT
  SELECT organization_id INTO org_id
  FROM sales
  WHERE user_id = auth.uid();

  RETURN org_id;
END;
$$;

-- Update comment for documentation
COMMENT ON FUNCTION get_user_organization_id() IS
  'Returns organization_id for current user. Supports both JWT tokens (via auth.uid()) and API keys (via session variables). Returns NULL for master API keys to signal RLS bypass.';
