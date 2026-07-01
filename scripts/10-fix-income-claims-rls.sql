-- ============================================================================
-- Migration: Fix income_claims RLS policies
-- ============================================================================
-- Why:
-- scripts/09-add-income-claims.sql wrote policies using auth.user_id(), a
-- function that does not exist anywhere in this project. Every other
-- financial table uses current_setting('app.user_id', true), which is what
-- lib/db.ts actually sets via set_config() before each query. This migration
-- realigns income_claims with the working pattern used everywhere else.
-- ============================================================================

DROP POLICY IF EXISTS "income_claims_select_own" ON public.income_claims;
CREATE POLICY "income_claims_select_own"
  ON public.income_claims FOR SELECT
  USING (user_id::text = current_setting('app.user_id', true));

DROP POLICY IF EXISTS "income_claims_insert_own" ON public.income_claims;
CREATE POLICY "income_claims_insert_own"
  ON public.income_claims FOR INSERT
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

DROP POLICY IF EXISTS "income_claims_update_own" ON public.income_claims;
CREATE POLICY "income_claims_update_own"
  ON public.income_claims FOR UPDATE
  USING (user_id::text = current_setting('app.user_id', true))
  WITH CHECK (user_id::text = current_setting('app.user_id', true));

DROP POLICY IF EXISTS "income_claims_delete_own" ON public.income_claims;
CREATE POLICY "income_claims_delete_own"
  ON public.income_claims FOR DELETE
  USING (user_id::text = current_setting('app.user_id', true));
