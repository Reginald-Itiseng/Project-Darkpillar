-- ============================================================================
-- Migration: Bank / mobile-money provider metadata for accounts
-- ============================================================================
-- Why:
-- Account creation now lets the user pick a real-world institution (e.g. FNB
-- and the specific product, like Smart Account or Flexi Fixed Deposit) or a
-- mobile money carrier (Orange Money / MyZaka / Smega) instead of a free-text
-- name only. These two columns are descriptive metadata only -- the existing
-- `type` column (day-to-day / savings-pocket / fixed-deposit) remains the one
-- that drives balance and interest logic, so no data backfill is needed.
-- ============================================================================

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS institution TEXT,
  ADD COLUMN IF NOT EXISTS account_product TEXT;
