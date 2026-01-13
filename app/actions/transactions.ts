"use server"

import { sql, type DbTransaction } from "@/lib/db"
import { getCurrentUser } from "./auth"
import { revalidatePath } from "next/cache"

export async function getTransactions() {
  const user = await getCurrentUser()
  if (!user) return []

  const result = await sql`
    SELECT * FROM transactions 
    WHERE user_id = ${user.id}
    ORDER BY date DESC, created_at DESC
  `

  return result.map((row: DbTransaction) => ({
    id: row.id,
    type: row.type,
    amount: Number(row.amount),
    category: row.category,
    description: row.description || "",
    accountId: row.account_id,
    toAccountId: row.to_account_id,
    date: row.date,
    createdAt: row.created_at,
  }))
}

export async function addTransaction(data: {
  type: "income" | "expense" | "transfer"
  amount: number
  category: string
  description: string
  accountId: string
  toAccountId?: string
  date: string
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    // Insert transaction
    const result = await sql`
      INSERT INTO transactions (user_id, type, amount, category, description, account_id, to_account_id, date)
      VALUES (
        ${user.id}, 
        ${data.type}, 
        ${data.amount}, 
        ${data.category},
        ${data.description},
        ${data.accountId},
        ${data.toAccountId || null},
        ${data.date}
      )
      RETURNING *
    `

    // Update account balance(s)
    if (data.type === "income") {
      await sql`
        UPDATE accounts SET balance = balance + ${data.amount}
        WHERE id = ${data.accountId} AND user_id = ${user.id}
      `
    } else if (data.type === "expense") {
      await sql`
        UPDATE accounts SET balance = balance - ${data.amount}
        WHERE id = ${data.accountId} AND user_id = ${user.id}
      `

      // Update budget spent amount
      const month = data.date.substring(0, 7)
      await sql`
        UPDATE budgets SET spent = spent + ${data.amount}
        WHERE user_id = ${user.id} AND category = ${data.category} AND month = ${month}
      `
    } else if (data.type === "transfer" && data.toAccountId) {
      await sql`
        UPDATE accounts SET balance = balance - ${data.amount}
        WHERE id = ${data.accountId} AND user_id = ${user.id}
      `
      await sql`
        UPDATE accounts SET balance = balance + ${data.amount}
        WHERE id = ${data.toAccountId} AND user_id = ${user.id}
      `
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/transactions")
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/budgets")
    return { success: true, transaction: result[0] }
  } catch (error) {
    console.error("Add transaction error:", error)
    return { success: false, error: "Failed to create transaction" }
  }
}

export async function deleteTransaction(id: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    // Get transaction first to reverse the balance change
    const txResult = await sql`
      SELECT * FROM transactions WHERE id = ${id} AND user_id = ${user.id}
    `

    if (txResult.length === 0) {
      return { success: false, error: "Transaction not found" }
    }

    const tx = txResult[0] as DbTransaction

    // Reverse the balance change
    if (tx.type === "income") {
      await sql`
        UPDATE accounts SET balance = balance - ${tx.amount}
        WHERE id = ${tx.account_id} AND user_id = ${user.id}
      `
    } else if (tx.type === "expense") {
      await sql`
        UPDATE accounts SET balance = balance + ${tx.amount}
        WHERE id = ${tx.account_id} AND user_id = ${user.id}
      `
      // Reverse budget spent
      const month = tx.date.substring(0, 7)
      await sql`
        UPDATE budgets SET spent = spent - ${tx.amount}
        WHERE user_id = ${user.id} AND category = ${tx.category} AND month = ${month}
      `
    } else if (tx.type === "transfer" && tx.to_account_id) {
      await sql`
        UPDATE accounts SET balance = balance + ${tx.amount}
        WHERE id = ${tx.account_id} AND user_id = ${user.id}
      `
      await sql`
        UPDATE accounts SET balance = balance - ${tx.amount}
        WHERE id = ${tx.to_account_id} AND user_id = ${user.id}
      `
    }

    // Delete transaction
    await sql`
      DELETE FROM transactions WHERE id = ${id} AND user_id = ${user.id}
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/transactions")
    revalidatePath("/dashboard/accounts")
    revalidatePath("/dashboard/budgets")
    return { success: true }
  } catch (error) {
    console.error("Delete transaction error:", error)
    return { success: false, error: "Failed to delete transaction" }
  }
}
