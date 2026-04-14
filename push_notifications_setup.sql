-- Migration: Push Notifications Infrastructure

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS public.notification_delivery_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL UNIQUE,
    push_enabled BOOLEAN DEFAULT true,
    in_app_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default events
INSERT INTO public.notification_delivery_config (event_type, push_enabled, in_app_enabled) VALUES
('ticket_created', true, true),
('ticket_reply', true, true),
('payment_verified', true, true),
('payment_requested', true, true),
('new_lead', true, true),
('session_assigned', true, true),
('general', true, true)
ON CONFLICT (event_type) DO NOTHING;

-- Grant access (Security)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_config ENABLE ROW LEVEL SECURITY;

-- Disable RLS for admin service role or internal use for simplicity during insert
CREATE POLICY "Allow select on config" ON public.notification_delivery_config FOR SELECT USING (true);
CREATE POLICY "Allow all for authenticated users subs" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
