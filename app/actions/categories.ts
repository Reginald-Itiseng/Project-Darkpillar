"use server"

import { sql, type DbCategory } from "@/lib/db"
import { getCurrentUser } from "./auth"
import { revalidatePath } from "next/cache"

export async function getCategories() {
  const user = await getCurrentUser()

  // Get both default categories and user-specific categories
  const result = await sql`
    SELECT * FROM categories 
    WHERE user_id IS NULL OR user_id = ${user?.id || null}
    ORDER BY is_default DESC, name ASC
  `

  return result.map((row: DbCategory) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    isDefault: row.is_default,
    icon: row.icon,
  }))
}

export async function addCategory(data: {
  name: string
  type: "income" | "expense"
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    const result = await sql`
      INSERT INTO categories (user_id, name, type, is_default)
      VALUES (${user.id}, ${data.name}, ${data.type}, false)
      RETURNING *
    `

    revalidatePath("/dashboard/transactions")
    revalidatePath("/dashboard/budgets")
    return { success: true, category: result[0] }
  } catch (error) {
    console.error("Add category error:", error)
    return { success: false, error: "Failed to create category" }
  }
}
