import { Pool, PoolClient, QueryResult } from '@neondatabase/serverless'

// Initialize connection pool
let pool: Pool | null = null

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set')
    }

    pool = new Pool({ connectionString: databaseUrl })
  }
  return pool
}

/**
 * Execute a query with automatic user_id setting for RLS
 */
export async function query<T = any>(
  text: string,
  values?: any[],
  userId?: string
): Promise<QueryResult<T>> {
  const client = await getPool().connect()
  try {
    // Set app.user_id for RLS policies
    if (userId) {
      await client.query(`SET app.user_id = '${userId}'`)
    }

    const result = await client.query<T>(text, values)
    return result
  } finally {
    client.release()
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  userId?: string
): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')

    // Set app.user_id for RLS policies
    if (userId) {
      await client.query(`SET app.user_id = '${userId}'`)
    }

    const result = await callback(client)

    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/**
 * Helper to format error messages
 */
export function formatDbError(error: unknown): string {
  if (error instanceof Error) {
    if ('code' in error) {
      // PostgreSQL error codes
      const pgError = error as any
      switch (pgError.code) {
        case '23505':
          return 'A record with this value already exists'
        case '23503':
          return 'Cannot delete - record is referenced by other data'
        case '23502':
          return 'Required field is missing'
        default:
          return pgError.message || 'Database error occurred'
      }
    }
    return error.message
  }
  return 'Unknown database error'
}


