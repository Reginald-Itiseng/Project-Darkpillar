import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { addIncomeClaim, getAccounts, getIncomeClaims, updateIncomeClaim } from '@/lib/db-financial'
import { toApiError } from '@/lib/api-error'
import type { IncomeClaim } from '@/lib/types'

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
    const claims = await getIncomeClaims(userId)
    return NextResponse.json({ claims }, { status: 200 })
  } catch (error) {
    console.error('Error fetching income claims:', error)
    const { status, message } = toApiError(error, 'Failed to fetch income claims')
    return NextResponse.json({ error: message }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const {
      organizationName,
      accountId,
      hoursWorked,
      hourlyRate,
      expectedAmount,
      submittedDate,
      expectedPayDate,
      notes,
    } = body

    if (!organizationName || !accountId || hoursWorked === undefined || hourlyRate === undefined || !submittedDate || !expectedPayDate) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationName, accountId, hoursWorked, hourlyRate, submittedDate, expectedPayDate' },
        { status: 400 }
      )
    }

    const normalizedOrganizationName = String(organizationName).trim().toUpperCase()
    const normalizedAccountId = String(accountId).trim()
    const parsedHoursWorked = Number(hoursWorked)
    const parsedHourlyRate = Number(hourlyRate)
    const parsedExpectedAmount =
      expectedAmount === undefined || expectedAmount === null || expectedAmount === ''
        ? parsedHoursWorked * parsedHourlyRate
        : Number(expectedAmount)
    const normalizedSubmittedDate = String(submittedDate).trim()
    const normalizedExpectedPayDate = String(expectedPayDate).trim()

    if (normalizedOrganizationName.length < 2) {
      return NextResponse.json({ error: 'Organization name must be at least 2 characters' }, { status: 400 })
    }

    if (!Number.isFinite(parsedHoursWorked) || parsedHoursWorked <= 0) {
      return NextResponse.json({ error: 'Hours worked must be greater than zero' }, { status: 400 })
    }

    if (!Number.isFinite(parsedHourlyRate) || parsedHourlyRate < 0) {
      return NextResponse.json({ error: 'Hourly rate must be zero or greater' }, { status: 400 })
    }

    if (!Number.isFinite(parsedExpectedAmount) || parsedExpectedAmount <= 0) {
      return NextResponse.json({ error: 'Expected amount must be greater than zero' }, { status: 400 })
    }

    if (!isValidDateOnly(normalizedSubmittedDate) || !isValidDateOnly(normalizedExpectedPayDate)) {
      return NextResponse.json({ error: 'Dates must use YYYY-MM-DD format' }, { status: 400 })
    }

    if (normalizedExpectedPayDate < normalizedSubmittedDate) {
      return NextResponse.json({ error: 'Expected pay date cannot be before submitted date' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)
    const accounts = await getAccounts(userId)
    if (!accounts.some((item) => item.id === normalizedAccountId && item.isActive)) {
      return NextResponse.json({ error: 'Selected account is invalid or inactive' }, { status: 400 })
    }

    const claim = await addIncomeClaim(userId, {
      organizationName: normalizedOrganizationName,
      accountId: normalizedAccountId,
      hoursWorked: parsedHoursWorked,
      hourlyRate: parsedHourlyRate,
      expectedAmount: parsedExpectedAmount,
      submittedDate: normalizedSubmittedDate,
      expectedPayDate: normalizedExpectedPayDate,
      notes: notes ? String(notes).trim() : undefined,
    })

    return NextResponse.json({ claim }, { status: 201 })
  } catch (error) {
    console.error('Error creating income claim:', error)
    const { status, message } = toApiError(error, 'Failed to create income claim')
    return NextResponse.json({ error: message }, { status })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const claimId = new URL(request.url).searchParams.get('id')
    if (!claimId) return NextResponse.json({ error: 'Claim ID is required' }, { status: 400 })

    const body = await request.json().catch(() => ({}))
    const updates: {
      expectedPayDate?: string
      expectedAmount?: number
      status?: IncomeClaim['status']
      notes?: string
    } = {}

    if ('expectedPayDate' in body) {
      const expectedPayDate = String(body.expectedPayDate || '').trim()
      if (!isValidDateOnly(expectedPayDate)) {
        return NextResponse.json({ error: 'Expected pay date must use YYYY-MM-DD format' }, { status: 400 })
      }
      updates.expectedPayDate = expectedPayDate
    }

    if ('expectedAmount' in body) {
      const expectedAmount = Number(body.expectedAmount)
      if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
        return NextResponse.json({ error: 'Expected amount must be greater than zero' }, { status: 400 })
      }
      updates.expectedAmount = expectedAmount
    }

    if ('status' in body) {
      const status = String(body.status || '')
      if (!['pending', 'paid', 'cancelled'].includes(status)) {
        return NextResponse.json({ error: 'Invalid claim status' }, { status: 400 })
      }
      if (status === 'paid') {
        return NextResponse.json(
          { error: 'Use the mark-as-paid action to settle this claim and post income.' },
          { status: 400 }
        )
      }
      updates.status = status as IncomeClaim['status']
    }

    if ('notes' in body) {
      updates.notes = body.notes ? String(body.notes).trim() : undefined
    }

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)
    const claim = await updateIncomeClaim(userId, claimId, updates)
    if (!claim) return NextResponse.json({ error: 'Income claim not found' }, { status: 404 })

    return NextResponse.json({ claim }, { status: 200 })
  } catch (error) {
    console.error('Error updating income claim:', error)
    const { status, message } = toApiError(error, 'Failed to update income claim')
    return NextResponse.json({ error: message }, { status })
  }
}
