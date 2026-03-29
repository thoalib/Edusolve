-- Migration to add opening_balance to finance_accounts
-- This is necessary to correctly recompute balances from transactions while keeping the initial state.

ALTER TABLE finance_accounts ADD COLUMN IF NOT EXISTS opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0;

-- Backfill: If an account has no transactions, we assume its current balance IS its opening balance.
-- If it has transactions, you might need to manually adjust this.
-- For now, initialize opening_balance to current balance for all accounts that haven't been synced yet.
UPDATE finance_accounts SET opening_balance = balance WHERE opening_balance = 0;
