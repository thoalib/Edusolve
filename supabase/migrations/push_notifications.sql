-- Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, endpoint)
);

-- Notification Delivery Config Table
CREATE TABLE IF NOT EXISTS public.notification_delivery_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT UNIQUE NOT NULL,
    push_enabled BOOLEAN DEFAULT TRUE,
    in_app_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default event types
INSERT INTO public.notification_delivery_config (event_type, push_enabled, in_app_enabled)
VALUES 
    ('ticket_reply', TRUE, TRUE),
    ('new_remark', TRUE, TRUE),
    ('payment_verified', TRUE, TRUE),
    ('custom_broadcast', TRUE, TRUE)
ON CONFLICT (event_type) DO NOTHING;

-- RLS for push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push subscriptions"
    ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own push subscriptions"
    ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own push subscriptions"
    ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

-- Admins can view/manage all push subscriptions
CREATE POLICY "Admins can manage all push subscriptions"
    ON public.push_subscriptions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            JOIN roles ON roles.id = user_roles.role_id
            WHERE user_roles.user_id = auth.uid() AND roles.code = 'super_admin'
        )
    );

-- RLS for notification_delivery_config
ALTER TABLE public.notification_delivery_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Anyone can read notification config"
    ON public.notification_delivery_config
    FOR SELECT USING (true);

-- Only admins can update config
CREATE POLICY "Admins can update notification config"
    ON public.notification_delivery_config
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_roles
            JOIN roles ON roles.id = user_roles.role_id
            WHERE user_roles.user_id = auth.uid() AND roles.code = 'super_admin'
        )
    );
