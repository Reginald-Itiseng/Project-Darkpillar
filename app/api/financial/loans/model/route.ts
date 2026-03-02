import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken } from '@/lib/db-auth'
import { modelSinglePaymentLoan } from '@/lib/loan-model'

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
    const result = modelSinglePaymentLoan({
      principal_amount: body.principal_amount,
      flat_interest_rate: body.flat_interest_rate,
      loan_duration_days: body.loan_duration_days,
      start_date: body.start_date,
    })

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to model loan'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
