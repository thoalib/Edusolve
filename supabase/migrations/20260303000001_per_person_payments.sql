-- Migration: Per-Person Salary Submissions
-- This migration updates hr_payment_requests to support individual teacher and employee submissions instead of global payroll cycles.

-- 1. Make cycle_id optional (since we won't use hr_payroll_cycles moving forward)
ALTER TABLE hr_payment_requests ALTER COLUMN cycle_id DROP NOT NULL;

-- 2. Add columns to reference the specific individual
ALTER TABLE hr_payment_requests ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES employees(id);
ALTER TABLE hr_payment_requests ADD COLUMN IF NOT EXISTS teacher_id UUID REFERENCES teacher_profiles(id);

-- 3. Add column to distinguish the type ('employee' or 'teacher')
ALTER TABLE hr_payment_requests ADD COLUMN IF NOT EXISTS target_type TEXT CHECK (target_type IN ('employee', 'teacher'));

-- 4. Store the specific month and year this payment is for
ALTER TABLE hr_payment_requests ADD COLUMN IF NOT EXISTS year INT;
ALTER TABLE hr_payment_requests ADD COLUMN IF NOT EXISTS month INT CHECK (month BETWEEN 1 AND 12);

-- 5. Store a JSON snapshot of the salary calculation. 
-- This permanently freezes the breakdown at the time of submission so future rate changes do not alter historical records.
ALTER TABLE hr_payment_requests ADD COLUMN IF NOT EXISTS breakdown JSONB;

-- 6. Add a unique constraint to ensure a person can only have one payment request per month
-- (Using coalesce to handle nulls in the unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_request_employee 
ON hr_payment_requests (year, month, employee_id) 
WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_request_teacher 
ON hr_payment_requests (year, month, teacher_id) 
WHERE teacher_id IS NOT NULL;
