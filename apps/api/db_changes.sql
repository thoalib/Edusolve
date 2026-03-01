-- DB Schema Changes for Ledgers and Parties

-- Add explicit relations to ledger_entries (Income)
ALTER TABLE ledger_entries ADD COLUMN student_id UUID REFERENCES students(id) NULL;
ALTER TABLE ledger_entries ADD COLUMN teacher_id UUID REFERENCES users(id) NULL;
ALTER TABLE ledger_entries ADD COLUMN employee_id UUID REFERENCES employees(id) NULL;

-- Add explicit relations to expenses (Outflow)
ALTER TABLE expenses ADD COLUMN student_id UUID REFERENCES students(id) NULL;
ALTER TABLE expenses ADD COLUMN teacher_id UUID REFERENCES users(id) NULL;
ALTER TABLE expenses ADD COLUMN employee_id UUID REFERENCES employees(id) NULL;

-- Update HR Payroll Cycles to link to Payment Requests conceptually, but we already have hr_payment_requests.


-- ═══════ PENDING INSTALLMENT PAYMENTS ═══════

CREATE TABLE installment_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference_type VARCHAR(50) NOT NULL, -- 'payment_request' or 'student_topup'
    reference_id UUID NOT NULL,
    amount NUMERIC NOT NULL,
    finance_note TEXT,
    screenshot_url TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
    created_by UUID REFERENCES users(id),
    verified_by UUID REFERENCES users(id),
    account_id UUID REFERENCES finance_accounts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
);
