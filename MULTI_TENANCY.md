# Multi-Tenancy Implementation Guide

## Overview

Atomic CRM implements **Row-Level Security (RLS) based multi-tenancy** to provide secure data isolation between organizations. This document describes the architecture, implementation details, and development guidelines.

## Architecture

### Design Principles

1. **One Organization Per User**: Each user belongs to exactly one organization (no organization switching)
2. **Database-Level Isolation**: RLS policies enforce tenant boundaries at the PostgreSQL level
3. **Automatic Context**: Triggers auto-populate `organization_id` on INSERT operations
4. **Performance First**: All queries optimized with proper indexing
5. **Developer Friendly**: Frontend code remains simple - RLS handles complexity

### Data Model

```
organizations
├── id (PK)
├── name
├── slug (unique)
├── settings (JSONB) - stores all configuration
├── disabled
├── logo_light (JSONB)
└── logo_dark (JSONB)

sales (users)
├── id (PK)
├── user_id (FK → auth.users)
├── organization_id (FK → organizations) ← Links user to organization
├── email
├── first_name
├── last_name
└── administrator

All data tables:
├── id (PK)
├── organization_id (FK → organizations) ← Required on all tables
└── ... (other fields)
```

### Row-Level Security (RLS)

Every data table has 4 RLS policies:

```sql
-- SELECT: Users can only see their organization's data
CREATE POLICY "tenant_isolation_select" ON {table}
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

-- INSERT: Users can only insert into their organization
CREATE POLICY "tenant_isolation_insert" ON {table}
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

-- UPDATE: Users can only update their organization's data
CREATE POLICY "tenant_isolation_update" ON {table}
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- DELETE: Users can only delete their organization's data
CREATE POLICY "tenant_isolation_delete" ON {table}
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());
```

### Helper Function

```sql
CREATE FUNCTION get_user_organization_id()
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
```

This function:
- Reads the current user's ID from JWT claims (`auth.uid()`)
- Looks up their organization_id in the sales table
- Returns the organization_id for use in RLS policies
- Executes with SECURITY DEFINER to bypass RLS on sales table lookup

### Automatic Context Population

Triggers ensure developers don't need to manually set `organization_id`:

```sql
CREATE FUNCTION set_sales_id_default()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-populate sales_id from current user
  IF NEW.sales_id IS NULL THEN
    SELECT id INTO NEW.sales_id FROM sales WHERE user_id = auth.uid();
  END IF;

  -- Auto-populate organization_id from current user's organization
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM sales WHERE user_id = auth.uid();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all data tables
CREATE TRIGGER set_organization_id_trigger
  BEFORE INSERT ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION set_sales_id_default();
```

## Frontend Integration

### Organization Context

The `OrganizationContext` provides organization state throughout the app:

```typescript
// src/components/atomic-crm/root/OrganizationContext.tsx

export interface Organization {
  id: number;
  name: string;
  slug: string;
  settings: Partial<ConfigurationContextValue>;
  logo_light?: { src: string };
  logo_dark?: { src: string };
}

// Provider fetches current user's organization
export const OrganizationProvider = ({ children }) => {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const dataProvider = useDataProvider();

  useEffect(() => {
    // RLS automatically filters to user's organization
    dataProvider.getList("organizations", {
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    }).then(({ data }) => {
      if (data.length > 0) {
        setOrganization(data[0]);
      }
    });
  }, []);

  return (
    <OrganizationContext.Provider value={{ organization, loading, refetch }}>
      {children}
    </OrganizationContext.Provider>
  );
};

// Hook for organization configuration with fallbacks
export const useOrganizationConfiguration = (): ConfigurationContextValue => {
  const { organization } = useOrganization();

  return {
    companySectors: organization?.settings?.companySectors || defaultCompanySectors,
    dealCategories: organization?.settings?.dealCategories || defaultDealCategories,
    // ... other config with fallbacks
  };
};
```

### Usage in Components

```typescript
// Access organization state
const { organization, loading } = useOrganization();

// Access configuration (with defaults as fallback)
const config = useOrganizationConfiguration();

// Use configuration
<Select>
  {config.companySectors.map(sector => (
    <option key={sector}>{sector}</option>
  ))}
</Select>
```

### Organization Settings Page

Admin-only page at `/settings/organization`:

```typescript
// src/components/atomic-crm/settings/OrganizationSettingsPage.tsx

export const OrganizationSettingsPage = () => {
  const { organization, refetch } = useOrganization();
  const dataProvider = useDataProvider();
  const { permissions } = usePermissions();

  // Restrict to admins only
  if (!permissions?.administrator) {
    return <Navigate to="/" />;
  }

  const handleSave = async (data: Partial<Organization>) => {
    await dataProvider.update("organizations", {
      id: organization!.id,
      data: {
        name: data.name,
        settings: data.settings,
        logo_light: data.logo_light,
        logo_dark: data.logo_dark,
      },
      previousData: organization,
    });

    await refetch();
  };

  return (
    <Form defaultValues={organization} onSubmit={handleSave}>
      <TextInput source="name" label="Organization Name" />
      <ArrayInput source="settings.companySectors">
        <SimpleFormIterator>
          <TextInput source="" />
        </SimpleFormIterator>
      </ArrayInput>
      {/* ... other settings */}
    </Form>
  );
};
```

## User Onboarding

### First Signup (Organization Creation)

When the first user signs up, the system automatically creates a new organization:

```sql
-- In handle_new_user() trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  org_id bigint;
  is_admin boolean;
BEGIN
  -- Check if organization_id provided in metadata (invitation flow)
  org_id := (new.raw_user_meta_data ->> 'organization_id')::bigint;

  -- If no organization_id, create new organization (first signup)
  IF org_id IS NULL THEN
    INSERT INTO public.organizations (name, slug, settings)
    VALUES (
      COALESCE(new.raw_user_meta_data ->> 'organization_name', 'My Organization'),
      'org-' || new.id,
      '{}'::jsonb
    )
    RETURNING id INTO org_id;

    is_admin := true; -- First user is admin
  ELSE
    -- Joining existing org
    is_admin := COALESCE((new.raw_user_meta_data ->> 'administrator')::boolean, false);
  END IF;

  -- Create sales record
  INSERT INTO public.sales (first_name, last_name, email, user_id, administrator, organization_id)
  VALUES (
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.email,
    new.id,
    is_admin,
    org_id
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### User Invitation (Join Existing Organization)

Admins can invite users via the Sales page (`/sales`):

```typescript
// Edge function: supabase/functions/users/index.ts

async function inviteUser(req: Request, currentUserSale: any) {
  const { email, password, first_name, last_name, administrator } = await req.json();

  // Only admins can invite
  if (!currentUserSale.administrator) {
    return createErrorResponse(401, "Not Authorized");
  }

  // Create user with organization context in metadata
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: {
      first_name,
      last_name,
      organization_id: currentUserSale.organization_id, // ← Pass org context
      administrator: administrator || false,
    },
  });

  // Trigger will create sales record with correct organization_id

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
```

## Development Guidelines

### Adding New Tables

When creating new data tables, follow this checklist:

#### 1. Create Migration

```sql
-- supabase/migrations/YYYYMMDD_create_my_table.sql

CREATE TABLE "public"."my_table" (
  "id" bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  "organization_id" bigint NOT NULL, -- ← Required
  "name" text NOT NULL,
  "sales_id" bigint,
  "created_at" timestamp with time zone DEFAULT now(),

  -- Foreign keys
  CONSTRAINT "my_table_organization_id_fkey"
    FOREIGN KEY (organization_id)
    REFERENCES organizations(id)
    ON DELETE CASCADE,

  CONSTRAINT "my_table_sales_id_fkey"
    FOREIGN KEY (sales_id)
    REFERENCES sales(id)
    ON DELETE CASCADE
);

-- Index for RLS performance
CREATE INDEX idx_my_table_organization_id ON my_table(organization_id);

-- Enable RLS
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
```

#### 2. Add RLS Policies

```sql
-- SELECT: Filter by organization
CREATE POLICY "tenant_isolation_select" ON my_table
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

-- INSERT: Enforce organization
CREATE POLICY "tenant_isolation_insert" ON my_table
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = get_user_organization_id());

-- UPDATE: Enforce organization (both read and write)
CREATE POLICY "tenant_isolation_update" ON my_table
  FOR UPDATE TO authenticated
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- DELETE: Enforce organization
CREATE POLICY "tenant_isolation_delete" ON my_table
  FOR DELETE TO authenticated
  USING (organization_id = get_user_organization_id());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON my_table TO authenticated;
```

#### 3. Add Auto-Population Trigger

```sql
CREATE TRIGGER set_organization_id_trigger
  BEFORE INSERT ON my_table
  FOR EACH ROW
  EXECUTE FUNCTION set_sales_id_default();
```

#### 4. Update FakeRest Data Generator

```typescript
// src/components/atomic-crm/providers/fakerest/dataGenerator/myTable.ts

export const generateMyTable = (db: Db): MyTable[] => {
  return [
    {
      id: 1,
      organization_id: 1, // ← All test data belongs to organization 1
      name: "Test Item",
      sales_id: 1,
    },
  ];
};

// In index.ts
db.my_table = generateMyTable(db).map(item => ({
  ...item,
  organization_id: 1 // ← Ensure all items have organization_id
}));
```

#### 5. Add to RLS Test Suite

```sql
-- tests/rls_tenant_isolation.test.sql

-- Add to test data setup
INSERT INTO my_table (id, name, organization_id, sales_id)
VALUES
  (9991, 'Item Org 1', 9991, 9991),
  (9992, 'Item Org 2', 9992, 9992);

-- Add isolation test
DO $$
DECLARE
  item_count int;
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', 'user-1-uuid')::text, true);

  SELECT COUNT(*) INTO item_count
  FROM my_table WHERE id IN (9991, 9992);

  IF item_count != 1 THEN
    RAISE EXCEPTION 'Test Failed: User 1 should see 1 item, saw %', item_count;
  END IF;

  RAISE NOTICE 'Test Passed: my_table properly isolated';
END $$;
```

### Querying Data

Frontend code doesn't need to explicitly filter by `organization_id` - RLS handles it automatically:

```typescript
// ✅ Correct: RLS automatically filters
const { data } = await dataProvider.getList("contacts", {
  pagination: { page: 1, perPage: 10 },
  sort: { field: "last_name", order: "ASC" },
  filter: { first_name: "John" }, // No organization_id needed
});

// ❌ Wrong: Don't manually add organization_id
const { data } = await dataProvider.getList("contacts", {
  filter: {
    organization_id: organizationId, // Not needed - RLS does this
    first_name: "John",
  },
});
```

### Views with Tenant Isolation

When creating views, ensure JOINs include `organization_id`:

```sql
CREATE VIEW contacts_summary
  WITH (security_invoker=on) -- ← Important: respects RLS of caller
AS
SELECT
  co.*,
  c.name as company_name,
  count(distinct t.id) as nb_tasks
FROM contacts co
LEFT JOIN tasks t
  ON co.id = t.contact_id
  AND co.organization_id = t.organization_id -- ← Tenant-aware JOIN
LEFT JOIN companies c
  ON co.company_id = c.id
  AND co.organization_id = c.organization_id -- ← Tenant-aware JOIN
GROUP BY co.id, c.name;
```

**Important**: Use `WITH (security_invoker=on)` to ensure the view respects the calling user's RLS policies.

## Testing

### Running RLS Tests

```bash
npx supabase db test tests/rls_tenant_isolation.test.sql
```

Expected output:
```
NOTICE:  Test 1 Passed: get_user_organization_id() returns correct org
NOTICE:  Test 2 Passed: SELECT properly isolated by organization
NOTICE:  Test 3 Passed: INSERT properly blocked cross-tenant
NOTICE:  Test 4 Passed: UPDATE properly blocked cross-tenant
NOTICE:  Test 5 Passed: DELETE properly blocked cross-tenant
NOTICE:  Test 6 Passed: Views properly isolated by organization
NOTICE:  Test 7 Passed: Organizations table properly isolated
NOTICE:  Test 8 Passed: All tables have organization_id column
NOTICE:  Test 9 Passed: All tables have organization_id indexes
NOTICE:  Test 10 Passed: Trigger auto-populates organization_id correctly
NOTICE:  All RLS Tenant Isolation Tests Passed! ✅
```

### Performance Testing

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -f tests/performance_analysis.sql
```

See detailed results in `tests/PERFORMANCE_RESULTS.md`.

Key metrics:
- RLS function overhead: ~0.025ms
- Simple queries: < 0.2ms
- Complex views: < 11ms
- All queries use organization_id indexes

## Performance Considerations

### Index Strategy

Every table with `organization_id` has a B-tree index:

```sql
CREATE INDEX idx_{table}_organization_id ON {table}(organization_id);
```

This ensures:
- RLS policies can efficiently filter rows
- JOIN operations on organization_id are fast
- Query planner consistently chooses index scans over sequential scans

### RLS Overhead

Performance impact of RLS policies:

| Operation | Overhead | Impact |
|-----------|----------|--------|
| Function call (`get_user_organization_id()`) | ~0.025ms | Negligible |
| Index lookup | ~0.05ms | Negligible |
| Total per query | < 0.1ms | < 1% of typical query time |

### Query Optimization

For complex queries, ensure:
1. JOINs include `organization_id` in the ON clause
2. Views use `security_invoker=on`
3. Indexes exist on all foreign keys
4. Consider composite indexes for frequently joined columns

## Security Best Practices

### ✅ Do

- Always enable RLS on new tables: `ALTER TABLE {table} ENABLE ROW LEVEL SECURITY`
- Create all 4 policies (SELECT, INSERT, UPDATE, DELETE) for every table
- Use `security_invoker=on` for views
- Test cross-tenant data leakage with RLS test suite
- Use `SECURITY DEFINER` only when necessary and audit carefully

### ❌ Don't

- Never manually query across organizations (RLS will block it anyway)
- Never disable RLS on production tables
- Never create policies with `using (true)` - this bypasses isolation
- Never trust client-side filtering for security
- Never expose organization_id in URLs or client-side state (not a secret, but no benefit)

## Troubleshooting

### Issue: User can't see any data

**Symptom**: Queries return empty results for authenticated user

**Diagnosis**:
```sql
-- Check if user has organization_id
SELECT id, email, organization_id FROM sales WHERE user_id = auth.uid();

-- Test RLS function
SELECT get_user_organization_id();
```

**Solutions**:
- Ensure user has a sales record with valid organization_id
- Verify RLS policies exist on the table
- Check JWT claims contain correct user ID

### Issue: RLS policies not enforcing

**Symptom**: Users can see data from other organizations

**Diagnosis**:
```sql
-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'your_table';

-- Check policies exist
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename = 'your_table';

-- Test in transaction with role switch
BEGIN;
SET ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub": "user-uuid"}'::text, true);
SELECT * FROM your_table;
ROLLBACK;
```

**Solutions**:
- Enable RLS: `ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;`
- Create missing policies (see "Adding New Tables" section)
- Ensure policies use `TO authenticated` role

### Issue: Slow queries after adding RLS

**Diagnosis**:
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM contacts WHERE id = 123;
```

**Look for**:
- "Sequential Scan" instead of "Index Scan"
- Missing index on organization_id

**Solutions**:
```sql
-- Create missing index
CREATE INDEX idx_contacts_organization_id ON contacts(organization_id);

-- Analyze table for query planner
ANALYZE contacts;
```

## Migration Path (Existing Data)

If adding multi-tenancy to existing installation:

1. **Create default organization**
2. **Add organization_id columns** (nullable initially)
3. **Migrate existing data** to default organization
4. **Make columns NOT NULL**
5. **Add foreign keys**
6. **Create RLS policies**
7. **Add triggers**

See `supabase/migrations/20260126*` for complete migration sequence.

## References

- RLS Policies: `supabase/migrations/20260126150000_tenant_isolation.sql`
- Triggers: `supabase/migrations/20260126160000_update_triggers.sql`
- Frontend Context: `src/components/atomic-crm/root/OrganizationContext.tsx`
- Test Suite: `tests/rls_tenant_isolation.test.sql`
- Performance Results: `tests/PERFORMANCE_RESULTS.md`
