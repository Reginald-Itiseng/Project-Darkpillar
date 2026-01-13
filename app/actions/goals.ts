"use server"

import { sql, type DbGoal } from "@/lib/db"
import { getCurrentUser } from "./auth"
import { revalidatePath } from "next/cache"

export async function getGoals() {
  const user = await getCurrentUser()
  if (!user) return []

  const result = await sql`
    SELECT * FROM goals 
    WHERE user_id = ${user.id}
    ORDER BY 
      CASE priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END,
      deadline ASC
  `

  return result.map((row: DbGoal) => ({
    id: row.id,
    name: row.name,
    targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount),
    deadline: row.deadline,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
  }))
}

export async function addGoal(data: {
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
  priority: "low" | "medium" | "high" | "critical"
}) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    const result = await sql`
      INSERT INTO goals (user_id, name, target_amount, current_amount, deadline, priority, status)
      VALUES (${user.id}, ${data.name}, ${data.targetAmount}, ${data.currentAmount}, ${data.deadline}, ${data.priority}, 'active')
      RETURNING *
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/goals")
    return { success: true, goal: result[0] }
  } catch (error) {
    console.error("Add goal error:", error)
    return { success: false, error: "Failed to create goal" }
  }
}

export async function updateGoal(
  id: string,
  data: Partial<{
    name: string
    targetAmount: number
    currentAmount: number
    deadline: string
    priority: "low" | "medium" | "high" | "critical"
    status: "active" | "completed" | "paused"
  }>,
) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    // Check if goal should be marked as completed
    let status = data.status
    if (data.currentAmount !== undefined && data.targetAmount !== undefined) {
      if (data.currentAmount >= data.targetAmount) {
        status = "completed"
      }
    }

    await sql`
      UPDATE goals SET
        name = COALESCE(${data.name}, name),
        target_amount = COALESCE(${data.targetAmount}, target_amount),
        current_amount = COALESCE(${data.currentAmount}, current_amount),
        deadline = COALESCE(${data.deadline}, deadline),
        priority = COALESCE(${data.priority}, priority),
        status = COALESCE(${status}, status)
      WHERE id = ${id} AND user_id = ${user.id}
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/goals")
    return { success: true }
  } catch (error) {
    console.error("Update goal error:", error)
    return { success: false, error: "Failed to update goal" }
  }
}

export async function deleteGoal(id: string) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    await sql`
      DELETE FROM goals WHERE id = ${id} AND user_id = ${user.id}
    `
    revalidatePath("/dashboard")
    revalidatePath("/dashboard/goals")
    return { success: true }
  } catch (error) {
    console.error("Delete goal error:", error)
    return { success: false, error: "Failed to delete goal" }
  }
}

export async function contributeToGoal(id: string, amount: number) {
  const user = await getCurrentUser()
  if (!user) return { success: false, error: "Not authenticated" }

  try {
    const goalResult = await sql`
      SELECT target_amount, current_amount FROM goals WHERE id = ${id} AND user_id = ${user.id}
    `

    if (goalResult.length === 0) {
      return { success: false, error: "Goal not found" }
    }

    const goal = goalResult[0] as { target_amount: number; current_amount: number }
    const newAmount = Number(goal.current_amount) + amount
    const status = newAmount >= Number(goal.target_amount) ? "completed" : "active"

    await sql`
      UPDATE goals SET current_amount = ${newAmount}, status = ${status}
      WHERE id = ${id} AND user_id = ${user.id}
    `

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/goals")
    return { success: true }
  } catch (error) {
    console.error("Contribute to goal error:", error)
    return { success: false, error: "Failed to contribute to goal" }
  }
}
