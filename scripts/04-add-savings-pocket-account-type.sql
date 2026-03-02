-- ============================================================================
-- Database Migration: Allow savings-pocket account type
-- ============================================================================
-- Why:
-- App now supports a third account type:
--   - day-to-day (CashPal)
--   - savings-pocket
--   - fixed-deposit
--
-- This migration updates any existing CHECK constraint on public.accounts.type
-- that blocks the new value.
-- ============================================================================

DO $$
DECLARE
  chk record;
BEGIN
  FOR chk IN
    SELECT con.conname AS constraint_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'accounts'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%type%'
  LOOP
    EXECUTE format('ALTER TABLE public.accounts DROP CONSTRAINT %I', chk.constraint_name);
  END LOOP;

  ALTER TABLE public.accounts
    ADD CONSTRAINT accounts_type_check
    CHECK (type IN ('day-to-day', 'savings-pocket', 'fixed-deposit'));
END $$;
