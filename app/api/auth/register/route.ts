import { NextRequest, NextResponse } from 'next/server'
import { createUser, storePasswordHash, createSession, cleanupAuthUser, getUserByEmail } from '@/lib/db-auth'
import crypto from 'crypto'

/**
 * Hash password using Node.js crypto (simple example)
 * In production, use bcrypt: import bcrypt from 'bcryptjs'
 */
function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, 'salt', 1000, 64, 'sha512').toString('hex')
}

function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null

  try {
    const body = await request.json()
    const { email, name, pin } = body

    // Validation
    if (!email || !name || !pin) {
      return NextResponse.json(
        { error: 'Missing required fields: email, name, pin' },
        { status: 400 }
      )
    }

    if (pin.length < 4) {
      return NextResponse.json(
        { error: 'PIN must be at least 4 characters' },
        { status: 400 }
      )
    }

    if (name.length < 3) {
      return NextResponse.json(
        { error: 'Name must be at least 3 characters' },
        { status: 400 }
      )
    }

    // Normalize login key to match client behavior.
    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedName = String(name).trim().toUpperCase()

    const existingUser = await getUserByEmail(normalizedEmail)
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    // Create user
    const userId = crypto.randomUUID()
    createdUserId = userId
    const hashedPin = hashPassword(pin)

    const user = await createUser(userId, normalizedEmail, normalizedName, 0)
    await storePasswordHash(userId, hashedPin)

    // Create session immediately after registration
    const token = generateSessionToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await createSession(userId, token, expiresAt)

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
      { status: 201 }
    )

    response.cookies.set({
      name: 'session_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    if (createdUserId) {
      await cleanupAuthUser(createdUserId)
    }

    console.error('Registration error:', error)

    // Handle duplicate email
    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to register user' },
      { status: 500 }
    )
  }
}
