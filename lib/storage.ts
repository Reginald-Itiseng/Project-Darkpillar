import type { User, Account, Transaction, Budget, Goal, Category } from "./types"
import { DEFAULT_CATEGORIES } from "./types"

const STORAGE_KEYS = {
  USER: "scp_finance_user",
  ACCOUNTS: "scp_finance_accounts",
  TRANSACTIONS: "scp_finance_transactions",
  BUDGETS: "scp_finance_budgets",
  GOALS: "scp_finance_goals",
  CATEGORIES: "scp_finance_categories",
  AUTH: "scp_finance_auth",
}

// Helper to safely access localStorage
const getStorage = () => {
  if (typeof window !== "undefined") {
    return window.localStorage
  }
  return null
}

// User Management
export const getUser = (): User | null => {
  const storage = getStorage()
  if (!storage) return null
  const data = storage.getItem(STORAGE_KEYS.USER)
  return data ? JSON.parse(data) : null
}

export const setUser = (user: User): void => {
  const storage = getStorage()
  if (storage) {
    storage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
  }
}

export const isAuthenticated = (): boolean => {
  const storage = getStorage()
  if (!storage) return false
  return storage.getItem(STORAGE_KEYS.AUTH) === "true"
}

export const setAuthenticated = (value: boolean): void => {
  const storage = getStorage()
  if (storage) {
    storage.setItem(STORAGE_KEYS.AUTH, value.toString())
  }
}

// Accounts Management
export const getAccounts = (): Account[] => {
  const storage = getStorage()
  if (!storage) return []
  const data = storage.getItem(STORAGE_KEYS.ACCOUNTS)
  return data ? JSON.parse(data) : []
}

export const setAccounts = (accounts: Account[]): void => {
  const storage = getStorage()
  if (storage) {
    storage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts))
  }
}

export const addAccount = (account: Omit<Account, "id" | "createdAt">): Account => {
  const accounts = getAccounts()
  const newAccount: Account = {
    ...account,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  setAccounts([...accounts, newAccount])
  return newAccount
}

export const updateAccount = (id: string, updates: Partial<Account>): void => {
  const accounts = getAccounts()
  const index = accounts.findIndex((a) => a.id === id)
  if (index !== -1) {
    accounts[index] = { ...accounts[index], ...updates }
    setAccounts(accounts)
  }
}

// Transactions Management
export const getTransactions = (): Transaction[] => {
  const storage = getStorage()
  if (!storage) return []
  const data = storage.getItem(STORAGE_KEYS.TRANSACTIONS)
  return data ? JSON.parse(data) : []
}

export const setTransactions = (transactions: Transaction[]): void => {
  const storage = getStorage()
  if (storage) {
    storage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions))
  }
}

export const addTransaction = (transaction: Omit<Transaction, "id" | "createdAt">): Transaction => {
  const transactions = getTransactions()
  const newTransaction: Transaction = {
    ...transaction,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  setTransactions([...transactions, newTransaction])

  // Update account balance
  const accounts = getAccounts()
  const accountIndex = accounts.findIndex((a) => a.id === transaction.accountId)
  if (accountIndex !== -1) {
    if (transaction.type === "income") {
      accounts[accountIndex].balance += transaction.amount
    } else if (transaction.type === "expense") {
      accounts[accountIndex].balance -= transaction.amount
    } else if (transaction.type === "transfer" && transaction.toAccountId) {
      accounts[accountIndex].balance -= transaction.amount
      const toAccountIndex = accounts.findIndex((a) => a.id === transaction.toAccountId)
      if (toAccountIndex !== -1) {
        accounts[toAccountIndex].balance += transaction.amount
      }
    }
    setAccounts(accounts)
  }

  // Update budget spent amount
  if (transaction.type === "expense") {
    const budgets = getBudgets()
    const month = transaction.date.substring(0, 7)
    const budgetIndex = budgets.findIndex((b) => b.category === transaction.category && b.month === month)
    if (budgetIndex !== -1) {
      budgets[budgetIndex].spent += transaction.amount
      setBudgets(budgets)
    }
  }

  return newTransaction
}

// Budgets Management
export const getBudgets = (): Budget[] => {
  const storage = getStorage()
  if (!storage) return []
  const data = storage.getItem(STORAGE_KEYS.BUDGETS)
  return data ? JSON.parse(data) : []
}

export const setBudgets = (budgets: Budget[]): void => {
  const storage = getStorage()
  if (storage) {
    storage.setItem(STORAGE_KEYS.BUDGETS, JSON.stringify(budgets))
  }
}

export const addBudget = (budget: Omit<Budget, "id" | "createdAt" | "spent">): Budget => {
  const budgets = getBudgets()
  const newBudget: Budget = {
    ...budget,
    id: crypto.randomUUID(),
    spent: 0,
    createdAt: new Date().toISOString(),
  }
  setBudgets([...budgets, newBudget])
  return newBudget
}

export const updateBudget = (id: string, updates: Partial<Budget>): void => {
  const budgets = getBudgets()
  const index = budgets.findIndex((b) => b.id === id)
  if (index !== -1) {
    budgets[index] = { ...budgets[index], ...updates }
    setBudgets(budgets)
  }
}

export const deleteBudget = (id: string): void => {
  const budgets = getBudgets()
  setBudgets(budgets.filter((b) => b.id !== id))
}

// Goals Management
export const getGoals = (): Goal[] => {
  const storage = getStorage()
  if (!storage) return []
  const data = storage.getItem(STORAGE_KEYS.GOALS)
  return data ? JSON.parse(data) : []
}

export const setGoals = (goals: Goal[]): void => {
  const storage = getStorage()
  if (storage) {
    storage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(goals))
  }
}

export const addGoal = (goal: Omit<Goal, "id" | "createdAt">): Goal => {
  const goals = getGoals()
  const newGoal: Goal = {
    ...goal,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  }
  setGoals([...goals, newGoal])
  return newGoal
}

export const updateGoal = (id: string, updates: Partial<Goal>): void => {
  const goals = getGoals()
  const index = goals.findIndex((g) => g.id === id)
  if (index !== -1) {
    goals[index] = { ...goals[index], ...updates }
    setGoals(goals)
  }
}

export const deleteGoal = (id: string): void => {
  const goals = getGoals()
  setGoals(goals.filter((g) => g.id !== id))
}

// Categories Management
export const getCategories = (): Category[] => {
  const storage = getStorage()
  if (!storage) return DEFAULT_CATEGORIES
  const data = storage.getItem(STORAGE_KEYS.CATEGORIES)
  return data ? JSON.parse(data) : DEFAULT_CATEGORIES
}

export const setCategories = (categories: Category[]): void => {
  const storage = getStorage()
  if (storage) {
    storage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories))
  }
}

export const addCategory = (category: Omit<Category, "id" | "isDefault">): Category => {
  const categories = getCategories()
  const newCategory: Category = {
    ...category,
    id: crypto.randomUUID(),
    isDefault: false,
  }
  setCategories([...categories, newCategory])
  return newCategory
}

// Initialize default data
export const initializeData = (): void => {
  const storage = getStorage()
  if (!storage) return

  // Initialize categories if not exists
  if (!storage.getItem(STORAGE_KEYS.CATEGORIES)) {
    setCategories(DEFAULT_CATEGORIES)
  }
}

// Clear all data (logout)
export const clearAllData = (): void => {
  const storage = getStorage()
  if (storage) {
    Object.values(STORAGE_KEYS).forEach((key) => {
      storage.removeItem(key)
    })
  }
}
