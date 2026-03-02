import { NextRequest, NextResponse } from 'next/server'
import { getAccounts, addAccount, updateAccount } from '@/lib/db-financial'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { toApiError } from '@/lib/api-error'
import type { Account } from '@/lib/types'

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

    const body = await request.json().catch(() => ({}))
    const { name, type, balance, interestRate, maturityDate, depositDate, isActive, isPrimary } = body

    if (!name || !type || balance === undefined || balance === null) {
      return NextResponse.json(
        { error: 'Missing required fields: name, type, balance' },
        { status: 400 }
      )
    }

    const normalizedName = String(name).trim().toUpperCase()
    if (normalizedName.length < 2) {
      return NextResponse.json(
        { error: 'Account name must be at least 2 characters' },
        { status: 400 }
      )
    }

    if (!['day-to-day', 'savings-pocket', 'fixed-deposit'].includes(String(type))) {
      return NextResponse.json(
        { error: 'Invalid account type' },
        { status: 400 }
      )
    }

    const parsedBalance = Number(balance)
    if (!Number.isFinite(parsedBalance)) {
      return NextResponse.json(
        { error: 'Balance must be a valid number' },
        { status: 400 }
      )
    }

    let parsedInterestRate: number | undefined
    let normalizedDepositDate: string | undefined
    let normalizedMaturityDate: string | undefined

    if (type === 'fixed-deposit') {
      const interest = Number(interestRate)
      if (!Number.isFinite(interest) || interest <= 0) {
        return NextResponse.json(
          { error: 'Interest rate must be a valid number greater than zero for fixed deposits' },
          { status: 400 }
        )
      }

      if (!depositDate || !maturityDate) {
        return NextResponse.json(
          { error: 'Deposit and maturity dates are required for fixed deposits' },
          { status: 400 }
        )
      }

      normalizedDepositDate = String(depositDate)
      normalizedMaturityDate = String(maturityDate)

      if (!isValidDateOnly(normalizedDepositDate) || !isValidDateOnly(normalizedMaturityDate)) {
        return NextResponse.json(
          { error: 'Deposit and maturity dates must use YYYY-MM-DD format' },
          { status: 400 }
        )
      }

      if (normalizedMaturityDate <= normalizedDepositDate) {
        return NextResponse.json(
          { error: 'Maturity date must be after deposit date' },
          { status: 400 }
        )
      }

      parsedInterestRate = interest
    }

    await ensureFinancialUserLink(userId)

    const account = await addAccount(userId, {
      name: normalizedName,
      type: type as Account['type'],
      balance: parsedBalance,
      interestRate: parsedInterestRate,
      maturityDate: normalizedMaturityDate,
      depositDate: normalizedDepositDate,
      isActive: isActive !== false,
      isPrimary: Boolean(isPrimary),
    })

    return NextResponse.json({ account }, { status: 201 })
  } catch (error) {
    console.error('Error creating account:', error)
    const { status, message } = toApiError(error, 'Failed to create account')
    return NextResponse.json(
      { error: message },
      { status }
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

    const body = await request.json().catch(() => ({}))
    const updates: Partial<Account> = {}

    if ('name' in body) {
      const normalizedName = String(body.name || '').trim().toUpperCase()
      if (normalizedName.length < 2) {
        return NextResponse.json(
          { error: 'Account name must be at least 2 characters' },
          { status: 400 }
        )
      }
      updates.name = normalizedName
    }

    if ('type' in body) {
      if (!['day-to-day', 'savings-pocket', 'fixed-deposit'].includes(String(body.type))) {
        return NextResponse.json(
          { error: 'Invalid account type' },
          { status: 400 }
        )
      }
      updates.type = body.type as Account['type']
    }

    if ('balance' in body) {
      const parsedBalance = Number(body.balance)
      if (!Number.isFinite(parsedBalance)) {
        return NextResponse.json(
          { error: 'Balance must be a valid number' },
          { status: 400 }
        )
      }
      updates.balance = parsedBalance
    }

    if ('interestRate' in body) {
      if (body.interestRate === null || body.interestRate === '') {
        updates.interestRate = null as unknown as number
      } else {
        const parsedInterestRate = Number(body.interestRate)
        if (!Number.isFinite(parsedInterestRate) || parsedInterestRate <= 0) {
          return NextResponse.json(
            { error: 'Interest rate must be a valid number greater than zero' },
            { status: 400 }
          )
        }
        updates.interestRate = parsedInterestRate
      }
    }

    if ('depositDate' in body) {
      if (!body.depositDate) {
        updates.depositDate = null as unknown as string
      } else {
        const normalizedDepositDate = String(body.depositDate)
        if (!isValidDateOnly(normalizedDepositDate)) {
          return NextResponse.json(
            { error: 'Deposit date must use YYYY-MM-DD format' },
            { status: 400 }
          )
        }
        updates.depositDate = normalizedDepositDate
      }
    }

    if ('maturityDate' in body) {
      if (!body.maturityDate) {
        updates.maturityDate = null as unknown as string
      } else {
        const normalizedMaturityDate = String(body.maturityDate)
        if (!isValidDateOnly(normalizedMaturityDate)) {
          return NextResponse.json(
            { error: 'Maturity date must use YYYY-MM-DD format' },
            { status: 400 }
          )
        }
        updates.maturityDate = normalizedMaturityDate
      }
    }

    if ('isActive' in body) {
      updates.isActive = Boolean(body.isActive)
    }

    if ('isPrimary' in body) {
      updates.isPrimary = Boolean(body.isPrimary)
    }

    if (updates.type === 'day-to-day' || updates.type === 'savings-pocket') {
      updates.interestRate = null as unknown as number
      updates.depositDate = null as unknown as string
      updates.maturityDate = null as unknown as string
    }

    if (updates.type === 'fixed-deposit') {
      if (!updates.interestRate || !updates.depositDate || !updates.maturityDate) {
        return NextResponse.json(
          { error: 'Fixed deposits require interest rate, deposit date, and maturity date' },
          { status: 400 }
        )
      }
      if (updates.maturityDate <= updates.depositDate) {
        return NextResponse.json(
          { error: 'Maturity date must be after deposit date' },
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

    await ensureFinancialUserLink(userId)

    const account = await updateAccount(userId, accountId, updates)

    if (!account) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ account }, { status: 200 })
  } catch (error) {
    console.error('Error updating account:', error)
    const { status, message } = toApiError(error, 'Failed to update account')
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
