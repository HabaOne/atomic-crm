-- Migration: Allow multi-org signup when organization_name is provided
-- This enables creating multiple organizations for testing multi-tenancy

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  org_id bigint;
  is_admin boolean;
  sales_count int;
  has_org_name boolean;
BEGIN
  -- Get organization_id from user metadata (set during invitation)
  org_id := (new.raw_user_meta_data ->> 'organization_id')::bigint;

  -- If no organization_id in metadata, user is not being invited to existing org
  IF org_id IS NULL THEN
    -- Check if organization_name is explicitly provided
    has_org_name := new.raw_user_meta_data ? 'organization_name';

    -- If organization_name is provided, always create a new organization
    -- This enables multi-org signup for testing
    IF has_org_name THEN
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
      RAISE NOTICE 'Created new organization % for user %', org_id, new.id;
    ELSE
      -- No organization_name provided, check if this is first user
      SELECT count(id) INTO sales_count FROM public.sales;

      IF sales_count = 0 THEN
        -- First user ever, create default organization
        INSERT INTO public.organizations (name, slug, settings)
        VALUES (
          'My Organization',
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
        RAISE NOTICE 'Created default organization % for first user %', org_id, new.id;
      ELSE
        -- Not first user and no organization_name - block signup
        RAISE EXCEPTION 'Cannot self-register: organization already exists. Please contact an administrator for an invitation.';
      END IF;
    END IF;
  ELSE
    -- Joining existing org via invitation
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
