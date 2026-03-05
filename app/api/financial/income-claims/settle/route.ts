import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { settleIncomeClaim } from '@/lib/db-financial'
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
    const claimId = String(body?.claimId || '').trim()
    const paymentDate = body?.paymentDate ? String(body.paymentDate).trim() : new Date().toISOString().slice(0, 10)

    if (!claimId) {
      return NextResponse.json({ error: 'claimId is required' }, { status: 400 })
    }

    if (!isValidDateOnly(paymentDate)) {
      return NextResponse.json({ error: 'paymentDate must use YYYY-MM-DD format' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)
    const settled = await settleIncomeClaim(userId, claimId, paymentDate)
    return NextResponse.json(settled, { status: 200 })
  } catch (error) {
    console.error('Error settling income claim:', error)
    const { status, message } = toApiError(error, 'Failed to settle income claim')
    return NextResponse.json({ error: message }, { status })
  }
}

