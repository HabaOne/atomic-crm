-- Migration 3: Migrate existing data to default organization
-- This migration creates a default organization with current configuration
-- and updates all existing records to belong to this organization

DO $$
DECLARE
  default_org_id bigint;
BEGIN
  -- Create default organization with current configuration from defaultConfiguration.ts
  INSERT INTO organizations (name, slug, settings)
  VALUES (
    'Default Organization',
    'default',
    '{
      "title": "Atomic CRM",
      "companySectors": [
        "Communication Services",
        "Consumer Discretionary",
        "Consumer Staples",
        "Energy",
        "Financials",
        "Health Care",
        "Industrials",
        "Information Technology",
        "Materials",
        "Real Estate",
        "Utilities"
      ],
      "dealCategories": [
        "Other",
        "Copywriting",
        "Print project",
        "UI Design",
        "Website design"
      ],
      "dealPipelineStatuses": ["won"],
      "dealStages": [
        {"value": "opportunity", "label": "Opportunity"},
        {"value": "proposal-sent", "label": "Proposal Sent"},
        {"value": "in-negociation", "label": "In Negotiation"},
        {"value": "won", "label": "Won"},
        {"value": "lost", "label": "Lost"},
        {"value": "delayed", "label": "Delayed"}
      ],
      "noteStatuses": [
        {"value": "cold", "label": "Cold", "color": "#7dbde8"},
        {"value": "warm", "label": "Warm", "color": "#e8cb7d"},
        {"value": "hot", "label": "Hot", "color": "#e88b7d"},
        {"value": "in-contract", "label": "In Contract", "color": "#a4e87d"}
      ],
      "taskTypes": [
        "None",
        "Email",
        "Demo",
        "Lunch",
        "Meeting",
        "Follow-up",
        "Thank you",
        "Ship",
        "Call"
      ],
      "contactGender": [
        {"value": "male", "label": "He/Him"},
        {"value": "female", "label": "She/Her"},
        {"value": "nonbinary", "label": "They/Them"}
      ]
    }'::jsonb
  )
  RETURNING id INTO default_org_id;

  RAISE NOTICE 'Created default organization with id: %', default_org_id;

  -- Migrate all existing records to default organization
  -- Update sales table
  UPDATE sales SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % sales records', (SELECT COUNT(*) FROM sales WHERE organization_id = default_org_id);

  -- Update companies table
  UPDATE companies SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % companies records', (SELECT COUNT(*) FROM companies WHERE organization_id = default_org_id);

  -- Update contacts table
  UPDATE contacts SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % contacts records', (SELECT COUNT(*) FROM contacts WHERE organization_id = default_org_id);

  -- Update contact_notes table
  UPDATE contact_notes SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % contact_notes records', (SELECT COUNT(*) FROM contact_notes WHERE organization_id = default_org_id);

  -- Update deals table
  UPDATE deals SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % deals records', (SELECT COUNT(*) FROM deals WHERE organization_id = default_org_id);

  -- Update deal_notes table
  UPDATE deal_notes SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % deal_notes records', (SELECT COUNT(*) FROM deal_notes WHERE organization_id = default_org_id);

  -- Update tasks table
  UPDATE tasks SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % tasks records', (SELECT COUNT(*) FROM tasks WHERE organization_id = default_org_id);

  -- Update tags table
  UPDATE tags SET organization_id = default_org_id WHERE organization_id IS NULL;
  RAISE NOTICE 'Updated % tags records', (SELECT COUNT(*) FROM tags WHERE organization_id = default_org_id);

  -- Make columns NOT NULL after migration
  ALTER TABLE sales ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE companies ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE contacts ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE contact_notes ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE deals ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE deal_notes ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE tasks ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE tags ALTER COLUMN organization_id SET NOT NULL;

  RAISE NOTICE 'All organization_id columns set to NOT NULL';
END $$;
