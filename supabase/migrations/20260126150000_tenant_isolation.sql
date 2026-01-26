-- Migration 5: Tenant isolation with RLS policies
-- ⚠️ CRITICAL FOR SECURITY - This enforces data isolation between organizations

-- Helper function to get current user's organization
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

-- Add comment for documentation
COMMENT ON FUNCTION get_user_organization_id() IS 'Returns the organization_id of the current authenticated user. Used by RLS policies for tenant isolation.';

-- ========================================
-- CONTACTS TABLE - Tenant isolation policies
-- ========================================

-- Drop old permissive policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON contacts;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON contacts;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON contacts;
DROP POLICY IF EXISTS "Contact Delete Policy" ON contacts;

-- Create tenant-aware policies
CREATE POLICY "tenant_isolation_select" ON contacts
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_insert" ON contacts
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_update" ON contacts
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_delete" ON contacts
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ========================================
-- CONTACT_NOTES TABLE - Tenant isolation policies
-- ========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON contact_notes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON contact_notes;
DROP POLICY IF EXISTS "Contact Notes Update policy" ON contact_notes;
DROP POLICY IF EXISTS "Contact Notes Delete Policy" ON contact_notes;

CREATE POLICY "tenant_isolation_select" ON contact_notes
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_insert" ON contact_notes
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_update" ON contact_notes
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_delete" ON contact_notes
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ========================================
-- COMPANIES TABLE - Tenant isolation policies
-- ========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON companies;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON companies;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON companies;
DROP POLICY IF EXISTS "Company Delete Policy" ON companies;

CREATE POLICY "tenant_isolation_select" ON companies
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_insert" ON companies
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_update" ON companies
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_delete" ON companies
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ========================================
-- DEALS TABLE - Tenant isolation policies
-- ========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON deals;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON deals;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON deals;
DROP POLICY IF EXISTS "Deals Delete Policy" ON deals;

CREATE POLICY "tenant_isolation_select" ON deals
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_insert" ON deals
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_update" ON deals
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_delete" ON deals
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ========================================
-- DEAL_NOTES TABLE - Tenant isolation policies
-- ========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON deal_notes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON deal_notes;
DROP POLICY IF EXISTS "Deal Notes Update Policy" ON deal_notes;
DROP POLICY IF EXISTS "Deal Notes Delete Policy" ON deal_notes;

CREATE POLICY "tenant_isolation_select" ON deal_notes
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_insert" ON deal_notes
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_update" ON deal_notes
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_delete" ON deal_notes
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ========================================
-- TASKS TABLE - Tenant isolation policies
-- ========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON tasks;
DROP POLICY IF EXISTS "Task Update Policy" ON tasks;
DROP POLICY IF EXISTS "Task Delete Policy" ON tasks;

CREATE POLICY "tenant_isolation_select" ON tasks
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_insert" ON tasks
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_update" ON tasks
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_delete" ON tasks
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ========================================
-- TAGS TABLE - Tenant isolation policies
-- ========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON tags;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON tags;
DROP POLICY IF EXISTS "Enable update for authenticated users only" ON tags;
DROP POLICY IF EXISTS "Enable delete for authenticated users only" ON tags;

CREATE POLICY "tenant_isolation_select" ON tags
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_insert" ON tags
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_update" ON tags
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "tenant_isolation_delete" ON tags
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- ========================================
-- SALES TABLE - Tenant isolation policies
-- Note: Sales management (INSERT/UPDATE/DELETE) is handled by Edge functions
-- which check administrator status. RLS only enforces org boundary.
-- ========================================

DROP POLICY IF EXISTS "Enable read access for authenticated users" ON sales;

CREATE POLICY "tenant_isolation_select" ON sales
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

-- INSERT handled by trigger on auth.users (handle_new_user)
-- UPDATE/DELETE handled by Edge functions with admin checks

-- ========================================
-- ORGANIZATIONS TABLE - Update policy
-- Replace temp policy with proper tenant-aware policy
-- ========================================

DROP POLICY IF EXISTS "temp_allow_all" ON organizations;
DROP POLICY IF EXISTS "users_see_own_org" ON organizations;

CREATE POLICY "tenant_isolation_select" ON organizations
  FOR SELECT TO authenticated
  USING (id = get_user_organization_id());

-- UPDATE for organizations handled by Edge function with admin check
