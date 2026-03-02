import { NextRequest, NextResponse } from 'next/server'
import { getSessionByToken, getUserById } from '@/lib/db-auth'

export async function GET(request: NextRequest) {
  try {
    // Get session token from cookie or Authorization header
    const token =
      request.cookies.get('session_token')?.value ||
      request.headers.get('Authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No session token found' },
        { status: 401 }
      )
    }

    // Verify session
    const session = await getSessionByToken(token)
    if (!session) {
      return NextResponse.json(
        { authenticated: false, error: 'Invalid or expired session' },
        { status: 401 }
      )
    }

    // Get user data
    const user = await getUserById(session.userId)
    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: 'User not found' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          clearanceLevel: user.clearanceLevel,
          createdAt: user.createdAt,
        },
        session: {
          token,
          expiresAt: session.expiresAt,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Verification error:', error)
    return NextResponse.json(
      { authenticated: false, error: 'Failed to verify session' },
      { status: 500 }
    )
  }
}
