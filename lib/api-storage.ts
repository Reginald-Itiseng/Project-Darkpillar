import type { User, Account, Transaction, Budget, Goal, Category } from './types'

/**
 * Get session token from localStorage (set by auth components)
 */
function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('session_token')
}

/**
 * Set session token in localStorage
 */
function setSessionToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('session_token', token)
}

/**
 * Clear session token from localStorage
 */
function clearSessionToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('session_token')
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export async function register(
  email: string,
  name: string,
  pin: string
): Promise<{ user: User; token: string }> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, pin }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Registration failed')
  }

  const data = await response.json()
  setSessionToken(data.token)
  return { user: data.user, token: data.token }
}

export async function login(email: string, pin: string): Promise<{ user: User; token: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, pin }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Login failed')
  }

  const data = await response.json()
  setSessionToken(data.token)
  return { user: data.user, token: data.token }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getSessionToken() || ''}`,
      },
    })
  } finally {
    clearSessionToken()
  }
}

export async function verifySession(): Promise<User | null> {
  const token = getSessionToken()
  if (!token) return null

  try {
    const response = await fetch('/api/auth/verify', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      clearSessionToken()
      return null
    }

    const data = await response.json()
    return data.user || null
  } catch {
    clearSessionToken()
    return null
  }
}

// ============================================================================
// ACCOUNTS
// ============================================================================

export async function getAccounts(): Promise<Account[]> {
  const token = getSessionToken()
  if (!token) return []

  try {
    const response = await fetch('/api/financial/accounts', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) return []
    const data = await response.json()
    return data.accounts || []
  } catch {
    return []
  }
}

export async function addAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<Account> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch('/api/financial/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(account),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create account')
  }

  const data = await response.json()
  return data.account
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`/api/financial/accounts?id=${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update account')
  }

  const data = await response.json()
  return data.account
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getTransactions(): Promise<Transaction[]> {
  const token = getSessionToken()
  if (!token) return []

  try {
    const response = await fetch('/api/financial/transactions', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) return []
    const data = await response.json()
    return data.transactions || []
  } catch {
    return []
  }
}

export async function addTransaction(
  transaction: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch('/api/financial/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(transaction),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create transaction')
  }

  const data = await response.json()
  return data.transaction
}

// ============================================================================
// BUDGETS
// ============================================================================

export async function getBudgets(): Promise<Budget[]> {
  const token = getSessionToken()
  if (!token) return []

  try {
    const response = await fetch('/api/financial/budgets', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) return []
    const data = await response.json()
    return data.budgets || []
  } catch {
    return []
  }
}

export async function addBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'spent'>): Promise<Budget> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch('/api/financial/budgets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(budget),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create budget')
  }

  const data = await response.json()
  return data.budget
}

export async function updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`/api/financial/budgets?id=${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update budget')
  }

  const data = await response.json()
  return data.budget
}

export async function deleteBudget(id: string): Promise<void> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`/api/financial/budgets?id=${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete budget')
  }
}

// ============================================================================
// GOALS
// ============================================================================

export async function getGoals(): Promise<Goal[]> {
  const token = getSessionToken()
  if (!token) return []

  try {
    const response = await fetch('/api/financial/goals', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) return []
    const data = await response.json()
    return data.goals || []
  } catch {
    return []
  }
}

export async function addGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch('/api/financial/goals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(goal),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create goal')
  }

  const data = await response.json()
  return data.goal
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`/api/financial/goals?id=${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update goal')
  }

  const data = await response.json()
  return data.goal
}

export async function deleteGoal(id: string): Promise<void> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch(`/api/financial/goals?id=${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete goal')
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function getCategories(): Promise<Category[]> {
  const token = getSessionToken()
  if (!token) {
    // Return default categories if not authenticated
    return []
  }

  try {
    const response = await fetch('/api/financial/categories', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })

    if (!response.ok) return []
    const data = await response.json()
    return data.categories || []
  } catch {
    return []
  }
}

export async function addCategory(
  category: Omit<Category, 'id' | 'isDefault'>
): Promise<Category> {
  const token = getSessionToken()
  if (!token) throw new Error('Not authenticated')

  const response = await fetch('/api/financial/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(category),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create category')
  }

  const data = await response.json()
  return data.category
}

// ============================================================================
// UTILITY
// ============================================================================

export async function isAuthenticated(): Promise<boolean> {
  const user = await verifySession()
  return user !== null
}

export function setCurrentUser(user: User): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('current_user', JSON.stringify(user))
}

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem('current_user')
  return data ? JSON.parse(data) : null
}

export function clearAllData(): void {
  clearSessionToken()
  if (typeof window === 'undefined') return
  localStorage.removeItem('current_user')
}
