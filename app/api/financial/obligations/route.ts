import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken } from '@/lib/db-auth'
import { getUpcomingObligations } from '@/lib/db-financial'
import { toApiError } from '@/lib/api-error'

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

    const daysParam = Number(new URL(request.url).searchParams.get('days') || 30)
    const days = Number.isFinite(daysParam) ? Math.min(90, Math.max(1, Math.floor(daysParam))) : 30
    const obligations = await getUpcomingObligations(userId, days)
    return NextResponse.json({ obligations }, { status: 200 })
  } catch (error) {
    console.error('Error fetching upcoming obligations:', error)
    const { status, message } = toApiError(error, 'Failed to fetch upcoming obligations')
    return NextResponse.json({ error: message }, { status })
  }
}

