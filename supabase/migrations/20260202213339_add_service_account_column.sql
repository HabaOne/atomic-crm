-- Add is_service_account column to sales table
-- Service accounts are created by HABA-AI via master key for API integrations
-- They cannot login to the CRM UI and are distinguishable from real users

ALTER TABLE sales ADD COLUMN IF NOT EXISTS is_service_account boolean DEFAULT false;

-- Add an index for querying service accounts
CREATE INDEX IF NOT EXISTS idx_sales_is_service_account ON sales(is_service_account) WHERE is_service_account = true;
