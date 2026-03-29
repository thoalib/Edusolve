CREATE TABLE IF NOT EXISTS experience_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert common defaults (matching the keys expected by salary calculation)
INSERT INTO experience_categories (name) VALUES 
('fresher'),
('experienced'),
('experienced_high')
ON CONFLICT (name) DO NOTHING;

-- Data migration: convert old values to the standard ones
UPDATE teacher_profiles 
SET experience_level = 'fresher' 
WHERE experience_level ILIKE 'beginner' OR experience_level ILIKE 'fresher';

UPDATE teacher_profiles 
SET experience_level = 'experienced' 
WHERE experience_level ILIKE 'intermediate' OR experience_level ILIKE 'experienced';

UPDATE teacher_profiles 
SET experience_level = 'experienced_high' 
WHERE experience_level ILIKE 'expert' OR experience_level ILIKE 'experienced_high';
