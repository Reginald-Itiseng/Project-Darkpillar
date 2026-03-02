import { query } from './db'
import type { User } from './types'

interface AdminCheckRow {
  isAdmin: boolean
}

interface RegistrationInvite {
  id: string
  maxUses: number
  usesCount: number
  expiresAt: string | null
  isActive: boolean
  createdAt: string
  createdBy: string
}

/**
 * Get user by ID from neon_auth.user
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const result = await query<User>(
      `
      SELECT 
        id, 
        name as username, 
        email, 
        COALESCE(clearance_level, 0) as "clearanceLevel",
        "createdAt"
      FROM neon_auth."user"
      WHERE id = $1
      `,
      [userId]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching user:', error)
    throw error
  }
}

/**
 * Get user by email from neon_auth.user
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const result = await query<User>(
      `
      SELECT 
        id, 
        name as username, 
        email, 
        COALESCE(clearance_level, 0) as "clearanceLevel",
        "createdAt"
      FROM neon_auth."user"
      WHERE email = $1
      `,
      [email]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching user by email:', error)
    throw error
  }
}

/**
 * Check whether a user has administrator privileges.
 */
export async function isAdminUser(userId: string): Promise<boolean> {
  try {
    const result = await query<AdminCheckRow>(
      `
      SELECT (COALESCE(clearance_level, 0) >= 4) as "isAdmin"
      FROM neon_auth."user"
      WHERE id = $1
      `,
      [userId]
    )

    return result.rows[0]?.isAdmin === true
  } catch (error) {
    console.error('Error checking admin privileges:', error)
    throw error
  }
}

/**
 * Create a new user in neon_auth.user
 */
export async function createUser(
  id: string,
  email: string,
  name: string,
  clearanceLevel: number = 0
): Promise<User> {
  try {
    const result = await query<User>(
      `
      INSERT INTO neon_auth."user" (
        id, 
        email, 
        name, 
        clearance_level,
        "emailVerified",
        "createdAt",
        "updatedAt"
      )
      VALUES ($1, $2, $3, $4, false, NOW(), NOW())
      RETURNING 
        id, 
        name as username, 
        email, 
        clearance_level as "clearanceLevel",
        "createdAt"
      `,
      [id, email, name, clearanceLevel]
    )

    if (!result.rows[0]) {
      throw new Error('Failed to create user')
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error creating user:', error)
    throw error
  }
}

/**
 * Update user clearance level
 */
export async function updateUserClearanceLevel(
  userId: string,
  clearanceLevel: number
): Promise<User | null> {
  try {
    const result = await query<User>(
      `
      UPDATE neon_auth."user"
      SET clearance_level = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING 
        id, 
        name as username, 
        email, 
        clearance_level as "clearanceLevel",
        "createdAt"
      `,
      [clearanceLevel, userId]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating user clearance level:', error)
    throw error
  }
}

/**
 * Create a session
 */
export async function createSession(
  userId: string,
  token: string,
  expiresAt: Date
): Promise<any> {
  try {
    const result = await query(
      `
      INSERT INTO neon_auth.session (
        id,
        "userId",
        token,
        "expiresAt",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        NOW(),
        NOW()
      )
      RETURNING id, "userId", token, "expiresAt"
      `,
      [userId, token, expiresAt]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error creating session:', error)
    throw error
  }
}

/**
 * Get session by token
 */
export async function getSessionByToken(token: string): Promise<any | null> {
  try {
    const result = await query(
      `
      SELECT id, "userId", token, "expiresAt", "createdAt"
      FROM neon_auth.session
      WHERE token = $1 AND "expiresAt" > NOW()
      `,
      [token]
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error fetching session:', error)
    throw error
  }
}

/**
 * Delete session by token
 */
export async function deleteSession(token: string): Promise<boolean> {
  try {
    const result = await query(
      `
      DELETE FROM neon_auth.session
      WHERE token = $1
      `,
      [token]
    )

    return result.rowCount ? result.rowCount > 0 : false
  } catch (error) {
    console.error('Error deleting session:', error)
    throw error
  }
}

/**
 * Store password hash (for accounts table)
 */
export async function storePasswordHash(
  userId: string,
  passwordHash: string
): Promise<boolean> {
  try {
    await query(
      `
      WITH updated AS (
        UPDATE neon_auth.account
        SET password = $2, "updatedAt" = NOW()
        WHERE "userId" = $1 AND "providerId" = 'password'
        RETURNING id
      )
      INSERT INTO neon_auth.account (
        id,
        "userId",
        "providerId",
        "accountId",
        password,
        "createdAt",
        "updatedAt"
      )
      SELECT
        gen_random_uuid(),
        $1,
        'password',
        $1,
        $2,
        NOW(),
        NOW()
      WHERE NOT EXISTS (SELECT 1 FROM updated)
      `,
      [userId, passwordHash]
    )

    return true
  } catch (error) {
    console.error('Error storing password hash:', error)
    throw error
  }
}

/**
 * Get password hash for verification
 */
export async function getPasswordHash(userId: string): Promise<string | null> {
  try {
    const result = await query<{ password: string }>(
      `
      SELECT password
      FROM neon_auth.account
      WHERE "userId" = $1 AND "providerId" = 'password'
      ORDER BY "updatedAt" DESC
      LIMIT 1
      `,
      [userId]
    )

    return result.rows[0]?.password || null
  } catch (error) {
    console.error('Error fetching password hash:', error)
    throw error
  }
}

/**
 * Best-effort cleanup for partially created auth records.
 */
export async function cleanupAuthUser(userId: string): Promise<void> {
  try {
    await query(`DELETE FROM neon_auth.session WHERE "userId" = $1`, [userId])
    await query(`DELETE FROM neon_auth.account WHERE "userId" = $1`, [userId])
    await query(`DELETE FROM neon_auth."user" WHERE id = $1`, [userId])
  } catch (error) {
    console.error('Error cleaning up auth user:', error)
  }
}

/**
 * Create an invite code record (hashed code only).
 */
export async function createRegistrationInvite(
  createdByUserId: string,
  codeHash: string,
  maxUses: number,
  expiresAt: Date | null
): Promise<RegistrationInvite> {
  try {
    const result = await query<RegistrationInvite>(
      `
      INSERT INTO public.registration_invites (
        id,
        code_hash,
        created_by,
        max_uses,
        uses_count,
        expires_at,
        is_active,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        0,
        $4,
        true,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        max_uses as "maxUses",
        uses_count as "usesCount",
        expires_at as "expiresAt",
        is_active as "isActive",
        created_at as "createdAt",
        created_by as "createdBy"
      `,
      [codeHash, createdByUserId, maxUses, expiresAt]
    )

    if (!result.rows[0]) {
      throw new Error('Failed to create registration invite')
    }

    return result.rows[0]
  } catch (error) {
    console.error('Error creating registration invite:', error)
    throw error
  }
}

/**
 * Atomically consume one invite usage for a newly created user.
 */
export async function consumeRegistrationInvite(
  codeHash: string,
  usedByUserId: string
): Promise<boolean> {
  try {
    const result = await query(
      `
      WITH updated AS (
        UPDATE public.registration_invites
        SET uses_count = uses_count + 1, updated_at = NOW()
        WHERE
          code_hash = $1
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
          AND uses_count < max_uses
        RETURNING id
      )
      INSERT INTO public.registration_invite_usages (
        id,
        invite_id,
        used_by,
        used_at
      )
      SELECT
        gen_random_uuid(),
        id,
        $2,
        NOW()
      FROM updated
      RETURNING id
      `,
      [codeHash, usedByUserId]
    )

    return (result.rowCount || 0) > 0
  } catch (error) {
    console.error('Error consuming registration invite:', error)
    throw error
  }
}
