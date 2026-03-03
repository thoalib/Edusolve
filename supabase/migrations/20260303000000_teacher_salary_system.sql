-- ═══════ DYNAMIC TEACHER SALARY SYSTEM ═══════

-- 1. Add subject column to academic_sessions (to record which subject was taught)
ALTER TABLE academic_sessions ADD COLUMN IF NOT EXISTS subject text;

-- 2. Add board and medium to students (since rate depends on student's board, not teacher)
ALTER TABLE students ADD COLUMN IF NOT EXISTS board text;
-- board values: 'State', 'CBSE', 'ICSE', 'IB', 'IGCSE', 'ISCE' (matches boards table)
ALTER TABLE students ADD COLUMN IF NOT EXISTS medium text;
-- medium values: 'English', 'Malayalam' etc (matches mediums table)

-- 3. Add custom_rates to teacher_profiles (per-teacher overrides)
ALTER TABLE teacher_profiles ADD COLUMN IF NOT EXISTS custom_rates jsonb DEFAULT '{}'::jsonb;
-- custom_rates example: { "french": { "lkg_7": 300, "class_8_10": 310 } }

-- 3. Create salary_rate_config table for admin-configurable master rates
CREATE TABLE IF NOT EXISTS salary_rate_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,           -- 'state_cbse', 'icse_igcse', '_french', '_abacus'
  experience_category text,      -- 'experienced_high', 'experienced', 'fresher' (NULL for board-independent subjects)
  subject_key text NOT NULL,     -- '_default', 'french', 'abacus'
  level text NOT NULL,           -- 'lkg_7', 'class_8_10', 'plus_1_2'
  rate numeric(12,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board, experience_category, subject_key, level)
);

-- 4. Seed the master rate data

-- State/CBSE - Experienced High
INSERT INTO salary_rate_config (board, experience_category, subject_key, level, rate) VALUES
  ('state_cbse', 'experienced_high', '_default', 'lkg_7', 120),
  ('state_cbse', 'experienced_high', '_default', 'class_8_10', 130),
  ('state_cbse', 'experienced_high', '_default', 'plus_1_2', 170)
ON CONFLICT (board, experience_category, subject_key, level) DO NOTHING;

-- State/CBSE - Experienced
INSERT INTO salary_rate_config (board, experience_category, subject_key, level, rate) VALUES
  ('state_cbse', 'experienced', '_default', 'lkg_7', 110),
  ('state_cbse', 'experienced', '_default', 'class_8_10', 120),
  ('state_cbse', 'experienced', '_default', 'plus_1_2', 160)
ON CONFLICT (board, experience_category, subject_key, level) DO NOTHING;

-- State/CBSE - Fresher
INSERT INTO salary_rate_config (board, experience_category, subject_key, level, rate) VALUES
  ('state_cbse', 'fresher', '_default', 'lkg_7', 100),
  ('state_cbse', 'fresher', '_default', 'class_8_10', 110),
  ('state_cbse', 'fresher', '_default', 'plus_1_2', 150)
ON CONFLICT (board, experience_category, subject_key, level) DO NOTHING;

-- ICSE/IGCSE (same rate for all experience levels, use '_any')
INSERT INTO salary_rate_config (board, experience_category, subject_key, level, rate) VALUES
  ('icse_igcse', '_any', '_default', 'lkg_7', 120),
  ('icse_igcse', '_any', '_default', 'class_8_10', 125),
  ('icse_igcse', '_any', '_default', 'plus_1_2', 160)
ON CONFLICT (board, experience_category, subject_key, level) DO NOTHING;

-- French (board & experience independent)
INSERT INTO salary_rate_config (board, experience_category, subject_key, level, rate) VALUES
  ('_any', '_any', 'french', 'lkg_7', 230),
  ('_any', '_any', 'french', 'class_8_10', 240),
  ('_any', '_any', 'french', 'plus_1_2', 260)
ON CONFLICT (board, experience_category, subject_key, level) DO NOTHING;

-- Abacus (board & experience independent)
INSERT INTO salary_rate_config (board, experience_category, subject_key, level, rate) VALUES
  ('_any', '_any', 'abacus', 'lkg_7', 130),
  ('_any', '_any', 'abacus', 'class_8_10', 140),
  ('_any', '_any', 'abacus', 'plus_1_2', 150)
ON CONFLICT (board, experience_category, subject_key, level) DO NOTHING;

-- 5. Backfill subject in academic_sessions from the student's subject field (leads table)
UPDATE academic_sessions AS a
SET subject = l.subject
FROM students s
JOIN leads l ON l.id = s.lead_id
WHERE a.student_id = s.id
  AND a.subject IS NULL
  AND l.subject IS NOT NULL;
