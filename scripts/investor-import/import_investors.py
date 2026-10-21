"""Investor import into Atomic CRM v1.0 (2026-10-21).

Reads investoren-strukturiert.json and upserts companies, then contacts, keyed
by the source uuids (external_id). Runs as a CRM user: the connection uses the
crm_mcp role, switches to `authenticated` and sets the JWT subject, so RLS and
the set_sales_id_default triggers apply exactly as in the app.

Dry run (default) only reads the file and prints what would be written.

Usage:
    python import_investors.py <json>                 # dry run, no database
    DATABASE_URL=... CRM_USER_ID=<auth uid> \
        python import_investors.py <json> --apply     # write

DATABASE_URL: the crm_mcp session pooler URI. CRM_USER_ID: the auth user id
(Supabase > Authentication > Users > UID) of the CRM user who owns the import.
"""

import argparse
import collections
import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from investor_mapping import normalize_sectors, normalize_stages, primary_person_ids  # noqa: E402

COMPANY_SOURCE = "investor_export_2026_10_21"
CONTACT_TYPE = "investor"
DEFAULT_STATUS = "cold"
STAGE_LABELS = {
    "pre_seed": "Pre-Seed",
    "seed": "Seed",
    "series_a": "Series A",
    "series_b": "Series B",
    "growth": "Growth",
    "late": "Late",
}


def clean(value):
    if isinstance(value, str):
        value = value.strip()
    return value or None


def build_companies(rows):
    companies = {}
    for row in rows:
        cid = row["company_id"]
        if cid in companies:
            continue
        sectors_raw = [s.strip() for s in row.get("sectors_raw") or [] if s and s.strip()]
        companies[cid] = {
            "external_id": cid,
            "name": clean(row.get("company_name")),
            "website": clean(row.get("company_website")),
            "country": clean(row.get("company_country")),
            "city": clean(row.get("company_city")),
            "description": clean(row.get("company_description")),
            "investor_type": clean(row.get("investor_type")),
            "stages": normalize_stages(row.get("stages")),
            "sectors": normalize_sectors(sectors_raw),
            "sectors_raw": sectors_raw,
            "check_size": clean(row.get("check_size")),
            "geography_focus": clean(row.get("geography_focus")),
            "source": COMPANY_SOURCE,
            "source_keys": list(row.get("company_source_keys") or []),
        }
    return companies


def background_text(row, company):
    parts = [f"Seniority: {row.get('seniority')}"]
    if company["stages"]:
        parts.append("Stages: " + ", ".join(STAGE_LABELS[s] for s in company["stages"]))
    if company["sectors"]:
        parts.append("Sectors: " + ", ".join(company["sectors"]))
    if company["check_size"]:
        parts.append(f"Check size: {company['check_size']}")
    if row.get("email") and row.get("email_confidence"):
        parts.append(f"Email: {row['email_confidence']}")
    parts.append(f"Source: {row.get('source')}")
    return ". ".join(parts) + "."


def build_contacts(rows, companies):
    primaries = primary_person_ids(rows)
    contacts = []
    for row in rows:
        company = companies[row["company_id"]]
        email = clean(row.get("email"))
        contacts.append(
            {
                "external_id": row["person_id"],
                "company_external_id": row["company_id"],
                "first_name": clean(row.get("first_name")),
                "last_name": clean(row.get("last_name")),
                "title": clean(row.get("title")),
                "email_jsonb": [{"email": email, "type": "Work"}] if email else [],
                "linkedin_url": clean(row.get("linkedin_url")),
                "country": clean(row.get("person_country")),
                "city": clean(row.get("person_city")),
                "background": background_text(row, company),
                "contact_type": CONTACT_TYPE,
                "seniority": clean(row.get("seniority")),
                "is_primary_contact": row["person_id"] in primaries,
                "email_confidence": clean(row.get("email_confidence")) if email else None,
                "source": clean(row.get("source")),
            }
        )
    return contacts


def summarize(companies, contacts):
    counter = collections.Counter
    print(f"companies: {len(companies)}")
    print(f"  with sectors: {sum(1 for c in companies.values() if c['sectors'])}")
    print(f"  with stages:  {sum(1 for c in companies.values() if c['stages'])}")
    print(f"  investor_type: {dict(counter(c['investor_type'] for c in companies.values()))}")
    print(f"contacts: {len(contacts)}")
    print(f"  primary: {sum(c['is_primary_contact'] for c in contacts)}")
    print(f"  with email: {sum(1 for c in contacts if c['email_jsonb'])}"
          f" {dict(counter(c['email_confidence'] for c in contacts if c['email_jsonb']))}")
    print(f"  with linkedin: {sum(1 for c in contacts if c['linkedin_url'])}")
    print(f"  source: {dict(counter(c['source'] for c in contacts))}")


COMPANY_SQL = """
INSERT INTO public.companies
  (external_id, name, website, country, city, description, investor_type, stages,
   sectors, sectors_raw, check_size, geography_focus, source, source_keys, imported_at)
VALUES %s
ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
  name = EXCLUDED.name, website = EXCLUDED.website, country = EXCLUDED.country,
  city = EXCLUDED.city, description = EXCLUDED.description,
  investor_type = EXCLUDED.investor_type, stages = EXCLUDED.stages,
  sectors = EXCLUDED.sectors, sectors_raw = EXCLUDED.sectors_raw,
  check_size = EXCLUDED.check_size, geography_focus = EXCLUDED.geography_focus,
  source = EXCLUDED.source, source_keys = EXCLUDED.source_keys
RETURNING id, external_id, (xmax = 0) AS inserted
"""

# Re-imports refresh source-derived fields only; status, background, notes and
# activity dates stay as the team left them.
CONTACT_SQL = """
INSERT INTO public.contacts
  (external_id, company_id, first_name, last_name, title, email_jsonb, linkedin_url,
   country, city, background, contact_type, seniority, is_primary_contact,
   email_confidence, source, status, first_seen, last_seen, has_newsletter, imported_at)
VALUES %s
ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL DO UPDATE SET
  company_id = EXCLUDED.company_id, first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name, title = EXCLUDED.title,
  email_jsonb = EXCLUDED.email_jsonb, linkedin_url = EXCLUDED.linkedin_url,
  country = EXCLUDED.country, city = EXCLUDED.city,
  contact_type = EXCLUDED.contact_type, seniority = EXCLUDED.seniority,
  is_primary_contact = EXCLUDED.is_primary_contact,
  email_confidence = EXCLUDED.email_confidence, source = EXCLUDED.source
RETURNING (xmax = 0) AS inserted
"""


def apply(companies, contacts):
    import psycopg2
    from psycopg2.extras import Json, execute_values

    dsn = os.environ.get("DATABASE_URL")
    user_id = os.environ.get("CRM_USER_ID")
    if not dsn or not user_id:
        sys.exit("Set DATABASE_URL and CRM_USER_ID for --apply.")

    now = datetime.datetime.now(datetime.timezone.utc)
    conn = psycopg2.connect(dsn)
    try:
        with conn, conn.cursor() as cur:
            claims = json.dumps({"sub": user_id, "role": "authenticated"})
            cur.execute("SET LOCAL role = 'authenticated'")
            cur.execute("SELECT set_config('request.jwt.claims', %s, true)", (claims,))
            cur.execute("SELECT set_config('request.jwt.claim.sub', %s, true)", (user_id,))

            cur.execute("SELECT id, organization_id, email FROM public.sales WHERE user_id = auth.uid()")
            sale = cur.fetchone()
            if not sale:
                sys.exit("CRM_USER_ID has no sales row in this project; nothing written.")
            print(f"importing as sales_id={sale[0]} organization_id={sale[1]}")

            company_rows = [
                (c["external_id"], c["name"], c["website"], c["country"], c["city"],
                 c["description"], c["investor_type"], c["stages"], c["sectors"],
                 c["sectors_raw"], c["check_size"], c["geography_focus"], c["source"],
                 c["source_keys"], now)
                for c in companies.values()
            ]
            result = execute_values(cur, COMPANY_SQL, company_rows, page_size=200, fetch=True)
            company_ids = {ext: cid for cid, ext, _ in result}
            print(f"companies: {sum(1 for r in result if r[2])} inserted, "
                  f"{sum(1 for r in result if not r[2])} updated")

            contact_rows = [
                (c["external_id"], company_ids[c["company_external_id"]], c["first_name"],
                 c["last_name"], c["title"], Json(c["email_jsonb"]), c["linkedin_url"],
                 c["country"], c["city"], c["background"], c["contact_type"], c["seniority"],
                 c["is_primary_contact"], c["email_confidence"], c["source"], DEFAULT_STATUS,
                 now, now, False, now)
                for c in contacts
            ]
            result = execute_values(cur, CONTACT_SQL, contact_rows, page_size=200, fetch=True)
            print(f"contacts: {sum(1 for r in result if r[0])} inserted, "
                  f"{sum(1 for r in result if not r[0])} updated")
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path")
    parser.add_argument("--apply", action="store_true", help="write to the database")
    args = parser.parse_args()

    with open(args.json_path, encoding="utf-8") as handle:
        rows = json.load(handle)
    companies = build_companies(rows)
    contacts = build_contacts(rows, companies)
    summarize(companies, contacts)
    if args.apply:
        apply(companies, contacts)
    else:
        print("dry run: nothing written (add --apply to write)")


if __name__ == "__main__":
    main()
