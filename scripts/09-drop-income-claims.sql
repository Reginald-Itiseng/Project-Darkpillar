-- ============================================================================
-- Migration: Remove Income Claims feature
-- ============================================================================
-- Why:
-- The Income Claims Control feature (scripts/09-add-income-claims.sql and
-- scripts/10-fix-income-claims-rls.sql, now removed) has been fully removed
-- from the app. This drops the table for any database it was previously
-- applied to. Safe to run even if the table was never created.
-- ============================================================================

DROP TABLE IF EXISTS public.income_claims;
