-- RLS Tenant Isolation Test Suite
-- Tests Row-Level Security policies for multi-tenancy data isolation

BEGIN;

-- TAP output plan
SELECT '1..11';

-- Clean up any existing test data (as superuser)
DELETE FROM contact_notes WHERE contact_id IN (9991, 9992);
DELETE FROM contacts WHERE id IN (9991, 9992);
DELETE FROM companies WHERE id IN (9991, 9992);
DELETE FROM sales WHERE id IN (9991, 9992);
DELETE FROM auth.users WHERE id IN ('f0000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM organizations WHERE id IN (9991, 9992);

-- ========================================
-- Test Setup: Create two organizations with users
-- ========================================

-- Create Organization 1
INSERT INTO organizations (id, name, slug, settings)
VALUES (9991, 'Test Org 1', 'test-org-1', '{}'::jsonb);

-- Create Organization 2
INSERT INTO organizations (id, name, slug, settings)
VALUES (9992, 'Test Org 2', 'test-org-2', '{}'::jsonb);

-- Create test users in auth.users first with metadata
-- The handle_new_user trigger will automatically create sales records
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('f0000000-0000-0000-0000-000000000001'::uuid, 'user1@org1.test',
   '{"first_name": "User", "last_name": "One", "organization_id": 9991}'::jsonb),
  ('f0000000-0000-0000-0000-000000000002'::uuid, 'user2@org2.test',
   '{"first_name": "User", "last_name": "Two", "organization_id": 9992}'::jsonb);

-- Update the sales IDs to match our test IDs
UPDATE sales SET id = 9991 WHERE user_id = 'f0000000-0000-0000-0000-000000000001'::uuid;
UPDATE sales SET id = 9992 WHERE user_id = 'f0000000-0000-0000-0000-000000000002'::uuid;

-- Create test data for each organization
INSERT INTO companies (id, name, organization_id, sales_id)
VALUES
  (9991, 'Company Org 1', 9991, 9991),
  (9992, 'Company Org 2', 9992, 9992);

INSERT INTO contacts (id, first_name, last_name, organization_id, sales_id, company_id)
VALUES
  (9991, 'Contact', 'Org1', 9991, 9991, 9991),
  (9992, 'Contact', 'Org2', 9992, 9992, 9992);

INSERT INTO contact_notes (contact_id, organization_id, sales_id, text)
VALUES
  (9991, 9991, 9991, 'Note for Org 1'),
  (9992, 9992, 9992, 'Note for Org 2');

-- ========================================
-- Helper function to check existence bypassing RLS (for tests)
-- ========================================
CREATE OR REPLACE FUNCTION test_contact_exists(contact_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS(SELECT 1 FROM contacts WHERE id = contact_id);
END;
$$;

-- ========================================
-- Switch to authenticated role to test RLS policies
-- ========================================
SET ROLE authenticated;

-- ========================================
-- Test 1: get_user_organization_id() function
-- ========================================
DO $$
DECLARE
  org_id bigint;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Get organization ID
  SELECT get_user_organization_id() INTO org_id;

  IF org_id != 9991 THEN
    RAISE EXCEPTION 'Test 1 Failed: Expected org_id 9991, got %', org_id;
  END IF;

  RAISE NOTICE 'Test 1 Passed: get_user_organization_id() returns correct org';
END $$;
SELECT 'ok 1 - get_user_organization_id() returns correct org';

-- ========================================
-- Test 2: SELECT isolation - User 1 can only see Org 1 data
-- ========================================
DO $$
DECLARE
  contact_count int;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Count contacts visible to user 1
  SELECT COUNT(*) INTO contact_count FROM contacts WHERE id IN (9991, 9992);

  IF contact_count != 1 THEN
    RAISE EXCEPTION 'Test 2 Failed: User 1 should see 1 contact, saw %', contact_count;
  END IF;

  -- Verify they can only see their own contact
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = 9991) THEN
    RAISE EXCEPTION 'Test 2 Failed: User 1 cannot see their own contact';
  END IF;

  IF EXISTS (SELECT 1 FROM contacts WHERE id = 9992) THEN
    RAISE EXCEPTION 'Test 2 Failed: User 1 can see Org 2 contact (data leak!)';
  END IF;

  RAISE NOTICE 'Test 2 Passed: SELECT properly isolated by organization';
END $$;
SELECT 'ok 2 - SELECT properly isolated by organization';

-- ========================================
-- Test 3: INSERT isolation - Cannot insert into another org
-- ========================================
DO $$
DECLARE
  insert_success boolean := false;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Try to insert into Org 2 (should fail)
  BEGIN
    INSERT INTO contacts (id, first_name, last_name, organization_id, sales_id, company_id)
    VALUES (9993, 'Bad', 'Contact', 9992, 9991, 9992);

    insert_success := true;
  EXCEPTION
    WHEN others THEN
      insert_success := false;
  END;

  IF insert_success THEN
    RAISE EXCEPTION 'Test 3 Failed: User 1 was able to insert into Org 2 (security breach!)';
  END IF;

  RAISE NOTICE 'Test 3 Passed: INSERT properly blocked cross-tenant';
END $$;
SELECT 'ok 3 - INSERT properly blocked cross-tenant';

-- ========================================
-- Test 4: UPDATE isolation - Cannot update another org's data
-- ========================================
DO $$
DECLARE
  update_success boolean := false;
  updated_count int;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Try to update Org 2 contact (should affect 0 rows due to RLS)
  UPDATE contacts
  SET first_name = 'Hacked'
  WHERE id = 9992;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE EXCEPTION 'Test 4 Failed: User 1 was able to update Org 2 data (security breach!)';
  END IF;

  -- Verify Org 2 data is unchanged
  IF EXISTS (SELECT 1 FROM contacts WHERE id = 9992 AND first_name = 'Hacked') THEN
    RAISE EXCEPTION 'Test 4 Failed: Org 2 data was modified';
  END IF;

  RAISE NOTICE 'Test 4 Passed: UPDATE properly blocked cross-tenant';
END $$;
SELECT 'ok 4 - UPDATE properly blocked cross-tenant';

-- ========================================
-- Test 5: DELETE isolation - Cannot delete another org's data
-- ========================================
DO $$
DECLARE
  deleted_count int;
  contact_exists_before boolean;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Verify contact exists before delete (using SECURITY DEFINER to bypass RLS)
  SELECT test_contact_exists(9992) INTO contact_exists_before;
  IF NOT contact_exists_before THEN
    RAISE EXCEPTION 'Test 5 Setup Failed: Contact 9992 does not exist before test';
  END IF;

  -- Try to delete Org 2 contact (should affect 0 rows due to RLS)
  DELETE FROM contacts WHERE id = 9992;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    RAISE EXCEPTION 'Test 5 Failed: User 1 was able to delete Org 2 data (security breach!)';
  END IF;

  -- Verify Org 2 contact still exists (using SECURITY DEFINER to bypass RLS)
  IF NOT test_contact_exists(9992) THEN
    RAISE EXCEPTION 'Test 5 Failed: Org 2 data was deleted';
  END IF;

  RAISE NOTICE 'Test 5 Passed: DELETE properly blocked cross-tenant';
END $$;
SELECT 'ok 5 - DELETE properly blocked cross-tenant';

-- ========================================
-- Test 6: Views respect tenant isolation
-- ========================================
DO $$
DECLARE
  contact_count int;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Count contacts visible via view
  SELECT COUNT(*) INTO contact_count
  FROM contacts_summary
  WHERE id IN (9991, 9992);

  IF contact_count != 1 THEN
    RAISE EXCEPTION 'Test 6 Failed: View shows % contacts, expected 1', contact_count;
  END IF;

  RAISE NOTICE 'Test 6 Passed: Views properly isolated by organization';
END $$;
SELECT 'ok 6 - Views properly isolated by organization';

-- ========================================
-- Test 7: Organizations table isolation
-- ========================================
DO $$
DECLARE
  org_count int;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Count organizations visible to user 1
  SELECT COUNT(*) INTO org_count FROM organizations WHERE id IN (9991, 9992);

  IF org_count != 1 THEN
    RAISE EXCEPTION 'Test 7 Failed: User 1 can see % organizations, expected 1', org_count;
  END IF;

  -- Verify they can only see their own org
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = 9991) THEN
    RAISE EXCEPTION 'Test 7 Failed: User 1 cannot see their own organization';
  END IF;

  IF EXISTS (SELECT 1 FROM organizations WHERE id = 9992) THEN
    RAISE EXCEPTION 'Test 7 Failed: User 1 can see Org 2 (data leak!)';
  END IF;

  RAISE NOTICE 'Test 7 Passed: Organizations table properly isolated';
END $$;
SELECT 'ok 7 - Organizations table properly isolated';

-- ========================================
-- Test 8: All tables have organization_id
-- ========================================
DO $$
DECLARE
  missing_columns text[];
BEGIN
  SELECT array_agg(table_name)
  INTO missing_columns
  FROM information_schema.tables t
  WHERE t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
    AND t.table_name IN ('sales', 'companies', 'contacts', 'contact_notes', 'deals', 'deal_notes', 'tasks', 'tags')
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = t.table_name
        AND c.column_name = 'organization_id'
    );

  IF array_length(missing_columns, 1) > 0 THEN
    RAISE EXCEPTION 'Test 8 Failed: Tables missing organization_id: %', array_to_string(missing_columns, ', ');
  END IF;

  RAISE NOTICE 'Test 8 Passed: All tables have organization_id column';
END $$;
SELECT 'ok 8 - All tables have organization_id column';

-- ========================================
-- Test 9: All tables have organization_id indexes
-- ========================================
DO $$
DECLARE
  missing_indexes text[];
BEGIN
  SELECT array_agg(tablename)
  INTO missing_indexes
  FROM (
    SELECT DISTINCT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('sales', 'companies', 'contacts', 'contact_notes', 'deals', 'deal_notes', 'tasks', 'tags')
  ) t
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = t.tablename
      AND indexdef LIKE '%organization_id%'
  );

  IF array_length(missing_indexes, 1) > 0 THEN
    RAISE EXCEPTION 'Test 9 Failed: Tables missing organization_id index: %', array_to_string(missing_indexes, ', ');
  END IF;

  RAISE NOTICE 'Test 9 Passed: All tables have organization_id indexes';
END $$;
SELECT 'ok 9 - All tables have organization_id indexes';

-- ========================================
-- Test 10: Trigger auto-populates organization_id
-- ========================================
DO $$
DECLARE
  test_contact_id bigint;
  org_id bigint;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Insert contact without specifying organization_id
  INSERT INTO contacts (first_name, last_name, sales_id, company_id)
  VALUES ('Auto', 'Populated', 9991, 9991)
  RETURNING id INTO test_contact_id;

  -- Check if organization_id was auto-populated
  SELECT organization_id INTO org_id FROM contacts WHERE id = test_contact_id;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Test 10 Failed: organization_id was not auto-populated';
  END IF;

  IF org_id != 9991 THEN
    RAISE EXCEPTION 'Test 10 Failed: organization_id was auto-populated with wrong value: %', org_id;
  END IF;

  -- Clean up
  DELETE FROM contacts WHERE id = test_contact_id;

  RAISE NOTICE 'Test 10 Passed: Trigger auto-populates organization_id correctly';
END $$;
SELECT 'ok 10 - Trigger auto-populates organization_id correctly';

-- ========================================
-- Test 11: Tags trigger auto-populates organization_id
-- ========================================
DO $$
DECLARE
  test_tag_id bigint;
  org_id bigint;
BEGIN
  -- Set JWT claim to simulate user 1
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Insert tag without specifying organization_id
  -- This tests the fix for the contact import bug: missing trigger on tags table
  INSERT INTO tags (name, color)
  VALUES ('Auto Tag Test', '#000000')
  RETURNING id INTO test_tag_id;

  -- Check if organization_id was auto-populated by the trigger
  SELECT organization_id INTO org_id FROM tags WHERE id = test_tag_id;

  IF org_id IS NULL THEN
    RAISE EXCEPTION 'Test 11 Failed: organization_id was not auto-populated for tags (trigger missing or failed)';
  END IF;

  IF org_id != 9991 THEN
    RAISE EXCEPTION 'Test 11 Failed: organization_id was auto-populated with wrong value: % (expected 9991)', org_id;
  END IF;

  -- Clean up
  DELETE FROM tags WHERE id = test_tag_id;

  RAISE NOTICE 'Test 11 Passed: Tags trigger auto-populates organization_id correctly';
END $$;
SELECT 'ok 11 - Tags trigger auto-populates organization_id correctly';

-- ========================================
-- Switch back to superuser for cleanup
-- ========================================
RESET ROLE;

-- ========================================
-- Clean up test data
-- ========================================
DELETE FROM contact_notes WHERE contact_id IN (9991, 9992);
DELETE FROM contacts WHERE id IN (9991, 9992);
DELETE FROM companies WHERE id IN (9991, 9992);
DELETE FROM sales WHERE id IN (9991, 9992);
DELETE FROM auth.users WHERE id IN ('f0000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM organizations WHERE id IN (9991, 9992);

-- Drop helper function
DROP FUNCTION IF EXISTS test_contact_exists(bigint);

DO $$
BEGIN
  RAISE NOTICE '===========================================';
  RAISE NOTICE 'All RLS Tenant Isolation Tests Passed! ✅';
  RAISE NOTICE '===========================================';
END $$;

ROLLBACK;
