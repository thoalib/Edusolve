ALTER TABLE leads ADD COLUMN IF NOT EXISTS drop_reason TEXT;

CREATE TABLE IF NOT EXISTS lead_drop_reasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reason TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed defaults
INSERT INTO lead_drop_reasons (reason) VALUES
('Not interested anymore'),
('Fees too high'),
('Timing mismatch'),
('Joined another institute'),
('Invalid phone number'),
('Not picking up calls')
ON CONFLICT DO NOTHING;
