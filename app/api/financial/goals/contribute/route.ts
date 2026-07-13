import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { contributeToGoal } from '@/lib/db-financial'
import { toApiError } from '@/lib/api-error'

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('session_token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) return null
  const session = await getSessionByToken(token)
  if (!session) return null
  return session.userId
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const goalId = String(body?.goalId || '').trim()
    const accountId = String(body?.accountId || '').trim()
    const amount = Number(body?.amount)
    const date = body?.date ? String(body.date).trim() : new Date().toISOString().slice(0, 10)

    if (!goalId || !accountId) {
      return NextResponse.json({ error: 'goalId and accountId are required' }, { status: 400 })
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Contribution amount must be greater than zero' }, { status: 400 })
    }

    if (!isValidDateOnly(date)) {
      return NextResponse.json({ error: 'date must use YYYY-MM-DD format' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)
    const result = await contributeToGoal(userId, goalId, { accountId, amount, date })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error recording goal contribution:', error)
    const { status, message } = toApiError(error, 'Failed to record goal contribution')
    return NextResponse.json({ error: message }, { status })
  }
}
