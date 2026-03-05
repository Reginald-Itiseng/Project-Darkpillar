import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { addAccountBalanceSnapshot, getAccountBalanceSnapshots, getAccounts } from '@/lib/db-financial'
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

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    await ensureFinancialUserLink(userId)
    const snapshots = await getAccountBalanceSnapshots(userId)
    return NextResponse.json({ snapshots }, { status: 200 })
  } catch (error) {
    console.error('Error fetching reconciliation snapshots:', error)
    const { status, message } = toApiError(error, 'Failed to fetch reconciliation snapshots')
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const accountId = String(body.accountId || '').trim()
    const actualBalance = Number(body.actualBalance)
    const note = body.note ? String(body.note).trim() : undefined
    const snapshotDate = body.snapshotDate ? String(body.snapshotDate).trim() : new Date().toISOString().slice(0, 10)

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    if (!Number.isFinite(actualBalance)) {
      return NextResponse.json({ error: 'actualBalance must be a valid number' }, { status: 400 })
    }

    if (!isValidDateOnly(snapshotDate)) {
      return NextResponse.json({ error: 'snapshotDate must use YYYY-MM-DD format' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)

    const accounts = await getAccounts(userId)
    const account = accounts.find((item) => item.id === accountId)
    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    const snapshot = await addAccountBalanceSnapshot(userId, {
      accountId,
      snapshotDate,
      appCalculatedBalance: Number(account.balance) || 0,
      actualBalance,
      note,
    })

    return NextResponse.json({ snapshot }, { status: 201 })
  } catch (error) {
    console.error('Error creating reconciliation snapshot:', error)
    const { status, message } = toApiError(error, 'Failed to create reconciliation snapshot')
    return NextResponse.json({ error: message }, { status })
  }
}

