-- ============================================================================
-- Database Migration: Loans + Loan Payments
-- ============================================================================
-- Adds:
-- - public.loans
-- - public.loan_payments
-- With RLS policies tied to app.user_id
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  lender_name TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  principal NUMERIC(14, 2) NOT NULL CHECK (principal > 0),
  annual_rate NUMERIC(8, 4) NOT NULL CHECK (annual_rate >= 0),
  start_date DATE NOT NULL,
  due_date DATE NOT NULL,
  outstanding_principal NUMERIC(14, 2) NOT NULL CHECK (outstanding_principal >= 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'paid', 'defaulted')),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL,
  total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount > 0),
  principal_component NUMERIC(14, 2) NOT NULL CHECK (principal_component >= 0),
  interest_component NUMERIC(14, 2) NOT NULL CHECK (interest_component >= 0),
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loans_select_own" ON public.loans
  FOR SELECT USING (user_id::text = current_setting('app.user_id', true));
CREATE POLICY "loans_insert_own" ON public.loans
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.user_id', true));
CREATE POLICY "loans_update_own" ON public.loans
  FOR UPDATE USING (user_id::text = current_setting('app.user_id', true));
CREATE POLICY "loans_delete_own" ON public.loans
  FOR DELETE USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "loan_payments_select_own" ON public.loan_payments
  FOR SELECT USING (user_id::text = current_setting('app.user_id', true));
CREATE POLICY "loan_payments_insert_own" ON public.loan_payments
  FOR INSERT WITH CHECK (user_id::text = current_setting('app.user_id', true));
CREATE POLICY "loan_payments_update_own" ON public.loan_payments
  FOR UPDATE USING (user_id::text = current_setting('app.user_id', true));
CREATE POLICY "loan_payments_delete_own" ON public.loan_payments
  FOR DELETE USING (user_id::text = current_setting('app.user_id', true));

CREATE INDEX IF NOT EXISTS idx_loans_user_id ON public.loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON public.loans(status);
CREATE INDEX IF NOT EXISTS idx_loans_due_date ON public.loans(due_date);
CREATE INDEX IF NOT EXISTS idx_loan_payments_user_id ON public.loan_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON public.loan_payments(loan_id);
