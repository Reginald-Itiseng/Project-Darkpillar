import { NextRequest, NextResponse } from 'next/server'
import { getUserByEmail, getPasswordHash, createSession } from '@/lib/db-auth'
import crypto from 'crypto'

/**
 * Hash password using Node.js crypto (simple example)
 * In production, use bcrypt: import bcrypt from 'bcryptjs'
 */
function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, 'salt', 1000, 64, 'sha512').toString('hex')
}

function verifyPassword(password: string, hash: string): boolean {
  const passwordHash = hashPassword(password)
  return passwordHash === hash
}

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, pin } = body

    // Validation
    if (!email || !pin) {
      return NextResponse.json(
        { error: 'Missing required fields: email, pin' },
        { status: 400 }
      )
    }

    // Find user by email
    const user = await getUserByEmail(email)
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or PIN' },
        { status: 401 }
      )
    }

    // Verify PIN
    const passwordHash = await getPasswordHash(user.id)
    if (!passwordHash || !verifyPassword(pin, passwordHash)) {
      return NextResponse.json(
        { error: 'Invalid email or PIN' },
        { status: 401 }
      )
    }

    // Create session
    const token = generateSessionToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    await createSession(user.id, token, expiresAt)

    // Return user data and session token
    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          clearanceLevel: user.clearanceLevel,
          createdAt: user.createdAt,
        },
        token,
      },
      { status: 200 }
    )

    // Set secure session cookie
    response.cookies.set({
      name: 'session_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Failed to authenticate' },
      { status: 500 }
    )
  }
}
