import { NextRequest, NextResponse } from 'next/server'
import { deleteSession } from '@/lib/db-auth'

export async function POST(request: NextRequest) {
  try {
    // Get session token from cookie or header
    const token = request.cookies.get('session_token')?.value

    if (token) {
      // Try to delete the session from database
      await deleteSession(token).catch(() => {
        // Silently ignore if session doesn't exist or deletion fails
      })
    }

    // Create response
    const response = NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { status: 200 }
    )

    // Clear the session cookie
    response.cookies.set({
      name: 'session_token',
      value: '',
      httpOnly: true,
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    
    const response = NextResponse.json(
      { success: true, message: 'Logged out' },
      { status: 200 }
    )

    response.cookies.set({
      name: 'session_token',
      value: '',
      httpOnly: true,
      maxAge: 0,
      path: '/',
    })

    return response
  }
}
