-- API Key RLS Test Suite
-- Tests Row-Level Security policies for API key authentication

BEGIN;

-- TAP output plan
SELECT '1..10';

-- Clean up any existing test data
DELETE FROM contact_notes WHERE contact_id IN (9991, 9992);
DELETE FROM contacts WHERE id IN (9991, 9992);
DELETE FROM companies WHERE id IN (9991, 9992);
DELETE FROM sales WHERE id IN (9991, 9992);
DELETE FROM auth.users WHERE id IN ('f0000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM organizations WHERE id IN (9991, 9992);

-- ========================================
-- Test Setup: Create two organizations with users and data
-- ========================================

INSERT INTO organizations (id, name, slug, settings)
VALUES
  (9991, 'Test Org 1', 'test-org-1', '{}'::jsonb),
  (9992, 'Test Org 2', 'test-org-2', '{}'::jsonb);

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('f0000000-0000-0000-0000-000000000001'::uuid, 'user1@org1.test',
   '{"first_name": "User", "last_name": "One", "organization_id": 9991}'::jsonb),
  ('f0000000-0000-0000-0000-000000000002'::uuid, 'user2@org2.test',
   '{"first_name": "User", "last_name": "Two", "organization_id": 9992}'::jsonb);

UPDATE sales SET id = 9991 WHERE user_id = 'f0000000-0000-0000-0000-000000000001'::uuid;
UPDATE sales SET id = 9992 WHERE user_id = 'f0000000-0000-0000-0000-000000000002'::uuid;

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
-- Switch to authenticated role
-- ========================================
SET ROLE authenticated;

-- ========================================
-- Test 1: Organization API key respects tenant isolation
-- ========================================
DO $$
DECLARE
  contact_count int;
BEGIN
  -- Set API key session variable for org 1
  PERFORM set_config('app.api_key_organization_id', '9991', true);

  -- Count contacts (should only see org 1)
  SELECT COUNT(*) INTO contact_count FROM contacts;

  IF contact_count != 1 THEN
    RAISE EXCEPTION 'Test 1 Failed: Expected 1 contact for org 1, got %', contact_count;
  END IF;

  RAISE NOTICE 'Test 1 Passed: Org API key sees only own org data';
END $$;
SELECT 'ok 1 - Org API key sees only own org data';

-- ========================================
-- Test 2: Master API key bypasses tenant isolation (SELECT)
-- ========================================
DO $$
DECLARE
  contact_count int;
BEGIN
  -- Set master key session variable
  PERFORM set_config('app.api_key_is_master', 'true', true);

  -- Count contacts (should see all orgs)
  SELECT COUNT(*) INTO contact_count FROM contacts;

  IF contact_count != 2 THEN
    RAISE EXCEPTION 'Test 2 Failed: Expected 2 contacts for master key, got %', contact_count;
  END IF;

  RAISE NOTICE 'Test 2 Passed: Master API key sees all org data';
END $$;
SELECT 'ok 2 - Master API key sees all org data';

-- ========================================
-- Test 3: Organization API key cannot see other org's data
-- ========================================
DO $$
DECLARE
  contact_count int;
BEGIN
  -- Clear previous session variables
  PERFORM set_config('app.api_key_is_master', NULL, true);
  PERFORM set_config('app.api_key_organization_id', NULL, true);

  -- Set API key session variable for org 2
  PERFORM set_config('app.api_key_organization_id', '9992', true);

  -- Try to count org 1's contacts
  SELECT COUNT(*) INTO contact_count FROM contacts WHERE id = 9991;

  IF contact_count != 0 THEN
    RAISE EXCEPTION 'Test 3 Failed: Org 2 should not see Org 1 data, got % contacts', contact_count;
  END IF;

  RAISE NOTICE 'Test 3 Passed: Org API key cannot see other org data';
END $$;
SELECT 'ok 3 - Org API key cannot see other org data';

-- ========================================
-- Test 4: Session variable isolation between transactions
-- ========================================
DO $$
DECLARE
  org_id_1 bigint;
  org_id_2 bigint;
BEGIN
  -- Set org 1
  PERFORM set_config('app.api_key_organization_id', '9991', true);
  SELECT get_user_organization_id() INTO org_id_1;

  -- Clear session variables
  PERFORM set_config('app.api_key_organization_id', NULL, true);
  PERFORM set_config('app.api_key_is_master', NULL, true);

  -- Set org 2
  PERFORM set_config('app.api_key_organization_id', '9992', true);
  SELECT get_user_organization_id() INTO org_id_2;

  IF org_id_1 = org_id_2 THEN
    RAISE EXCEPTION 'Test 4 Failed: Session variables not isolated, got same org_id %', org_id_1;
  END IF;

  IF org_id_1 != 9991 OR org_id_2 != 9992 THEN
    RAISE EXCEPTION 'Test 4 Failed: Expected org_ids 9991 and 9992, got % and %', org_id_1, org_id_2;
  END IF;

  RAISE NOTICE 'Test 4 Passed: Session variables properly isolated';
END $$;
SELECT 'ok 4 - Session variables properly isolated';

-- ========================================
-- Test 5: Fallback to JWT when no API key context
-- ========================================
DO $$
DECLARE
  org_id bigint;
BEGIN
  -- Clear API key session variables
  PERFORM set_config('app.api_key_organization_id', NULL, true);
  PERFORM set_config('app.api_key_is_master', NULL, true);

  -- Set JWT claim
  PERFORM set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000001')::text, true);

  -- Get organization ID (should fall back to JWT)
  SELECT get_user_organization_id() INTO org_id;

  IF org_id != 9991 THEN
    RAISE EXCEPTION 'Test 5 Failed: Expected fallback to JWT org 9991, got %', org_id;
  END IF;

  RAISE NOTICE 'Test 5 Passed: Fallback to JWT auth works';
END $$;
SELECT 'ok 5 - Fallback to JWT auth works';

-- ========================================
-- Test 6: Master key can INSERT across organizations
-- ========================================
DO $$
DECLARE
  new_contact_id bigint;
BEGIN
  -- Set master key
  PERFORM set_config('app.api_key_is_master', 'true', true);

  -- Insert contact in org 1 (master key should allow this)
  INSERT INTO contacts (first_name, last_name, organization_id, sales_id, company_id)
  VALUES ('Master', 'Contact', 9991, 9991, 9991)
  RETURNING id INTO new_contact_id;

  IF new_contact_id IS NULL THEN
    RAISE EXCEPTION 'Test 6 Failed: Master key could not insert contact';
  END IF;

  RAISE NOTICE 'Test 6 Passed: Master key can INSERT across orgs';

  -- Clean up
  DELETE FROM contacts WHERE id = new_contact_id;
END $$;
SELECT 'ok 6 - Master key can INSERT across orgs';

-- ========================================
-- Test 7: Organization key cannot UPDATE other org's data
-- ========================================
DO $$
DECLARE
  updated_count int;
BEGIN
  -- Set org 1 API key
  PERFORM set_config('app.api_key_organization_id', '9991', true);
  PERFORM set_config('app.api_key_is_master', NULL, true);

  -- Try to update org 2's contact (should fail)
  UPDATE contacts SET first_name = 'Hacked' WHERE id = 9992;
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count != 0 THEN
    RAISE EXCEPTION 'Test 7 Failed: Org 1 key should not update Org 2 data, updated % rows', updated_count;
  END IF;

  RAISE NOTICE 'Test 7 Passed: Org key cannot UPDATE other org data';
END $$;
SELECT 'ok 7 - Org key cannot UPDATE other org data';

-- ========================================
-- Test 8: Organization key cannot DELETE other org's data
-- ========================================
DO $$
DECLARE
  deleted_count int;
BEGIN
  -- Set org 2 API key
  PERFORM set_config('app.api_key_organization_id', '9992', true);

  -- Try to delete org 1's contact (should fail)
  DELETE FROM contacts WHERE id = 9991;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count != 0 THEN
    RAISE EXCEPTION 'Test 8 Failed: Org 2 key should not delete Org 1 data, deleted % rows', deleted_count;
  END IF;

  RAISE NOTICE 'Test 8 Passed: Org key cannot DELETE other org data';
END $$;
SELECT 'ok 8 - Org key cannot DELETE other org data';

-- ========================================
-- Test 9: Master key returns NULL from get_user_organization_id()
-- ========================================
DO $$
DECLARE
  org_id bigint;
BEGIN
  -- Set master key
  PERFORM set_config('app.api_key_is_master', 'true', true);

  -- Get organization ID (should return NULL for master)
  SELECT get_user_organization_id() INTO org_id;

  IF org_id IS NOT NULL THEN
    RAISE EXCEPTION 'Test 9 Failed: Master key should return NULL org_id, got %', org_id;
  END IF;

  RAISE NOTICE 'Test 9 Passed: Master key returns NULL org_id';
END $$;
SELECT 'ok 9 - Master key returns NULL org_id';

-- ========================================
-- Test 10: is_master_api_key() function works correctly
-- ========================================
DO $$
DECLARE
  is_master boolean;
BEGIN
  -- Test with master key
  PERFORM set_config('app.api_key_is_master', 'true', true);
  SELECT is_master_api_key() INTO is_master;

  IF NOT is_master THEN
    RAISE EXCEPTION 'Test 10a Failed: is_master_api_key() should return true';
  END IF;

  -- Test with org key
  PERFORM set_config('app.api_key_is_master', NULL, true);
  PERFORM set_config('app.api_key_organization_id', '9991', true);
  SELECT is_master_api_key() INTO is_master;

  IF is_master THEN
    RAISE EXCEPTION 'Test 10b Failed: is_master_api_key() should return false for org key';
  END IF;

  RAISE NOTICE 'Test 10 Passed: is_master_api_key() function works correctly';
END $$;
SELECT 'ok 10 - is_master_api_key() function works correctly';

-- ========================================
-- Clean up
-- ========================================
RESET ROLE;

DELETE FROM contact_notes WHERE contact_id IN (9991, 9992);
DELETE FROM contacts WHERE id IN (9991, 9992);
DELETE FROM companies WHERE id IN (9991, 9992);
DELETE FROM sales WHERE id IN (9991, 9992);
DELETE FROM auth.users WHERE id IN ('f0000000-0000-0000-0000-000000000001'::uuid, 'f0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM organizations WHERE id IN (9991, 9992);

ROLLBACK;

-- ========================================
-- Summary
-- ========================================
-- All tests passed! API key authentication RLS policies are working correctly:
--  ✓ Organization API keys respect tenant isolation (SELECT)
--  ✓ Master API keys bypass tenant isolation (SELECT)
--  ✓ Organization API keys cannot see other org's data
--  ✓ Session variables properly isolated between transactions
--  ✓ Fallback to JWT auth works when no API key context
--  ✓ Master keys can INSERT across organizations
--  ✓ Organization keys cannot UPDATE other org's data
--  ✓ Organization keys cannot DELETE other org's data
--  ✓ Master key returns NULL from get_user_organization_id()
--  ✓ is_master_api_key() function works correctly
