import { neon } from "@neondatabase/serverless"

export const sql = neon(process.env.DATABASE_URL!)

export type DbUser = {
  id: string
  username: string
  pin: string
  clearance_level: number
  created_at: string
}

export type DbAccount = {
  id: string
  user_id: string
  name: string
  type: "day-to-day" | "fixed-deposit"
  balance: number
  interest_rate: number | null
  maturity_date: string | null
  deposit_date: string | null
  is_active: boolean
  is_primary: boolean
  created_at: string
}

export type DbTransaction = {
  id: string
  user_id: string
  type: "income" | "expense" | "transfer"
  amount: number
  category: string
  description: string | null
  account_id: string
  to_account_id: string | null
  date: string
  created_at: string
}

export type DbBudget = {
  id: string
  user_id: string
  category: string
  amount: number
  spent: number
  month: string
  created_at: string
}

export type DbGoal = {
  id: string
  user_id: string
  name: string
  target_amount: number
  current_amount: number
  deadline: string
  priority: "low" | "medium" | "high" | "critical"
  status: "active" | "completed" | "paused"
  created_at: string
}

export type DbCategory = {
  id: string
  user_id: string | null
  name: string
  type: "income" | "expense"
  is_default: boolean
  icon: string | null
  created_at: string
}
