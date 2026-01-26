-- Migration 6: Update triggers for organization auto-population
-- This ensures organization_id is automatically set on INSERTs

-- ========================================
-- Update handle_new_user() trigger
-- ========================================
-- This trigger runs when a new user signs up or is invited
-- It creates an organization for first signup, or joins existing org for invited users

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  org_id bigint;
  is_admin boolean;
  sales_count int;
BEGIN
  -- Get organization_id from user metadata (set during invitation)
  org_id := (new.raw_user_meta_data ->> 'organization_id')::bigint;

  -- If no organization_id in metadata, this is a first signup
  IF org_id IS NULL THEN
    -- Check if any sales records exist
    SELECT count(id) INTO sales_count FROM public.sales;

    -- If no sales exist, this is the very first user - create new organization
    IF sales_count = 0 THEN
      INSERT INTO public.organizations (name, slug, settings)
      VALUES (
        COALESCE(new.raw_user_meta_data ->> 'organization_name', 'My Organization'),
        'org-' || new.id,
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
      RETURNING id INTO org_id;

      is_admin := true;
      RAISE NOTICE 'Created new organization % for first user %', org_id, new.id;
    ELSE
      -- Sales records exist but no org_id provided - this shouldn't happen in normal flow
      -- This case would occur if signup page is accessed after initialization
      RAISE EXCEPTION 'Cannot self-register: organization already exists. Please contact an administrator for an invitation.';
    END IF;
  ELSE
    -- Joining existing org via invitation
    -- Check if they should be admin (from invitation metadata)
    is_admin := COALESCE((new.raw_user_meta_data ->> 'administrator')::boolean, false);
    RAISE NOTICE 'User % joining existing organization %', new.id, org_id;
  END IF;

  -- Insert sales record with organization_id
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
$$;

-- ========================================
-- Update set_sales_id_default() trigger
-- ========================================
-- This trigger auto-populates both sales_id and organization_id
-- on INSERT for various tables

CREATE OR REPLACE FUNCTION set_sales_id_default()
RETURNS TRIGGER AS $$
DECLARE
  current_sales_id bigint;
  current_org_id bigint;
BEGIN
  -- Get current user's sales_id and organization_id
  SELECT id, organization_id INTO current_sales_id, current_org_id
  FROM sales
  WHERE user_id = auth.uid();

  -- Set sales_id if not provided
  IF NEW.sales_id IS NULL THEN
    NEW.sales_id := current_sales_id;
  END IF;

  -- Set organization_id from current user's organization
  -- This is critical for tenant isolation
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := current_org_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: Triggers using this function already exist from previous migrations
-- They were created for: tasks, contacts, contact_notes, companies, deals, deal_notes
-- No need to recreate them here
