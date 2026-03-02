-- ============================================================================
-- Database Migration: Registration Invites (Invite-Only Signups)
-- ============================================================================
-- This migration creates:
-- 1) public.registration_invites: invite metadata and usage limits
-- 2) public.registration_invite_usages: audit trail of who used invites
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.registration_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE RESTRICT,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  uses_count INTEGER NOT NULL DEFAULT 0 CHECK (uses_count >= 0),
  expires_at TIMESTAMPTZ NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_invites_active
  ON public.registration_invites (is_active, expires_at);

CREATE INDEX IF NOT EXISTS idx_registration_invites_created_by
  ON public.registration_invites (created_by);

CREATE TABLE IF NOT EXISTS public.registration_invite_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.registration_invites(id) ON DELETE CASCADE,
  used_by UUID NOT NULL REFERENCES neon_auth."user"(id) ON DELETE CASCADE,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registration_invite_usages_invite_id
  ON public.registration_invite_usages (invite_id);

CREATE INDEX IF NOT EXISTS idx_registration_invite_usages_used_by
  ON public.registration_invite_usages (used_by);

-- ============================================================================
-- Migration Complete
-- ============================================================================
