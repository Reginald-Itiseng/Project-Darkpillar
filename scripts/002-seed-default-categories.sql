-- Insert default categories (these are shared, user_id is NULL for defaults)
INSERT INTO categories (id, user_id, name, type, is_default) VALUES
  (gen_random_uuid(), NULL, 'Salary', 'income', true),
  (gen_random_uuid(), NULL, 'Freelance', 'income', true),
  (gen_random_uuid(), NULL, 'Investments', 'income', true),
  (gen_random_uuid(), NULL, 'Other Income', 'income', true),
  (gen_random_uuid(), NULL, 'Food & Dining', 'expense', true),
  (gen_random_uuid(), NULL, 'Transportation', 'expense', true),
  (gen_random_uuid(), NULL, 'Utilities', 'expense', true),
  (gen_random_uuid(), NULL, 'Entertainment', 'expense', true),
  (gen_random_uuid(), NULL, 'Shopping', 'expense', true),
  (gen_random_uuid(), NULL, 'Healthcare', 'expense', true),
  (gen_random_uuid(), NULL, 'Education', 'expense', true),
  (gen_random_uuid(), NULL, 'Bills & Fees', 'expense', true),
  (gen_random_uuid(), NULL, 'Savings', 'expense', true),
  (gen_random_uuid(), NULL, 'Other', 'expense', true),
  (gen_random_uuid(), NULL, 'Rent', 'expense', true)
ON CONFLICT DO NOTHING;
