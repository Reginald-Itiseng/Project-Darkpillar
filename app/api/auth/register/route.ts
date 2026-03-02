import { NextRequest, NextResponse } from 'next/server'
import { createUser, storePasswordHash, getPasswordHash } from '@/lib/db-auth'
import crypto from 'crypto'

/**
 * Hash password using Node.js crypto (simple example)
 * In production, use bcrypt: import bcrypt from 'bcryptjs'
 */
function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, 'salt', 1000, 64, 'sha512').toString('hex')
}

export async function POST(request: NextRequest) {
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

    // Create user
    const userId = crypto.randomUUID()
    const hashedPin = hashPassword(pin)

    const user = await createUser(userId, email, name, 0)
    await storePasswordHash(userId, hashedPin)

    // Return user data (don't return password)
    return NextResponse.json(
      {
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          clearanceLevel: user.clearanceLevel,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    )
  } catch (error) {
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
