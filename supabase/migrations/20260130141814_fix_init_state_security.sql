-- ==========================================================================
-- Fix: Replace init_state view with a constrained SECURITY DEFINER function
--
-- Problem: init_state view has security_invoker=off (bypasses RLS)
--          Flagged by Supabase Security Advisor
--
-- Solution: Use a minimal SECURITY DEFINER function with explicit permissions
--
-- This is the recommended pattern for controlled privilege escalation:
-- - Function has SECURITY DEFINER (explicit, auditable)
-- - SET search_path = '' prevents path manipulation attacks
-- - Only returns COUNT (0 or 1), not actual data
-- - Explicit GRANT limits who can call it
-- - View wrapper maintains backward compatibility
--
-- Risk assessment: LOW
-- - Only exposes whether at least one user exists
-- - Does NOT expose PII, emails, names, or organization data
-- - Required for signup/login flow to detect first-time setup
-- ==========================================================================

-- Step 1: Drop the existing view
DROP VIEW IF EXISTS init_state;

-- Step 2: Create a SECURITY DEFINER function (auditable, explicit)
CREATE OR REPLACE FUNCTION get_init_state()
RETURNS TABLE(is_initialized integer)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.sales LIMIT 1)
    THEN 1
    ELSE 0
  END AS is_initialized;
$$;

-- Step 3: Restrict access - only anon and authenticated can call
REVOKE ALL ON FUNCTION get_init_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_init_state() TO anon;
GRANT EXECUTE ON FUNCTION get_init_state() TO authenticated;

-- Step 4: Recreate as a view that wraps the function (for backward compatibility)
CREATE VIEW init_state
  WITH (security_invoker=on)
AS
SELECT * FROM get_init_state();

-- Step 5: Grant view access
GRANT SELECT ON init_state TO anon;
GRANT SELECT ON init_state TO authenticated;

-- Step 6: Add documentation
COMMENT ON FUNCTION get_init_state() IS
  'Returns 1 if CRM has any users, 0 otherwise. SECURITY DEFINER is intentional - allows anon to check initialization status without exposing user data.';

COMMENT ON VIEW init_state IS
  'Wrapper view for get_init_state(). Used by login flow to detect first-time setup.';
