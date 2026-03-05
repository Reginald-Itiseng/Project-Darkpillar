-- ============================================================================
-- Database Migration: Account Balance Snapshots (Reconciliation)
-- ============================================================================
-- Tracks app-calculated vs actual account balances over time.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.account_balance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  app_calculated_balance NUMERIC(14, 2) NOT NULL,
  actual_balance NUMERIC(14, 2) NOT NULL,
  delta NUMERIC(14, 2) NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_balance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "account_balance_snapshots_select_own"
  ON public.account_balance_snapshots
  FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "account_balance_snapshots_insert_own"
  ON public.account_balance_snapshots
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "account_balance_snapshots_delete_own"
  ON public.account_balance_snapshots
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE INDEX IF NOT EXISTS idx_account_balance_snapshots_user_account_date
  ON public.account_balance_snapshots(user_id, account_id, snapshot_date DESC);

