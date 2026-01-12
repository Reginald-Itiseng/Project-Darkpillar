export interface User {
  id: string
  username: string
  pin: string
  clearanceLevel: number
  createdAt: string
}

export interface Account {
  id: string
  name: string
  type: "day-to-day" | "fixed-deposit"
  balance: number
  interestRate?: number
  maturityDate?: string
  depositDate?: string
  isActive: boolean
  isPrimary?: boolean
  createdAt: string
}

export interface Transaction {
  id: string
  type: "income" | "expense" | "transfer"
  amount: number
  category: string
  description: string
  accountId: string
  toAccountId?: string
  date: string
  createdAt: string
}

export interface Budget {
  id: string
  category: string
  amount: number
  spent: number
  month: string // YYYY-MM format
  createdAt: string
}

export interface Goal {
  id: string
  name: string
  targetAmount: number
  currentAmount: number
  deadline: string
  priority: "low" | "medium" | "high" | "critical"
  status: "active" | "completed" | "paused"
  createdAt: string
}

export interface Category {
  id: string
  name: string
  type: "income" | "expense"
  isDefault: boolean
  icon?: string
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: "1", name: "Salary", type: "income", isDefault: true },
  { id: "2", name: "Freelance", type: "income", isDefault: true },
  { id: "3", name: "Investments", type: "income", isDefault: true },
  { id: "4", name: "Other Income", type: "income", isDefault: true },
  { id: "5", name: "Food & Dining", type: "expense", isDefault: true },
  { id: "6", name: "Transportation", type: "expense", isDefault: true },
  { id: "7", name: "Utilities", type: "expense", isDefault: true },
  { id: "8", name: "Entertainment", type: "expense", isDefault: true },
  { id: "9", name: "Shopping", type: "expense", isDefault: true },
  { id: "10", name: "Healthcare", type: "expense", isDefault: true },
  { id: "11", name: "Education", type: "expense", isDefault: true },
  { id: "12", name: "Bills & Fees", type: "expense", isDefault: true },
  { id: "13", name: "Savings", type: "expense", isDefault: true },
  { id: "14", name: "Other", type: "expense", isDefault: true },
]
