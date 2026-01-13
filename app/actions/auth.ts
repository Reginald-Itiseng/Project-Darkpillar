"use server"

import { sql, type DbUser } from "@/lib/db"
import { cookies } from "next/headers"

export async function registerUser(username: string, pin: string) {
  try {
    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE username = ${username}
    `

    if (existingUser.length > 0) {
      return { success: false, error: "Agent designation already exists" }
    }

    // Create new user
    const result = await sql`
      INSERT INTO users (username, pin, clearance_level)
      VALUES (${username}, ${pin}, 1)
      RETURNING id, username, clearance_level, created_at
    `

    const user = result[0] as DbUser

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set("scp_user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        clearanceLevel: user.clearance_level,
        createdAt: user.created_at,
      },
    }
  } catch (error) {
    console.error("Registration error:", error)
    return { success: false, error: "Failed to register. Please try again." }
  }
}

export async function loginUser(username: string, pin: string) {
  try {
    const result = await sql`
      SELECT id, username, pin, clearance_level, created_at
      FROM users WHERE username = ${username}
    `

    if (result.length === 0) {
      return { success: false, error: "Agent not found in database" }
    }

    const user = result[0] as DbUser

    if (user.pin !== pin) {
      return { success: false, error: "Invalid access code" }
    }

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set("scp_user_id", user.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 1 week
    })

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        clearanceLevel: user.clearance_level,
        createdAt: user.created_at,
      },
    }
  } catch (error) {
    console.error("Login error:", error)
    return { success: false, error: "Authentication failed. Please try again." }
  }
}

export async function logoutUser() {
  const cookieStore = await cookies()
  cookieStore.delete("scp_user_id")
  return { success: true }
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get("scp_user_id")?.value

    if (!userId) {
      return null
    }

    const result = await sql`
      SELECT id, username, clearance_level, created_at
      FROM users WHERE id = ${userId}
    `

    if (result.length === 0) {
      return null
    }

    const user = result[0] as DbUser
    return {
      id: user.id,
      username: user.username,
      clearanceLevel: user.clearance_level,
      createdAt: user.created_at,
    }
  } catch (error) {
    console.error("Get current user error:", error)
    return null
  }
}
