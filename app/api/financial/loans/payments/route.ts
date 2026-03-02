import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, ensureFinancialUserLink } from '@/lib/db-auth'
import { toApiError } from '@/lib/api-error'
import { addLoanPayment } from '@/lib/db-financial'

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

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const { loanId, accountId, totalAmount, paymentDate, interestComponent, note } = body

    if (!loanId || !accountId || totalAmount === undefined || !paymentDate) {
      return NextResponse.json(
        { error: 'Missing required fields: loanId, accountId, totalAmount, paymentDate' },
        { status: 400 }
      )
    }

    const parsedTotalAmount = Number(totalAmount)
    if (!Number.isFinite(parsedTotalAmount) || parsedTotalAmount <= 0) {
      return NextResponse.json({ error: 'Total amount must be a number greater than zero' }, { status: 400 })
    }

    const parsedInterestComponent =
      interestComponent === undefined || interestComponent === null || interestComponent === ''
        ? undefined
        : Number(interestComponent)

    if (parsedInterestComponent !== undefined) {
      if (!Number.isFinite(parsedInterestComponent) || parsedInterestComponent < 0) {
        return NextResponse.json({ error: 'Interest component must be a number greater than or equal to zero' }, { status: 400 })
      }
      if (parsedInterestComponent > parsedTotalAmount) {
        return NextResponse.json({ error: 'Interest component cannot exceed total payment amount' }, { status: 400 })
      }
    }

    const normalizedPaymentDate = String(paymentDate).trim()
    if (!isValidDateOnly(normalizedPaymentDate)) {
      return NextResponse.json({ error: 'Payment date must use YYYY-MM-DD format' }, { status: 400 })
    }

    await ensureFinancialUserLink(userId)

    const result = await addLoanPayment(userId, {
      loanId: String(loanId).trim(),
      accountId: String(accountId).trim(),
      totalAmount: parsedTotalAmount,
      paymentDate: normalizedPaymentDate,
      interestComponent: parsedInterestComponent,
      note: note ? String(note).trim() : undefined,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating loan payment:', error)
    const { status, message } = toApiError(error, 'Failed to create loan payment')
    return NextResponse.json({ error: message }, { status })
  }
}
