import { NextRequest, NextResponse } from 'next/server'
import { getCategories, addCategory } from '@/lib/db-financial'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { toApiError } from '@/lib/api-error'
import type { Category } from '@/lib/types'

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
 * GET /api/financial/categories
 * Fetch all categories for authenticated user (including default categories)
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

    const categories = await getCategories(userId)
    return NextResponse.json({ categories }, { status: 200 })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/financial/categories
 * Create a new custom category
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
    const { name, type, icon } = body

    // Validation
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type' },
        { status: 400 }
      )
    }

    if (!['income', 'expense'].includes(String(type))) {
      return NextResponse.json(
        { error: 'Invalid category type. Must be "income" or "expense"' },
        { status: 400 }
      )
    }

    const normalizedName = String(name).trim().toUpperCase()
    if (normalizedName.length < 2) {
      return NextResponse.json(
        { error: 'Category name must be at least 2 characters' },
        { status: 400 }
      )
    }

    const normalizedIcon = icon ? String(icon).trim() : undefined

    await ensureFinancialUserLink(userId)

    const category = await addCategory(userId, {
      name: normalizedName,
      type: type as Category['type'],
      icon: normalizedIcon || undefined,
    })

    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('Error creating category:', error)
    const { status, message } = toApiError(error, 'Failed to create category')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
