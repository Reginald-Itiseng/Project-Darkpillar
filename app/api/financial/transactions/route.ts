import { NextRequest, NextResponse } from 'next/server'
import { getTransactions, addTransaction, deleteTransaction } from '@/lib/db-financial'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { toApiError } from '@/lib/api-error'
import type { Transaction } from '@/lib/types'

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

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

    const body = await request.json().catch(() => ({}))
    const { type, amount, category, description, accountId, toAccountId, date } = body

    // Validation
    if (!type || amount === undefined || amount === null || !category || !accountId || !date) {
      return NextResponse.json(
        { error: 'Missing required fields: type, amount, category, accountId, date' },
        { status: 400 }
      )
    }

    if (!['income', 'expense', 'transfer'].includes(String(type))) {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      )
    }

    const parsedAmount = Number(amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    const normalizedCategory = String(category).trim()
    const normalizedAccountId = String(accountId).trim()
    const normalizedToAccountId = toAccountId ? String(toAccountId).trim() : undefined
    const normalizedDate = String(date).trim()

    if (!normalizedCategory) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    if (!normalizedAccountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    if (!isValidDateOnly(normalizedDate)) {
      return NextResponse.json(
        { error: 'Date must use YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    if (type === 'transfer' && !normalizedToAccountId) {
      return NextResponse.json(
        { error: 'toAccountId is required for transfer transactions' },
        { status: 400 }
      )
    }

    if (type === 'transfer' && normalizedAccountId === normalizedToAccountId) {
      return NextResponse.json(
        { error: 'Source and destination accounts must be different' },
        { status: 400 }
      )
    }

    await ensureFinancialUserLink(userId)

    const transaction = await addTransaction(userId, {
      type: type as Transaction['type'],
      amount: parsedAmount,
      category: normalizedCategory,
      description: String(description || '').trim().toUpperCase(),
      accountId: normalizedAccountId,
      toAccountId: normalizedToAccountId,
      date: normalizedDate,
    })

    return NextResponse.json({ transaction }, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    const { status, message } = toApiError(error, 'Failed to create transaction')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * DELETE /api/financial/transactions/:id
 * Delete a transaction and reverse its account/budget effects
 */
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const transactionId = url.searchParams.get('id')

    if (!transactionId) {
      return NextResponse.json(
        { error: 'Transaction ID is required' },
        { status: 400 }
      )
    }

    await ensureFinancialUserLink(userId)

    const success = await deleteTransaction(userId, transactionId)

    if (!success) {
      return NextResponse.json(
        { error: 'Transaction not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting transaction:', error)
    const { status, message } = toApiError(error, 'Failed to delete transaction')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
