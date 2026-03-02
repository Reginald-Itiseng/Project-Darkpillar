import { NextRequest, NextResponse } from 'next/server'
import { getBudgets, addBudget, updateBudget, deleteBudget } from '@/lib/db-financial'
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

    const body = await request.json()
    const { category, amount, month } = body

    // Validation
    if (!category || amount === undefined || amount === null || !month) {
      return NextResponse.json(
        { error: 'Missing required fields: category, amount, month' },
        { status: 400 }
      )
    }

    // Validate month format (YYYY-MM)
    if (!/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { error: 'Invalid month format. Use YYYY-MM' },
        { status: 400 }
      )
    }

    const budget = await addBudget(userId, {
      category,
      amount,
      month,
      createdAt: new Date().toISOString(),
    })

    return NextResponse.json({ budget }, { status: 201 })
  } catch (error) {
    console.error('Error creating budget:', error)
    return NextResponse.json(
      { error: 'Failed to create budget' },
      { status: 500 }
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

    const body = await request.json()
    const budget = await updateBudget(userId, budgetId, body)

    if (!budget) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ budget }, { status: 200 })
  } catch (error) {
    console.error('Error updating budget:', error)
    return NextResponse.json(
      { error: 'Failed to update budget' },
      { status: 500 }
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
    return NextResponse.json(
      { error: 'Failed to delete budget' },
      { status: 500 }
    )
  }
}
