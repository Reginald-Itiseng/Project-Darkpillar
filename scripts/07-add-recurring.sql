-- ============================================================================
-- Database Migration: Recurring Transactions + Recurring Budgets
-- ============================================================================
-- Adds lightweight recurrence support for daily-use automation:
-- - public.transactions: recurrence metadata + parent linkage
-- - public.budgets: monthly recurrence flag
-- ============================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recurrence_rule TEXT NULL CHECK (recurrence_rule IN ('weekly', 'monthly')),
  ADD COLUMN IF NOT EXISTS recurrence_end_date DATE NULL,
  ADD COLUMN IF NOT EXISTS parent_transaction_id UUID NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_transactions_parent_transaction_id
  ON public.transactions(parent_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_recurrence_rule
  ON public.transactions(recurrence_rule);

ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_budgets_is_recurring
  ON public.budgets(is_recurring);

