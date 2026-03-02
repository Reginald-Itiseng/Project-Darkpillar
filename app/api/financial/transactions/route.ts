import { NextRequest, NextResponse } from 'next/server'
import { getTransactions, addTransaction } from '@/lib/db-financial'
import { getSessionByToken } from '@/lib/db-auth'

/**
 * Helper to extract user ID from session
 */
async function getUserIdFromRequest(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('session_token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) return null

  const session = await getSessionByToken(token)
  if (!session) return null

  return session.userId
}

/**
 * GET /api/financial/transactions
 * Fetch all transactions for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const transactions = await getTransactions(userId)
    return NextResponse.json({ transactions }, { status: 200 })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/financial/transactions
 * Create a new transaction
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { type, amount, category, description, accountId, toAccountId, date } = body

    // Validation
    if (!type || amount === undefined || amount === null || !category || !accountId || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: type, amount, category, accountId, date' },
        { status: 400 }
      )
    }

    if (!['income', 'expense', 'transfer'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    if (type === 'transfer' && !toAccountId) {
      return NextResponse.json(
        { error: 'toAccountId is required for transfer transactions' },
        { status: 400 }
      )
    }

    const transaction = await addTransaction(userId, {
      type,
      amount,
      category,
      description: description || '',
      accountId,
      toAccountId,
      date,
    })

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    )
  }
}
