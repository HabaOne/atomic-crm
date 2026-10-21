# Investor import v1.0 (2026-10-21)

Imports 3,815 investor contacts at 1,437 firms from
`investoren-strukturiert.json` into the Haba organization of the Atomic CRM
(Supabase `iuetitgxyqyxmrbacobj`), with filterable fields.

## Files

- `supabase/migrations/20261021120000_add_investor_fields.sql`:
  new columns, check constraints, unique keys on `external_id`, filter indexes.
  Rerunnable.
- `investor_mapping.py`: sector normalization (19 values, 90.1% of raw labels
  mapped), stage cleanup, primary contact ranking. Tests:
  `test_investor_mapping.py` (7 passed).
- `import_investors.py`: dry run by default, `--apply` writes as a CRM user
  (RLS and triggers apply). Idempotent by source uuid.

## Verified locally (2026-10-21)

Scratch Postgres 17 with the CRM's RLS policies and `set_sales_id_default`
trigger: migration applied twice without error; import run 1 inserted 1,437
companies and 3,815 contacts, run 2 updated the same rows and inserted none;
all rows in organization 2 owned by the importing user; existing contact
untouched; exactly one primary contact per firm; another organization sees 0
rows.

## Run against Supabase

1. SQL editor: run the migration file.
2. `DATABASE_URL=<crm_mcp pooler URI> CRM_USER_ID=<auth uid> python scripts/investor-import/import_investors.py <json> --apply`
   (needs `psycopg2`; the source JSON is not in the repo because it holds personal data)

## Example filters (SQL via the CRM MCP)

```sql
-- Seed or pre-seed investors in AI with an email, primary contacts only
select ct.first_name, ct.last_name, co.name, ct.email_jsonb, ct.email_confidence
from contacts ct join companies co on co.id = ct.company_id
where ct.contact_type = 'investor' and ct.is_primary_contact
  and co.stages && array['pre_seed','seed'] and co.sectors && array['AI']
  and jsonb_array_length(ct.email_jsonb) > 0;
```

Series B+ = `co.stages && array['series_b','growth','late']`.

## Applied to Supabase (2026-10-21)

- Migration run in the SQL editor of `iuetitgxyqyxmrbacobj`: 10 new company
  columns, 7 new contact columns.
- Import as alex@haba.ai (sales_id 6, organization 2): 1,437 companies and
  3,815 contacts inserted, 0 updated.
- Check after import: organization 2 has 4,204 contacts (389 before) and 1,458
  companies (21 before); the 389 existing contacts have no external_id and all
  still have status `lead`; 0 imported contacts outside organization 2; 1,437
  primary contacts, no firm with more than one; seed + AI with email: 186;
  Series B+: 955.
- The migration was applied by hand before it reached a deploy branch; the
  deploy step `supabase db push` reruns it without error, since every statement
  is `IF NOT EXISTS` or drops before adding.
