import { NextRequest, NextResponse } from 'next/server'
import { getGoals, addGoal, updateGoal, deleteGoal } from '@/lib/db-financial'
import { getSessionByToken } from '@/lib/db-auth'
import { toApiError } from '@/lib/api-error'
import type { Goal } from '@/lib/types'

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
 * GET /api/financial/goals
 * Fetch all goals for authenticated user
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

    const goals = await getGoals(userId)
    return NextResponse.json({ goals }, { status: 200 })
  } catch (error) {
    console.error('Error fetching goals:', error)
    return NextResponse.json(
      { error: 'Failed to fetch goals' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/financial/goals
 * Create a new goal
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
    const { name, targetAmount, currentAmount, deadline, priority, status } = body

    // Validation
    if (!name || targetAmount === undefined || targetAmount === null || !deadline) {
      return NextResponse.json(
        { error: 'Missing required fields: name, targetAmount, deadline' },
        { status: 400 }
      )
    }

    const normalizedName = String(name).trim().toUpperCase()
    if (normalizedName.length < 2) {
      return NextResponse.json(
        { error: 'Goal name must be at least 2 characters' },
        { status: 400 }
      )
    }

    const parsedTargetAmount = Number(targetAmount)
    const parsedCurrentAmount = Number(currentAmount ?? 0)

    if (!Number.isFinite(parsedTargetAmount) || parsedTargetAmount <= 0) {
      return NextResponse.json(
        { error: 'Target amount must be a valid number greater than zero' },
        { status: 400 }
      )
    }

    if (!Number.isFinite(parsedCurrentAmount) || parsedCurrentAmount < 0) {
      return NextResponse.json(
        { error: 'Current amount must be a valid number greater than or equal to zero' },
        { status: 400 }
      )
    }

    if (parsedCurrentAmount > parsedTargetAmount) {
      return NextResponse.json(
        { error: 'Current amount cannot exceed target amount' },
        { status: 400 }
      )
    }

    const normalizedDeadline = String(deadline).trim()
    if (!isValidDateOnly(normalizedDeadline)) {
      return NextResponse.json(
        { error: 'Deadline must use YYYY-MM-DD format' },
        { status: 400 }
      )
    }

    const normalizedPriority = String(priority || 'medium')
    if (!['low', 'medium', 'high', 'critical'].includes(normalizedPriority)) {
      return NextResponse.json(
        { error: 'Invalid priority level' },
        { status: 400 }
      )
    }

    const normalizedStatus = String(status || 'active')
    if (!['active', 'completed', 'paused'].includes(normalizedStatus)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    const goal = await addGoal(userId, {
      name: normalizedName,
      targetAmount: parsedTargetAmount,
      currentAmount: parsedCurrentAmount,
      deadline: normalizedDeadline,
      priority: normalizedPriority as Goal['priority'],
      status: normalizedStatus as Goal['status'],
    })

    return NextResponse.json({ goal }, { status: 201 })
  } catch (error) {
    console.error('Error creating goal:', error)
    const { status, message } = toApiError(error, 'Failed to create goal')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * PUT /api/financial/goals/:id
 * Update an existing goal
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
    const goalId = url.searchParams.get('id')

    if (!goalId) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const updates: Partial<Goal> = {}

    if ('name' in body) {
      const normalizedName = String(body.name || '').trim().toUpperCase()
      if (normalizedName.length < 2) {
        return NextResponse.json(
          { error: 'Goal name must be at least 2 characters' },
          { status: 400 }
        )
      }
      updates.name = normalizedName
    }

    if ('targetAmount' in body) {
      const parsedTargetAmount = Number(body.targetAmount)
      if (!Number.isFinite(parsedTargetAmount) || parsedTargetAmount <= 0) {
        return NextResponse.json(
          { error: 'Target amount must be a valid number greater than zero' },
          { status: 400 }
        )
      }
      updates.targetAmount = parsedTargetAmount
    }

    if ('currentAmount' in body) {
      const parsedCurrentAmount = Number(body.currentAmount)
      if (!Number.isFinite(parsedCurrentAmount) || parsedCurrentAmount < 0) {
        return NextResponse.json(
          { error: 'Current amount must be a valid number greater than or equal to zero' },
          { status: 400 }
        )
      }
      updates.currentAmount = parsedCurrentAmount
    }

    if ('deadline' in body) {
      const normalizedDeadline = String(body.deadline || '').trim()
      if (!isValidDateOnly(normalizedDeadline)) {
        return NextResponse.json(
          { error: 'Deadline must use YYYY-MM-DD format' },
          { status: 400 }
        )
      }
      updates.deadline = normalizedDeadline
    }

    if ('priority' in body) {
      const normalizedPriority = String(body.priority)
      if (!['low', 'medium', 'high', 'critical'].includes(normalizedPriority)) {
        return NextResponse.json(
          { error: 'Invalid priority level' },
          { status: 400 }
        )
      }
      updates.priority = normalizedPriority as Goal['priority']
    }

    if ('status' in body) {
      const normalizedStatus = String(body.status)
      if (!['active', 'completed', 'paused'].includes(normalizedStatus)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        )
      }
      updates.status = normalizedStatus as Goal['status']
    }

    if (updates.currentAmount !== undefined && updates.targetAmount !== undefined) {
      if (updates.currentAmount > updates.targetAmount) {
        return NextResponse.json(
          { error: 'Current amount cannot exceed target amount' },
          { status: 400 }
        )
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided for update' },
        { status: 400 }
      )
    }

    const goal = await updateGoal(userId, goalId, updates)

    if (!goal) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ goal }, { status: 200 })
  } catch (error) {
    console.error('Error updating goal:', error)
    const { status, message } = toApiError(error, 'Failed to update goal')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}

/**
 * DELETE /api/financial/goals/:id
 * Delete a goal
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
    const goalId = url.searchParams.get('id')

    if (!goalId) {
      return NextResponse.json(
        { error: 'Goal ID is required' },
        { status: 400 }
      )
    }

    const success = await deleteGoal(userId, goalId)

    if (!success) {
      return NextResponse.json(
        { error: 'Goal not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error deleting goal:', error)
    const { status, message } = toApiError(error, 'Failed to delete goal')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
