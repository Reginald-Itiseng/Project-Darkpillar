import { formatDbError } from './db'

type PgLikeError = Error & {
  code?: string
  constraint?: string
  table?: string
  detail?: string
}

export function toApiError(
  error: unknown,
  fallbackMessage: string
): { status: number; message: string } {
  if (!(error instanceof Error)) {
    return { status: 500, message: fallbackMessage }
  }

  const pgError = error as PgLikeError
  const code = pgError.code
  const message = formatDbError(error)
  const detail = `${pgError.message || ''} ${pgError.detail || ''}`.toLowerCase()
  const constraint = (pgError.constraint || '').toLowerCase()
  const table = (pgError.table || '').toLowerCase()

  if (code === '23505') {
    return { status: 409, message }
  }

  if (code === '23502' || code === '23514' || code === '22P02' || code === '22007' || code === '22003') {
    return { status: 400, message }
  }

  if (code === '23503') {
    if (
      detail.includes('public.users') ||
      table === 'users' ||
      constraint.includes('user') ||
      constraint.includes('users')
    ) {
      return {
        status: 409,
        message:
          'User profile linkage is missing in the financial schema. Sync/migrate user records before creating financial data.',
      }
    }

    return { status: 409, message: 'Referenced record not found or not accessible' }
  }

  return { status: 500, message: fallbackMessage }
}
