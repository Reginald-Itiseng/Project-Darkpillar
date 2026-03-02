import { query } from './db'
import type { User } from './types'
import crypto from 'crypto'

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

interface PublicUsersColumn {
  column_name: string
  is_nullable: 'YES' | 'NO'
  column_default: string | null
}

interface LinkSourceUser {
  id: string
  name: string | null
  email: string | null
  clearanceLevel: number
}

interface PasswordHashRow {
  password: string | null
}

let publicUsersColumnsCache: PublicUsersColumn[] | null = null

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`
}

function linkageError(message: string): Error & { statusCode: number } {
  const error = new Error(message) as Error & { statusCode: number }
  error.statusCode = 409
  return error
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
 * Ensure a matching profile exists in public.users when legacy foreign keys
 * still point there (instead of neon_auth.user).
 */
export async function ensureFinancialUserLink(userId: string): Promise<void> {
  try {
    if (!publicUsersColumnsCache) {
      const columnsResult = await query<PublicUsersColumn>(
        `
        SELECT column_name, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
        ORDER BY ordinal_position
        `
      )

      publicUsersColumnsCache = columnsResult.rows
    }

    const columns = publicUsersColumnsCache
    if (!columns || columns.length === 0) {
      return
    }

    const columnNames = new Set(columns.map((col) => col.column_name))
    const keyColumn = columnNames.has('id')
      ? 'id'
      : columnNames.has('user_id')
        ? 'user_id'
        : null

    if (!keyColumn) {
      throw linkageError('public.users is missing an id key column (expected id or user_id).')
    }

    const existing = await query<{ exists: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 FROM public.users WHERE ${quoteIdent(keyColumn)} = $1
      ) as exists
      `,
      [userId]
    )

    if (existing.rows[0]?.exists) {
      return
    }

    const userResult = await query<LinkSourceUser>(
      `
      SELECT
        id,
        name,
        email,
        COALESCE(clearance_level, 0) as "clearanceLevel"
      FROM neon_auth."user"
      WHERE id = $1
      `,
      [userId]
    )

    const sourceUser = userResult.rows[0]
    if (!sourceUser) {
      throw linkageError('Authenticated user record not found in neon_auth.user.')
    }

    const passwordResult = await query<PasswordHashRow>(
      `
      SELECT password
      FROM neon_auth.account
      WHERE "userId" = $1 AND "providerId" = 'password'
      ORDER BY "updatedAt" DESC
      LIMIT 1
      `,
      [userId]
    )

    const fallbackPin = crypto.randomBytes(24).toString('hex')
    const hashedPin = passwordResult.rows[0]?.password || fallbackPin

    const nowIso = new Date().toISOString()
    const valueByColumn: Record<string, unknown> = {
      id: sourceUser.id,
      user_id: sourceUser.id,
      username: sourceUser.name || sourceUser.email || sourceUser.id,
      name: sourceUser.name || sourceUser.email || sourceUser.id,
      email: sourceUser.email,
      clearance_level: sourceUser.clearanceLevel,
      clearanceLevel: sourceUser.clearanceLevel,
      pin: hashedPin,
      password: hashedPin,
      pin_hash: hashedPin,
      password_hash: hashedPin,
      created_at: nowIso,
      createdAt: nowIso,
      updated_at: nowIso,
      updatedAt: nowIso,
    }

    const requiredWithoutDefault = columns.filter(
      (col) => col.is_nullable === 'NO' && col.column_default === null
    )

    const missingRequired = requiredWithoutDefault
      .map((col) => col.column_name)
      .filter((name) => valueByColumn[name] === undefined || valueByColumn[name] === null)

    if (missingRequired.length > 0) {
      throw linkageError(
        `Cannot auto-sync public.users due to required columns without values: ${missingRequired.join(', ')}.`
      )
    }

    const insertColumns = columns
      .map((col) => col.column_name)
      .filter((name) => valueByColumn[name] !== undefined && valueByColumn[name] !== null)

    if (insertColumns.length === 0) {
      throw linkageError('Cannot auto-sync public.users: no compatible columns were found.')
    }

    const values = insertColumns.map((column) => valueByColumn[column])
    const placeholders = insertColumns.map((_, index) => `$${index + 1}`)

    await query(
      `
      INSERT INTO public.users (${insertColumns.map(quoteIdent).join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT DO NOTHING
      `,
      values
    )
  } catch (error) {
    if (
      error instanceof Error &&
      (error as Error & { statusCode?: number }).statusCode === 409
    ) {
      throw error
    }

    console.error('Error ensuring financial user link:', error)
    throw linkageError(
      'User profile linkage is missing in the financial schema. Sync/migrate user records before creating financial data.'
    )
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
