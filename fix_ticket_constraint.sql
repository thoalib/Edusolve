-- Fix the tickets_category_check constraint to include Student Support categories
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_category_check;

ALTER TABLE public.tickets ADD CONSTRAINT tickets_category_check CHECK (
    category IN (
        'hr_issue',
        'work_issue',
        'technical_issue',
        'finance_issue',
        'general',
        'academic',
        'payment',
        'materials',
        'complaint'
    )
);
