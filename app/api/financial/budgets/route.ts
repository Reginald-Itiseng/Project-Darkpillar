import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, addBudget, updateBudget, deleteBudget } from '@/lib/db-financial'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { toApiError } from '@/lib/api-error'

function isValidMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false
  const month = Number(value.slice(5, 7))
  return month >= 1 && month <= 12
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
 * GET /api/financial/budgets
 * Fetch all budgets for authenticated user
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

    const budgets = await getBudgets(userId)
    return NextResponse.json({ budgets }, { status: 200 })
  } catch (error) {
    console.error('Error fetching budgets:', error)
    return NextResponse.json(
      { error: 'Failed to fetch budgets' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/financial/budgets
 * Create a new budget
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
    const { category, amount, month, isRecurring } = body

    // Validation
    if (!category || amount === undefined || amount === null || !month) {
      return NextResponse.json(
        { error: 'Missing required fields: category, amount, month' },
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
    const normalizedMonth = String(month).trim()

    if (!normalizedCategory) {
      return NextResponse.json(
        { error: 'Category is required' },
        { status: 400 }
      )
    }

    if (!isValidMonth(normalizedMonth)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }

    await ensureFinancialUserLink(userId)

    const budget = await addBudget(userId, {
      category: normalizedCategory,
      amount: parsedAmount,
      month: normalizedMonth,
      isRecurring: Boolean(isRecurring),
    })

    return NextResponse.json({ budget }, { status: 201 })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Budget already exists')) {
      return NextResponse.json(
        { error: 'Budget already exists for this category and month' },
        { status: 409 }
      )
    }

    console.error('Error creating budget:', error)
    const { status, message } = toApiError(error, 'Failed to create budget')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * PUT /api/financial/budgets/:id
 * Update an existing budget
 */
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const url = new URL(request.url)
    const budgetId = url.searchParams.get('id')

    if (!budgetId) {
      return NextResponse.json(
        { error: 'Budget ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const { amount, isRecurring } = body

    const parsedAmount = Number(amount)
    if (amount === undefined || amount === null || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      )
    }

    await ensureFinancialUserLink(userId)

    const budget = await updateBudget(userId, budgetId, {
      amount: parsedAmount,
      ...(isRecurring !== undefined ? { isRecurring: Boolean(isRecurring) } : {}),
    })

    if (!budget) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ budget }, { status: 200 })
  } catch (error) {
    console.error('Error updating budget:', error)
    const { status, message } = toApiError(error, 'Failed to update budget')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * DELETE /api/financial/budgets/:id
 * Delete a budget
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
    const budgetId = url.searchParams.get('id')

    if (!budgetId) {
      return NextResponse.json(
        { error: 'Budget ID is required' },
        { status: 400 }
      )
    }

    await ensureFinancialUserLink(userId)

    const success = await deleteBudget(userId, budgetId)

    if (!success) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting budget:', error)
    const { status, message } = toApiError(error, 'Failed to delete budget')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
