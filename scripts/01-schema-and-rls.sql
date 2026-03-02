-- ============================================================================
-- Database Migration: Enable Row-Level Security for Neon with Stack Auth
-- ============================================================================
-- This migration:
-- 1. Enables RLS on all public schema financial tables
-- 2. Creates RLS policies using current_setting for user_id (Neon-compatible)
-- 3. Adds clearance_level to neon_auth.user if needed
-- 4. Creates indexes for performance
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable RLS on all public tables
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create RLS Policies for Accounts Table (using app.user_id setting)
-- ============================================================================

CREATE POLICY "accounts_select_own" ON public.accounts
  FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "accounts_insert_own" ON public.accounts
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "accounts_update_own" ON public.accounts
  FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "accounts_delete_own" ON public.accounts
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

-- ============================================================================
-- STEP 3: Create RLS Policies for Transactions Table
-- ============================================================================

CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

-- ============================================================================
-- STEP 4: Create RLS Policies for Budgets Table
-- ============================================================================

CREATE POLICY "budgets_select_own" ON public.budgets
  FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "budgets_insert_own" ON public.budgets
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "budgets_update_own" ON public.budgets
  FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "budgets_delete_own" ON public.budgets
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

-- ============================================================================
-- STEP 5: Create RLS Policies for Goals Table
-- ============================================================================

CREATE POLICY "goals_select_own" ON public.goals
  FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "goals_insert_own" ON public.goals
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "goals_update_own" ON public.goals
  FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "goals_delete_own" ON public.goals
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

-- ============================================================================
-- STEP 6: Create RLS Policies for Categories Table
-- ============================================================================

CREATE POLICY "categories_select_own_or_default" ON public.categories
  FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true) OR is_default = true);

CREATE POLICY "categories_insert_own" ON public.categories
  FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true));

CREATE POLICY "categories_delete_own" ON public.categories
  FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));

-- ============================================================================
-- STEP 7: Create RLS Policies for Users Table
-- ============================================================================

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT
  USING (id::text = current_setting('app.user_id', true));

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE
  USING (id::text = current_setting('app.user_id', true));

-- ============================================================================
-- STEP 8: Add clearance_level to neon_auth.user if it doesn't exist
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'neon_auth' AND table_name = 'user' AND column_name = 'clearance_level'
  ) THEN
    ALTER TABLE neon_auth."user" ADD COLUMN clearance_level INTEGER DEFAULT 0;
    COMMENT ON COLUMN neon_auth."user".clearance_level IS 'User clearance level for financial access control (0=basic, 1=verified, 2=premium)';
  END IF;
END $$;

-- ============================================================================
-- STEP 9: Create indexes for better query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON public.categories(user_id);

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- RLS is now enabled on all public tables
-- All policies use current_setting('app.user_id', true) for Neon compatibility
-- Indexes added for performance
-- neon_auth.user has clearance_level column
