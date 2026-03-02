import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createRegistrationInvite, getSessionByToken, isAdminUser } from '@/lib/db-auth'

function hashInviteCode(inviteCode: string): string {
  return crypto.createHash('sha256').update(inviteCode).digest('hex')
}

function generateInviteCode(): string {
  return `INV-${crypto.randomBytes(6).toString('hex').toUpperCase()}`
}

async function getRequestUserId(request: NextRequest): Promise<string | null> {
  const token =
    request.cookies.get('session_token')?.value ||
    request.headers.get('Authorization')?.replace('Bearer ', '')

  if (!token) return null

  const session = await getSessionByToken(token)
  return session?.userId || null
}

/**
 * POST /api/admin/invites
 * Creates a new registration invite code (admin only).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getRequestUserId(request)
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await isAdminUser(userId)
    if (!admin) {
      return NextResponse.json({ error: 'Administrator access required' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const maxUses = Number.isFinite(body.maxUses) ? Math.max(1, Math.min(100, Number(body.maxUses))) : 1
    const expiresInDays = Number.isFinite(body.expiresInDays)
      ? Math.max(1, Math.min(365, Number(body.expiresInDays)))
      : 14

    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    const inviteCode = generateInviteCode()
    const codeHash = hashInviteCode(inviteCode)

    const invite = await createRegistrationInvite(userId, codeHash, maxUses, expiresAt)

    return NextResponse.json(
      {
        success: true,
        invite: {
          code: inviteCode,
          id: invite.id,
          maxUses: invite.maxUses,
          usesCount: invite.usesCount,
          expiresAt: invite.expiresAt,
          createdAt: invite.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating invite:', error)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }
}
