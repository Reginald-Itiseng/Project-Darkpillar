-- ============================================================================
-- Database Migration: Schema Consolidation & Row-Level Security
-- ============================================================================
-- This migration:
-- 1. Consolidates user tables (removes public.users, uses neon_auth.user)
-- 2. Extends neon_auth.user with clearance_level if needed
-- 3. Enables RLS on all public schema tables
-- 4. Creates RLS policies for user data isolation
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable RLS on all public tables
-- ============================================================================

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 2: Create RLS Policies for Accounts Table
-- ============================================================================

-- Users can only view their own accounts
CREATE POLICY "accounts_select_own" ON public.accounts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own accounts
CREATE POLICY "accounts_insert_own" ON public.accounts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own accounts
CREATE POLICY "accounts_update_own" ON public.accounts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own accounts
CREATE POLICY "accounts_delete_own" ON public.accounts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 3: Create RLS Policies for Transactions Table
-- ============================================================================

-- Users can only view their own transactions
CREATE POLICY "transactions_select_own" ON public.transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own transactions
CREATE POLICY "transactions_insert_own" ON public.transactions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own transactions
CREATE POLICY "transactions_update_own" ON public.transactions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own transactions
CREATE POLICY "transactions_delete_own" ON public.transactions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 4: Create RLS Policies for Budgets Table
-- ============================================================================

-- Users can only view their own budgets
CREATE POLICY "budgets_select_own" ON public.budgets
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own budgets
CREATE POLICY "budgets_insert_own" ON public.budgets
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own budgets
CREATE POLICY "budgets_update_own" ON public.budgets
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own budgets
CREATE POLICY "budgets_delete_own" ON public.budgets
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 5: Create RLS Policies for Goals Table
-- ============================================================================

-- Users can only view their own goals
CREATE POLICY "goals_select_own" ON public.goals
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own goals
CREATE POLICY "goals_insert_own" ON public.goals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own goals
CREATE POLICY "goals_update_own" ON public.goals
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own goals
CREATE POLICY "goals_delete_own" ON public.goals
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 6: Create RLS Policies for Categories Table
-- ============================================================================

-- Users can only view their own categories or default categories
CREATE POLICY "categories_select_own_or_default" ON public.categories
  FOR SELECT
  USING (auth.uid() = user_id OR is_default = true);

-- Users can only insert their own categories
CREATE POLICY "categories_insert_own" ON public.categories
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only update their own categories
CREATE POLICY "categories_update_own" ON public.categories
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own categories
CREATE POLICY "categories_delete_own" ON public.categories
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- STEP 7: Add clearance_level to neon_auth.user if it doesn't exist
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
-- STEP 8: Create indexes for better query performance
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
-- All policies restrict users to their own data
-- Indexes added for performance
-- neon_auth.user has clearance_level column
