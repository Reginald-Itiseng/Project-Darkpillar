-- ============================================================================
-- Database Migration: Point Financial user_id FKs to neon_auth.user
-- ============================================================================
-- Why:
-- Some deployments still have public.* financial tables referencing public.users,
-- while authentication users live in neon_auth."user". This causes inserts like
-- account creation to fail with foreign key linkage errors.
--
-- What this does:
-- 1) Drops FK constraints on public.<table>.user_id that reference public.users
-- 2) Adds FK constraints on public.<table>.user_id -> neon_auth."user"(id)
--    for accounts, transactions, budgets, goals, categories
-- ============================================================================

DO $$
DECLARE
  t_name text;
  fk record;
BEGIN
  FOREACH t_name IN ARRAY ARRAY['accounts', 'transactions', 'budgets', 'goals', 'categories']
  LOOP
    -- Drop any non-canonical user_id foreign keys first
    FOR fk IN
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = t_name
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
        AND NOT (
          ccu.table_schema = 'neon_auth'
          AND ccu.table_name = 'user'
        )
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t_name, fk.constraint_name);
    END LOOP;

    -- Add canonical FK to neon_auth."user" if not already present
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t_name
        AND column_name = 'user_id'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = t_name
        AND tc.constraint_type = 'FOREIGN KEY'
        AND kcu.column_name = 'user_id'
        AND ccu.table_schema = 'neon_auth'
        AND ccu.table_name = 'user'
    ) THEN
      -- Guard against name collisions from partially applied old migrations.
      IF EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
          AND tc.table_name = t_name
          AND tc.constraint_name = t_name || '_user_id_neon_auth_fkey'
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I DROP CONSTRAINT %I',
          t_name,
          t_name || '_user_id_neon_auth_fkey'
        );
      END IF;

      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES neon_auth."user"(id) ON DELETE CASCADE',
        t_name,
        t_name || '_user_id_neon_auth_fkey'
      );
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- Validation query (optional):
-- SELECT tc.table_name, tc.constraint_name, ccu.table_schema AS ref_schema, ccu.table_name AS ref_table
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu
--   ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
-- JOIN information_schema.constraint_column_usage ccu
--   ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
-- WHERE tc.table_schema = 'public'
--   AND kcu.column_name = 'user_id'
--   AND tc.constraint_type = 'FOREIGN KEY'
-- ORDER BY tc.table_name;
-- ============================================================================
