import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { toApiError } from '@/lib/api-error'
import { addLoan, getLoanPayments, getLoans, updateLoan } from '@/lib/db-financial'
import type { Loan } from '@/lib/types'

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
    const [loans, payments] = await Promise.all([getLoans(userId), getLoanPayments(userId)])
    return NextResponse.json({ loans, payments }, { status: 200 })
  } catch (error) {
    console.error('Error fetching loans:', error)
    const { status, message } = toApiError(error, 'Failed to fetch loans')
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { lenderName, accountId, principal, annualRate, startDate, dueDate, notes } = body

    if (!lenderName || !accountId || principal === undefined || annualRate === undefined || !startDate || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields: lenderName, accountId, principal, annualRate, startDate, dueDate' },
        { status: 400 }
      )
    }

    const normalizedLenderName = String(lenderName).trim().toUpperCase()
    const normalizedAccountId = String(accountId).trim()
    const parsedPrincipal = Number(principal)
    const parsedAnnualRate = Number(annualRate)
    const normalizedStartDate = String(startDate).trim()
    const normalizedDueDate = String(dueDate).trim()

    if (normalizedLenderName.length < 2) {
      return NextResponse.json({ error: 'Lender name must be at least 2 characters' }, { status: 400 })
    }

    if (!Number.isFinite(parsedPrincipal) || parsedPrincipal <= 0) {
      return NextResponse.json({ error: 'Principal must be a number greater than zero' }, { status: 400 })
    }

    if (!Number.isFinite(parsedAnnualRate) || parsedAnnualRate < 0) {
      return NextResponse.json({ error: 'Annual rate must be a number greater than or equal to zero' }, { status: 400 })
    }

    if (!isValidDateOnly(normalizedStartDate) || !isValidDateOnly(normalizedDueDate)) {
      return NextResponse.json({ error: 'Dates must use YYYY-MM-DD format' }, { status: 400 })
    }

    if (normalizedDueDate < normalizedStartDate) {
      return NextResponse.json({ error: 'Due date cannot be before start date' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)

    const loan = await addLoan(userId, {
      lenderName: normalizedLenderName,
      accountId: normalizedAccountId,
      principal: parsedPrincipal,
      annualRate: parsedAnnualRate,
      startDate: normalizedStartDate,
      dueDate: normalizedDueDate,
      notes: notes ? String(notes).trim() : undefined,
    })

    return NextResponse.json({ loan }, { status: 201 })
  } catch (error) {
    console.error('Error creating loan:', error)
    const { status, message } = toApiError(error, 'Failed to create loan')
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const loanId = new URL(request.url).searchParams.get('id')
    if (!loanId) return NextResponse.json({ error: 'Loan ID is required' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const updates: Partial<Loan> = {}

    if ('lenderName' in body) {
      const lenderName = String(body.lenderName || '').trim().toUpperCase()
      if (lenderName.length < 2) {
        return NextResponse.json({ error: 'Lender name must be at least 2 characters' }, { status: 400 })
      }
      updates.lenderName = lenderName
    }

    if ('annualRate' in body) {
      const annualRate = Number(body.annualRate)
      if (!Number.isFinite(annualRate) || annualRate < 0) {
        return NextResponse.json({ error: 'Annual rate must be a number greater than or equal to zero' }, { status: 400 })
      }
      updates.annualRate = annualRate
    }

    if ('dueDate' in body) {
      const dueDate = String(body.dueDate || '').trim()
      if (!isValidDateOnly(dueDate)) {
        return NextResponse.json({ error: 'Due date must use YYYY-MM-DD format' }, { status: 400 })
      }
      updates.dueDate = dueDate
    }

    if ('status' in body) {
      const status = String(body.status || '')
      if (!['active', 'paid', 'defaulted'].includes(status)) {
        return NextResponse.json({ error: 'Invalid loan status' }, { status: 400 })
      }
      updates.status = status as Loan['status']
    }

    if ('notes' in body) {
      updates.notes = body.notes ? String(body.notes).trim() : undefined
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)

    const loan = await updateLoan(userId, loanId, updates)
    if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
    return NextResponse.json({ loan }, { status: 200 })
  } catch (error) {
    console.error('Error updating loan:', error)
    const { status, message } = toApiError(error, 'Failed to update loan')
    return NextResponse.json({ error: message }, { status })
  }
}
