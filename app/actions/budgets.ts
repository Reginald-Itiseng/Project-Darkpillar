"use server"

import { sql, type DbBudget } from "@/lib/db"
import { getCurrentUser } from "./auth"
import { revalidatePath } from "next/cache"

export async function getBudgets(month?: string) {
  const user = await getCurrentUser()
  if (!user) return []

  const currentMonth = month || new Date().toISOString().substring(0, 7)

  const result = await sql`
    SELECT * FROM budgets 
    WHERE user_id = ${user.id} AND month = ${currentMonth}
    ORDER BY category ASC
  `

  return result.map((row: DbBudget) => ({
    id: row.id,
    category: row.category,
    amount: Number(row.amount),
    spent: Number(row.spent),
    month: row.month,
    createdAt: row.created_at,
  }))
}

export async function addBudget(data: {
  category: string
  amount: number
  month: string
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    // Calculate spent from existing transactions
    const spentResult = await sql`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE user_id = ${user.id} 
        AND category = ${data.category}
        AND type = 'expense'
        AND date >= ${data.month + "-01"}
        AND date < (${data.month + "-01"}::date + interval '1 month')::date
    `
    const spent = Number(spentResult[0]?.total || 0)

    const result = await sql`
      INSERT INTO budgets (user_id, category, amount, spent, month)
      VALUES (${user.id}, ${data.category}, ${data.amount}, ${spent}, ${data.month})
      ON CONFLICT (user_id, category, month) 
      DO UPDATE SET amount = ${data.amount}
      RETURNING *
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/budgets")
    return { success: true, budget: result[0] }
  } catch (error) {
    console.error("Add budget error:", error)
    return { success: false, error: "Failed to create budget" }
  }
}

export async function updateBudget(
  id: string,
  data: Partial<{
    amount: number
  }>,
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    await sql`
      UPDATE budgets SET
        amount = COALESCE(${data.amount}, amount)
      WHERE id = ${id} AND user_id = ${user.id}
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/budgets")
    return { success: true }
  } catch (error) {
    console.error("Update budget error:", error)
    return { success: false, error: "Failed to update budget" }
  }
}

export async function deleteBudget(id: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    await sql`
      DELETE FROM budgets WHERE id = ${id} AND user_id = ${user.id}
    `
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/budgets")
    return { success: true }
  } catch (error) {
    console.error("Delete budget error:", error)
    return { success: false, error: "Failed to delete budget" }
  }
}
