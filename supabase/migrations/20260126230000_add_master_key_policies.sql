-- Migration: Add master API key bypass policies to all tables
-- Master keys can access data across all organizations

-- ========================================
-- HELPER FUNCTION
-- ========================================

CREATE OR REPLACE FUNCTION is_master_api_key()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN current_setting('app.api_key_is_master', true) = 'true';
END;
$$;

COMMENT ON FUNCTION is_master_api_key() IS
  'Returns true if current request is authenticated with a master API key. Master keys bypass tenant isolation.';

-- ========================================
-- CONTACTS TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON contacts
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- CONTACT_NOTES TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON contact_notes
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- COMPANIES TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON companies
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- DEALS TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON deals
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- DEAL_NOTES TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON deal_notes
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- TASKS TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON tasks
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- TAGS TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON tags
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- SALES TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON sales
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- ORGANIZATIONS TABLE - Master key bypass
-- ========================================

CREATE POLICY "master_key_full_access" ON organizations
  FOR ALL TO authenticated
  USING (is_master_api_key())
  WITH CHECK (is_master_api_key());

-- ========================================
-- HOW IT WORKS
-- ========================================
-- PostgreSQL evaluates RLS policies with OR logic:
--   - Policy 1: organization_id = get_user_organization_id() (tenant isolation)
--   - Policy 2: is_master_api_key() = true (master bypass)
-- If EITHER policy passes, access is granted.
--
-- For master keys:
--   - is_master_api_key() returns true
--   - get_user_organization_id() returns NULL
--   - Policy 2 passes, granting full access
--
-- For organization keys:
--   - is_master_api_key() returns false
--   - get_user_organization_id() returns org_id
--   - Policy 1 passes, granting org-scoped access
--
-- For JWT users:
--   - is_master_api_key() returns false
--   - get_user_organization_id() returns org_id from sales table
--   - Policy 1 passes, granting org-scoped access
