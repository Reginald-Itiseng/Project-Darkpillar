import { NextRequest, NextResponse } from 'next/server'
import { getAccounts, addAccount, updateAccount } from '@/lib/db-financial'
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
 * GET /api/financial/accounts
 * Fetch all accounts for authenticated user
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

    const accounts = await getAccounts(userId)
    return NextResponse.json({ accounts }, { status: 200 })
  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/financial/accounts
 * Create a new account
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
    const { name, type, balance, interestRate, maturityDate, depositDate, isActive, isPrimary } = body

    // Validation
    if (!name || !type || balance === undefined || balance === null) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, balance' },
        { status: 400 }
      )
    }

    if (!['day-to-day', 'fixed-deposit'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      )
    }

    const account = await addAccount(userId, {
      name,
      type,
      balance,
      interestRate,
      maturityDate,
      depositDate,
      isActive: isActive !== false,
      isPrimary: isPrimary || false,
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/financial/accounts/:id
 * Update an existing account
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
    const accountId = url.searchParams.get('id')

    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const account = await updateAccount(userId, accountId, body)

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ account }, { status: 200 })
  } catch (error) {
    console.error('Error updating account:', error)
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    )
  }
}
