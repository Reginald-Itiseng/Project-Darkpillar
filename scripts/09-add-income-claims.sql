-- ============================================================================
-- Migration: Pending Income Claims
-- ============================================================================
-- Purpose:
-- Track submitted part-time claims before money is credited.
-- This supports cashflow forecasting without inflating current balances.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.income_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  organization_name TEXT NOT NULL,
  hours_worked NUMERIC(10,2) NOT NULL CHECK (hours_worked > 0),
  hourly_rate NUMERIC(12,2) NOT NULL CHECK (hourly_rate >= 0),
  expected_amount NUMERIC(12,2) NOT NULL CHECK (expected_amount > 0),
  submitted_date DATE NOT NULL,
  expected_pay_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.income_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_claims_select_own" ON public.income_claims;
CREATE POLICY "income_claims_select_own"
  ON public.income_claims FOR SELECT
  USING (user_id = auth.user_id());

DROP POLICY IF EXISTS "income_claims_insert_own" ON public.income_claims;
CREATE POLICY "income_claims_insert_own"
  ON public.income_claims FOR INSERT
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "income_claims_update_own" ON public.income_claims;
CREATE POLICY "income_claims_update_own"
  ON public.income_claims FOR UPDATE
  USING (user_id = auth.user_id())
  WITH CHECK (user_id = auth.user_id());

DROP POLICY IF EXISTS "income_claims_delete_own" ON public.income_claims;
CREATE POLICY "income_claims_delete_own"
  ON public.income_claims FOR DELETE
  USING (user_id = auth.user_id());

CREATE INDEX IF NOT EXISTS idx_income_claims_user_status_pay_date
  ON public.income_claims(user_id, status, expected_pay_date);

