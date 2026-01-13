"use server"

import { sql, type DbAccount } from "@/lib/db"
import { getCurrentUser } from "./auth"
import { revalidatePath } from "next/cache"

export async function getAccounts() {
  const user = await getCurrentUser()
  if (!user) return []

  const result = await sql`
    SELECT * FROM accounts 
    WHERE user_id = ${user.id}
    ORDER BY is_primary DESC, created_at ASC
  `

  return result.map((row: DbAccount) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    balance: Number(row.balance),
    interestRate: row.interest_rate ? Number(row.interest_rate) : undefined,
    maturityDate: row.maturity_date,
    depositDate: row.deposit_date,
    isActive: row.is_active,
    isPrimary: row.is_primary,
    createdAt: row.created_at,
  }))
}

export async function addAccount(data: {
  name: string
  type: "day-to-day" | "fixed-deposit"
  balance: number
  interestRate?: number
  maturityDate?: string
  depositDate?: string
  isPrimary?: boolean
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    // If setting as primary, unset other primary accounts
    if (data.isPrimary) {
      await sql`
        UPDATE accounts SET is_primary = false 
        WHERE user_id = ${user.id} AND is_primary = true
      `
    }

    const result = await sql`
      INSERT INTO accounts (user_id, name, type, balance, interest_rate, maturity_date, deposit_date, is_primary)
      VALUES (
        ${user.id}, 
        ${data.name}, 
        ${data.type}, 
        ${data.balance}, 
        ${data.interestRate || null},
        ${data.maturityDate || null},
        ${data.depositDate || null},
        ${data.isPrimary || false}
      )
      RETURNING *
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/accounts")
    return { success: true, account: result[0] }
  } catch (error) {
    console.error("Add account error:", error)
    return { success: false, error: "Failed to create account" }
  }
}

export async function updateAccount(
  id: string,
  data: Partial<{
    name: string
    type: "day-to-day" | "fixed-deposit"
    balance: number
    interestRate: number | null
    maturityDate: string | null
    depositDate: string | null
    isActive: boolean
    isPrimary: boolean
  }>,
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    // If setting as primary, unset other primary accounts
    if (data.isPrimary) {
      await sql`
        UPDATE accounts SET is_primary = false 
        WHERE user_id = ${user.id} AND is_primary = true AND id != ${id}
      `
    }

    await sql`
      UPDATE accounts SET
        name = COALESCE(${data.name}, name),
        type = COALESCE(${data.type}, type),
        balance = COALESCE(${data.balance}, balance),
        interest_rate = COALESCE(${data.interestRate}, interest_rate),
        maturity_date = COALESCE(${data.maturityDate}, maturity_date),
        deposit_date = COALESCE(${data.depositDate}, deposit_date),
        is_active = COALESCE(${data.isActive}, is_active),
        is_primary = COALESCE(${data.isPrimary}, is_primary)
      WHERE id = ${id} AND user_id = ${user.id}
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/accounts")
    return { success: true }
  } catch (error) {
    console.error("Update account error:", error)
    return { success: false, error: "Failed to update account" }
  }
}

export async function deleteAccount(id: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    await sql`
      DELETE FROM accounts WHERE id = ${id} AND user_id = ${user.id}
    `
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/accounts")
    return { success: true }
  } catch (error) {
    console.error("Delete account error:", error)
    return { success: false, error: "Failed to delete account" }
  }
}
