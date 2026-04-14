-- Automated Leave Quota Update
-- Run this in your Supabase SQL Editor

-- 1. Add monthly leave quota to employee salary structures
ALTER TABLE salary_structures 
ADD COLUMN IF NOT EXISTS monthly_paid_leave_quota NUMERIC(4,2) DEFAULT 0.0;

-- 2. Add column to track how many leaves were covered by quota in a payroll item
ALTER TABLE hr_payroll_items 
ADD COLUMN IF NOT EXISTS quota_covered_leaves NUMERIC(4,2) DEFAULT 0.0;

-- 3. (Optional but recommended) Rename 'leave' to 'holiday' in the enum if you want it to be explicit.
-- Since PostgreSQL doesn't allow direct renaming of enum values easily without a ritual, 
-- we will just treat 'leave' as 'holiday' in the code logic for now.
