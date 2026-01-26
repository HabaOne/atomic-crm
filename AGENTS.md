# AGENTS.md

## Project Overview

Atomic CRM is a full-featured CRM built with React, shadcn-admin-kit, and Supabase. It provides contact management, task tracking, notes, email capture, and deal management with a Kanban board.

**Multi-Tenancy**: The CRM supports multiple isolated organizations with Row-Level Security (RLS) for data isolation. Each user belongs to one organization and can only access their organization's data.

## Development Commands

### Setup
```bash
make install          # Install dependencies (frontend, backend, local Supabase)
make start            # Start full stack with real API (Supabase + Vite dev server)
make stop             # Stop the stack
make start-demo       # Start full-stack with FakeRest data provider
```

### Testing and Code Quality

```bash
make test             # Run unit tests (vitest)
make typecheck        # Run TypeScript type checking
make lint             # Run ESLint and Prettier checks
npm run test:e2e      # Run E2E tests (Playwright)
npm run test:e2e:ui   # Run E2E tests in interactive UI mode
```

### Building

```bash
make build            # Build production bundle (runs tsc + vite build)
```

### Database Management

```bash
npx supabase migration new <name>  # Create new migration
npx supabase migration up          # Apply migrations locally
npx supabase db push               # Push migrations to remote
npx supabase db reset              # Reset local database (destructive)
```

### Registry (Shadcn Components)

```bash
make registry-gen     # Generate registry.json (runs automatically on pre-commit)
make registry-build   # Build Shadcn registry
```

## Architecture

### Technology Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Routing**: React Router v7
- **Data Fetching**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **Application Logic**: shadcn-admin-kit + ra-core (react-admin headless)
- **UI Components**: Shadcn UI + Radix UI
- **Styling**: Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + REST API + Auth + Storage + Edge Functions)
- **Testing**: Vitest

### Directory Structure

```
src/
├── components/
│   ├── admin/              # Shadcn Admin Kit components (mutable dependency)
│   ├── atomic-crm/         # Main CRM application code (~15,000 LOC)
│   │   ├── activity/       # Activity logs
│   │   ├── companies/      # Company management
│   │   ├── contacts/       # Contact management (includes CSV import/export)
│   │   ├── dashboard/      # Dashboard widgets
│   │   ├── deals/          # Deal pipeline (Kanban)
│   │   ├── filters/        # List filters
│   │   ├── layout/         # App layout components
│   │   ├── login/          # Authentication pages
│   │   ├── misc/           # Shared utilities
│   │   ├── notes/          # Note management
│   │   ├── providers/      # Data providers (Supabase + FakeRest)
│   │   ├── root/           # Root CRM component (includes OrganizationContext)
│   │   ├── sales/          # Sales team management
│   │   ├── settings/       # Settings page (includes OrganizationSettingsPage)
│   │   ├── simple-list/    # List components
│   │   ├── tags/           # Tag management
│   │   └── tasks/          # Task management
│   ├── supabase/           # Supabase-specific auth components
│   └── ui/                 # Shadcn UI components (mutable dependency)
├── hooks/                  # Custom React hooks
├── lib/                    # Utility functions
└── App.tsx                 # Application entry point

supabase/
├── functions/              # Edge functions (user management, inbound email)
└── migrations/             # Database migrations
```

### Key Architecture Patterns

For more details, check out the doc/src/content/docs/developers/architecture-choices.mdx document.

#### Mutable Dependencies

The codebase includes mutable dependencies that should be modified directly if needed:
- `src/components/admin/`: Shadcn Admin Kit framework code
- `src/components/ui/`: Shadcn UI components

#### Configuration via `<CRM>` Component

The `src/App.tsx` file renders the `<CRM>` component, which accepts props for domain-specific configuration:
- `contactGender`: Gender options
- `companySectors`: Company industry sectors
- `dealCategories`, `dealStages`, `dealPipelineStatuses`: Deal configuration
- `noteStatuses`: Note status options with colors
- `taskTypes`: Task type options
- `logo`, `title`: Branding
- `lightTheme`, `darkTheme`: Theme customization
- `disableTelemetry`: Opt-out of anonymous usage tracking

#### Database Views

Complex queries are handled via database views to simplify frontend code and reduce HTTP overhead. For example, `contacts_summary` provides aggregated contact data including task counts.

#### Database Triggers

User data syncs between Supabase's `auth.users` table and the CRM's `sales` table via triggers (see `supabase/migrations/20240730075425_init_triggers.sql`).

#### Edge Functions

Located in `supabase/functions/`:
- User management (creating/updating users, account disabling)
- Inbound email webhook processing

#### Data Providers

Two data providers are available:
1. **Supabase** (default): Production backend using PostgreSQL
2. **FakeRest**: In-browser fake API for development/demos, resets on page reload

When using FakeRest, database views are emulated in the frontend. Test data generators are in `src/components/atomic-crm/providers/fakerest/dataGenerator/`.

#### Filter Syntax

List filters follow the `ra-data-postgrest` convention with operator concatenation: `field_name@operator` (e.g., `first_name@eq`). The FakeRest adapter maps these to FakeRest syntax at runtime.

#### Multi-Tenancy Architecture

The CRM implements **RLS-based multi-tenancy** for secure data isolation between organizations:

**Core Concepts:**
- Each user belongs to exactly one organization
- All data tables include an `organization_id` column with indexed foreign keys
- Row-Level Security (RLS) policies enforce tenant isolation at the database level
- Triggers automatically populate `organization_id` on INSERT operations

**Security Model:**
```sql
-- RLS policies on all tables (example: contacts)
CREATE POLICY "tenant_isolation_select" ON contacts
  FOR SELECT TO authenticated
  USING (organization_id = get_user_organization_id());

-- Helper function reads from JWT claims
CREATE FUNCTION get_user_organization_id()
RETURNS bigint AS $$
  SELECT organization_id FROM sales WHERE user_id = auth.uid();
$$;
```

**Frontend Integration:**
- `OrganizationContext` provider fetches current organization and settings
- `useOrganization()` hook provides organization state
- `useOrganizationConfiguration()` hook returns configuration with fallbacks to defaults
- Organization settings stored in JSONB column (sectors, deal stages, task types, etc.)

**User Onboarding:**
1. **First Signup**: Creates new organization automatically, user becomes admin
2. **Invitation**: Admin invites users via `/sales`, they join existing organization
3. **Organization Settings**: Admin-only page at `/settings/organization`

**Data Isolation:**
- RLS policies filter all queries by `organization_id` (enforced at database level)
- Frontend dataProvider remains simple - RLS handles filtering automatically
- Triggers auto-populate `organization_id` on INSERT (developers don't need to remember)
- FakeRest provider includes middleware to mimic RLS behavior in development

**Performance:**
- All tables have `idx_{table}_organization_id` indexes (< 0.1ms overhead per query)
- RLS function overhead: ~0.025ms per query
- Test suite: `tests/rls_tenant_isolation.test.sql` (10 comprehensive tests)
- Performance analysis: `tests/PERFORMANCE_RESULTS.md`

**Tables with Multi-Tenancy:**
- organizations
- sales
- companies
- contacts
- contact_notes
- deals
- deal_notes
- tasks
- tags

## Development Workflows

### Path Aliases

The project uses TypeScript path aliases configured in `tsconfig.json` and `components.json`:
- `@/components` → `src/components`
- `@/lib` → `src/lib`
- `@/hooks` → `src/hooks`
- `@/components/ui` → `src/components/ui`

### Adding Custom Fields

When modifying contact or company data structures:
1. Create a migration: `npx supabase migration new <name>`
2. Update the sample CSV: `src/components/atomic-crm/contacts/contacts_export.csv`
3. Update the import function: `src/components/atomic-crm/contacts/useContactImport.tsx`
4. If using FakeRest, update data generators in `src/components/atomic-crm/providers/fakerest/dataGenerator/`
5. Don't forget to update the views
6. Don't forget the export functions
7. Don't forget the contact merge logic

### Adding New Data Tables

When adding new tables to the CRM:
1. Create migration with table schema
2. **Add `organization_id bigint NOT NULL` column with foreign key to organizations**
3. **Create index: `CREATE INDEX idx_{table}_organization_id ON {table}(organization_id)`**
4. **Add RLS policies** (see existing tables for pattern):
   - `tenant_isolation_select` - filter by organization_id
   - `tenant_isolation_insert` - enforce organization_id
   - `tenant_isolation_update` - enforce organization_id
   - `tenant_isolation_delete` - enforce organization_id
5. **Create trigger to auto-populate organization_id** (see `set_sales_id_default()` trigger)
6. Update FakeRest data generators to include `organization_id: 1`
7. Add tests to `tests/rls_tenant_isolation.test.sql`

### Running with Test Data

Import `test-data/contacts.csv` via the Contacts page → Import button.

### Testing Multi-Tenancy

Run the RLS tenant isolation test suite:
```bash
npx supabase db test tests/rls_tenant_isolation.test.sql
```

This test suite verifies:
- Users can only see their organization's data (SELECT isolation)
- Users cannot insert data into other organizations (INSERT blocked)
- Users cannot update other organizations' data (UPDATE blocked)
- Users cannot delete other organizations' data (DELETE blocked)
- Views respect tenant isolation
- Triggers auto-populate organization_id correctly
- All tables have organization_id columns and indexes

Run performance analysis:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f tests/performance_analysis.sql
```

See results in `tests/PERFORMANCE_RESULTS.md`.

### E2E Testing with Playwright

Run end-to-end tests for multi-tenancy:

```bash
# Prerequisites: Supabase and app must be running
make start            # Terminal 1: Start Supabase + Vite

# Run E2E tests
npm run test:e2e      # Run all E2E tests
npm run test:e2e:ui   # Interactive UI mode
npm run test:e2e:headed  # See browser while testing
npm run test:e2e:debug   # Step-through debugging
```

E2E tests cover:
- Organization creation on first signup
- User invitation flow
- Data isolation between organizations
- Access control (admin vs. user)
- Cross-tenant data leak prevention

See `e2e/README.md` for detailed documentation.

### Git Hooks

- Pre-commit: Automatically runs `make registry-gen` to update `registry.json`

### Accessing Local Services During Development

- Frontend: http://localhost:5173/
- Supabase Dashboard: http://localhost:54323/
- REST API: http://127.0.0.1:54321
- Storage (attachments): http://localhost:54323/project/default/storage/buckets/attachments
- Inbucket (email testing): http://localhost:54324/

## Important Notes

- The codebase is intentionally small (~15,000 LOC in `src/components/atomic-crm`) for easy customization
- Modify files in `src/components/admin` and `src/components/ui` directly - they are meant to be customized
- Unit tests can be added in the `src/` directory (test files are named `*.test.ts` or `*.test.tsx`)
- User deletion is not supported to avoid data loss; use account disabling instead
- Filter operators must be supported by the `supabaseAdapter` when using FakeRest
