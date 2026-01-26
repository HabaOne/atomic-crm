-- Performance Analysis for Multi-Tenancy Implementation
-- This script analyzes query performance and verifies index usage

BEGIN;

-- Create test organizations and data for performance testing
INSERT INTO organizations (id, name, slug, settings)
VALUES
  (9001, 'Perf Test Org 1', 'perf-org-1', '{}'::jsonb),
  (9002, 'Perf Test Org 2', 'perf-org-2', '{}'::jsonb);

-- Create test users
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES
  ('a0000000-0000-0000-0000-000000000001'::uuid, 'perfuser1@test.com',
   '{"first_name": "Perf", "last_name": "User1", "organization_id": 9001}'::jsonb),
  ('a0000000-0000-0000-0000-000000000002'::uuid, 'perfuser2@test.com',
   '{"first_name": "Perf", "last_name": "User2", "organization_id": 9002}'::jsonb);

-- Get the sales IDs created by trigger
DO $$
DECLARE
  sales_id_1 bigint;
  sales_id_2 bigint;
BEGIN
  SELECT id INTO sales_id_1 FROM sales WHERE user_id = 'a0000000-0000-0000-0000-000000000001'::uuid;
  SELECT id INTO sales_id_2 FROM sales WHERE user_id = 'a0000000-0000-0000-0000-000000000002'::uuid;

  -- Create test companies
  INSERT INTO companies (organization_id, sales_id, name)
  SELECT 9001, sales_id_1, 'Company ' || generate_series(1, 100);

  INSERT INTO companies (organization_id, sales_id, name)
  SELECT 9002, sales_id_2, 'Company ' || generate_series(1, 100);

  -- Create test contacts
  INSERT INTO contacts (organization_id, sales_id, first_name, last_name)
  SELECT 9001, sales_id_1, 'Contact', 'User' || generate_series(1, 500);

  INSERT INTO contacts (organization_id, sales_id, first_name, last_name)
  SELECT 9002, sales_id_2, 'Contact', 'User' || generate_series(1, 500);

  RAISE NOTICE 'Created test data: 200 companies, 1000 contacts';
END $$;

-- ========================================
-- Performance Test 1: Index Usage on Contacts
-- ========================================
\echo '=== Test 1: Contacts SELECT with organization_id filter ==='
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001"}'::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM contacts WHERE organization_id = 9001 LIMIT 10;

RESET ROLE;

-- ========================================
-- Performance Test 2: Index Usage on Companies
-- ========================================
\echo '=== Test 2: Companies SELECT with organization_id filter ==='
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001"}'::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM companies WHERE organization_id = 9001 LIMIT 10;

RESET ROLE;

-- ========================================
-- Performance Test 3: View Performance (contacts_summary)
-- ========================================
\echo '=== Test 3: contacts_summary view performance ==='
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001"}'::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM contacts_summary LIMIT 10;

RESET ROLE;

-- ========================================
-- Performance Test 4: RLS Policy Overhead
-- ========================================
\echo '=== Test 4: RLS function call overhead ==='
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001"}'::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS)
SELECT get_user_organization_id();

RESET ROLE;

-- ========================================
-- Performance Test 5: JOIN with organization_id
-- ========================================
\echo '=== Test 5: JOIN performance with organization_id ==='
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub": "a0000000-0000-0000-0000-000000000001"}'::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS)
SELECT c.*, co.name as company_name
FROM contacts c
LEFT JOIN companies co ON c.company_id = co.id AND c.organization_id = co.organization_id
WHERE c.organization_id = 9001
LIMIT 10;

RESET ROLE;

-- ========================================
-- Index Statistics
-- ========================================
\echo '=== Index Usage Statistics ==='
RESET ROLE;

SELECT
  schemaname,
  relname as tablename,
  indexrelname as indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE indexrelname LIKE '%organization_id%'
ORDER BY relname, indexrelname;

-- ========================================
-- Table Statistics
-- ========================================
\echo '=== Table Statistics ==='
SELECT
  schemaname,
  relname as tablename,
  seq_scan as sequential_scans,
  seq_tup_read as seq_tuples_read,
  idx_scan as index_scans,
  idx_tup_fetch as idx_tuples_fetched,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables
WHERE relname IN ('organizations', 'sales', 'companies', 'contacts', 'contact_notes', 'deals', 'deal_notes', 'tasks', 'tags')
ORDER BY relname;

-- ========================================
-- Verify All Indexes Exist
-- ========================================
\echo '=== Verify organization_id Indexes ==='
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE '%organization_id%'
ORDER BY tablename;

-- Clean up test data
RESET ROLE;
DELETE FROM contacts WHERE organization_id IN (9001, 9002);
DELETE FROM companies WHERE organization_id IN (9001, 9002);
DELETE FROM sales WHERE organization_id IN (9001, 9002);
DELETE FROM auth.users WHERE id IN ('a0000000-0000-0000-0000-000000000001'::uuid, 'a0000000-0000-0000-0000-000000000002'::uuid);
DELETE FROM organizations WHERE id IN (9001, 9002);

\echo '=== Performance Analysis Complete ==='

ROLLBACK;
