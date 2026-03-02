-- ============================================================================
-- Seed Migration: FNB-oriented default categories
-- ============================================================================
-- Inserts global default categories that are useful with CashPal + Savings Pocket
-- flows in Botswana. Safe to run multiple times.
-- ============================================================================

INSERT INTO public.categories (id, user_id, name, type, is_default, icon)
SELECT gen_random_uuid(), NULL, v.name, v.type, true, NULL
FROM (
  VALUES
    ('Interest - Savings Pocket', 'income'),
    ('Loan Disbursement', 'income'),
    ('Bank Fees', 'expense'),
    ('Cash Withdrawal', 'expense'),
    ('CashPal Transfer', 'expense'),
    ('Savings Pocket Contribution', 'expense'),
    ('Savings Pocket Withdrawal', 'expense'),
    ('Loan Interest', 'expense')
) AS v(name, type)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.categories c
  WHERE c.is_default = true
    AND lower(c.name) = lower(v.name)
    AND c.type::text = v.type
);
