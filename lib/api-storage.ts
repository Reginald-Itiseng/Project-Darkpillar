import type { User, Account, Transaction, Budget, Goal, Category, Loan, LoanPayment } from './types'

export interface AdminInvite {
  code: string
  id: string
  maxUses: number
  usesCount: number
  expiresAt: string | null
  createdAt: string
}

function toNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function normalizeAccount(raw: any): Account {
  return {
    ...raw,
    balance: toNumber(raw?.balance),
    interestRate: toOptionalNumber(raw?.interestRate),
    depositDate: raw?.depositDate || undefined,
    maturityDate: raw?.maturityDate || undefined,
  } as Account
}

function normalizeTransaction(raw: any): Transaction {
  return {
    ...raw,
    amount: toNumber(raw?.amount),
    recurrenceRule: raw?.recurrenceRule || undefined,
    recurrenceEndDate: raw?.recurrenceEndDate || undefined,
    parentTransactionId: raw?.parentTransactionId || undefined,
    isSystemGenerated: Boolean(raw?.isSystemGenerated),
  } as Transaction
}

function normalizeBudget(raw: any): Budget {
  return {
    ...raw,
    amount: toNumber(raw?.amount),
    spent: toNumber(raw?.spent),
    isRecurring: Boolean(raw?.isRecurring),
  } as Budget
}

function normalizeGoal(raw: any): Goal {
  return {
    ...raw,
    targetAmount: toNumber(raw?.targetAmount),
    currentAmount: toNumber(raw?.currentAmount),
  } as Goal
}

function normalizeLoan(raw: any): Loan {
  return {
    ...raw,
    principal: toNumber(raw?.principal),
    annualRate: toNumber(raw?.annualRate),
    outstandingPrincipal: toNumber(raw?.outstandingPrincipal),
  } as Loan
}

function normalizeLoanPayment(raw: any): LoanPayment {
  return {
    ...raw,
    totalAmount: toNumber(raw?.totalAmount),
    principalComponent: toNumber(raw?.principalComponent),
    interestComponent: toNumber(raw?.interestComponent),
  } as LoanPayment
}

function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('session_token')
}

function setSessionToken(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('session_token', token)
}

function clearSessionToken(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('session_token')
}

function getAuthHeaders(baseHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getSessionToken()
  return token ? { ...baseHeaders, Authorization: `Bearer ${token}` } : baseHeaders
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const data = await response.json()
    return data?.error || fallback
  } catch {
    return fallback
  }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export async function register(
  email: string,
  name: string,
  pin: string,
  inviteCode: string
): Promise<{ user: User; token: string }> {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, name, pin, inviteCode }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Registration failed'))
  }

  const data = await response.json()
  if (data?.token) {
    setSessionToken(data.token)
  }

  return { user: data.user, token: data.token }
}

export async function login(email: string, pin: string): Promise<{ user: User; token: string }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, pin }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Login failed'))
  }

  const data = await response.json()
  if (data?.token) {
    setSessionToken(data.token)
  }

  return { user: data.user, token: data.token }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
    })
  } finally {
    clearSessionToken()
  }
}

export async function verifySession(): Promise<User | null> {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    })

    if (!response.ok) {
      clearSessionToken()
      return null
    }

    const data = await response.json()

    // Keep local token in sync if API returns one.
    if (data?.session?.token) {
      setSessionToken(data.session.token)
    }

    return data.user || null
  } catch {
    clearSessionToken()
    return null
  }
}

export async function createInviteCode(maxUses = 1, expiresInDays = 14): Promise<AdminInvite> {
  const response = await fetch('/api/admin/invites', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ maxUses, expiresInDays }),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create invite'))
  }

  const data = await response.json()
  return data.invite as AdminInvite
}

// ============================================================================
// ACCOUNTS
// ============================================================================

export async function getAccounts(): Promise<Account[]> {
  try {
    const response = await fetch('/api/financial/accounts', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    })

    if (!response.ok) return []
    const data = await response.json()
    return (data.accounts || []).map(normalizeAccount)
  } catch {
    return []
  }
}

export async function addAccount(account: Omit<Account, 'id' | 'createdAt'>): Promise<Account> {
  const response = await fetch('/api/financial/accounts', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(account),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create account'))
  }

  const data = await response.json()
  return normalizeAccount(data.account)
}

export async function updateAccount(id: string, updates: Partial<Account>): Promise<Account> {
  const response = await fetch(`/api/financial/accounts?id=${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update account'))
  }

  const data = await response.json()
  return normalizeAccount(data.account)
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getTransactions(): Promise<Transaction[]> {
  try {
    const response = await fetch('/api/financial/transactions', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    })

    if (!response.ok) return []
    const data = await response.json()
    return (data.transactions || []).map(normalizeTransaction)
  } catch {
    return []
  }
}

export async function addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Promise<Transaction> {
  const response = await fetch('/api/financial/transactions', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(transaction),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create transaction'))
  }

  const data = await response.json()
  return normalizeTransaction(data.transaction)
}

export async function getUpcomingObligations(daysAhead = 30): Promise<Array<{
  id: string
  kind: 'loan' | 'recurring-expense'
  title: string
  amount: number
  dueDate: string
}>> {
  const response = await fetch(`/api/financial/obligations?days=${daysAhead}`, {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to fetch upcoming obligations'))
  }

  const data = await response.json()
  return (data.obligations || []).map((item: any) => ({
    id: String(item.id),
    kind: item.kind === 'loan' ? 'loan' : 'recurring-expense',
    title: String(item.title || ''),
    amount: toNumber(item.amount),
    dueDate: String(item.dueDate || ''),
  }))
}

export async function deleteTransaction(id: string): Promise<void> {
  const response = await fetch(`/api/financial/transactions?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to delete transaction'))
  }
}

// ============================================================================
// BUDGETS
// ============================================================================

export async function getBudgets(): Promise<Budget[]> {
  try {
    const response = await fetch('/api/financial/budgets', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    })

    if (!response.ok) return []
    const data = await response.json()
    return (data.budgets || []).map(normalizeBudget)
  } catch {
    return []
  }
}

export async function addBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'spent'>): Promise<Budget> {
  const response = await fetch('/api/financial/budgets', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(budget),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create budget'))
  }

  const data = await response.json()
  return normalizeBudget(data.budget)
}

export async function updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
  const response = await fetch(`/api/financial/budgets?id=${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update budget'))
  }

  const data = await response.json()
  return normalizeBudget(data.budget)
}

export async function deleteBudget(id: string): Promise<void> {
  const response = await fetch(`/api/financial/budgets?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to delete budget'))
  }
}

// ============================================================================
// GOALS
// ============================================================================

export async function getGoals(): Promise<Goal[]> {
  try {
    const response = await fetch('/api/financial/goals', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    })

    if (!response.ok) return []
    const data = await response.json()
    return (data.goals || []).map(normalizeGoal)
  } catch {
    return []
  }
}

export async function addGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
  const response = await fetch('/api/financial/goals', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(goal),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create goal'))
  }

  const data = await response.json()
  return normalizeGoal(data.goal)
}

export async function updateGoal(id: string, updates: Partial<Goal>): Promise<Goal> {
  const response = await fetch(`/api/financial/goals?id=${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update goal'))
  }

  const data = await response.json()
  return normalizeGoal(data.goal)
}

export async function deleteGoal(id: string): Promise<void> {
  const response = await fetch(`/api/financial/goals?id=${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to delete goal'))
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function getCategories(): Promise<Category[]> {
  try {
    const response = await fetch('/api/financial/categories', {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    })

    if (!response.ok) return []
    const data = await response.json()
    return data.categories || []
  } catch {
    return []
  }
}

export async function addCategory(category: Omit<Category, 'id' | 'isDefault'>): Promise<Category> {
  const response = await fetch('/api/financial/categories', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(category),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create category'))
  }

  const data = await response.json()
  return data.category
}

// ============================================================================
// LOANS
// ============================================================================

export async function getLoans(): Promise<{ loans: Loan[]; payments: LoanPayment[] }> {
  const response = await fetch('/api/financial/loans', {
    method: 'GET',
    credentials: 'include',
    headers: getAuthHeaders(),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to fetch loans'))
  }

  const data = await response.json()
  return {
    loans: (data.loans || []).map(normalizeLoan),
    payments: (data.payments || []).map(normalizeLoanPayment),
  }
}

export async function addLoan(
  loan: Omit<Loan, 'id' | 'createdAt' | 'outstandingPrincipal' | 'status'>
): Promise<Loan> {
  const response = await fetch('/api/financial/loans', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(loan),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create loan'))
  }

  const data = await response.json()
  return normalizeLoan(data.loan)
}

export async function updateLoan(id: string, updates: Partial<Loan>): Promise<Loan> {
  const response = await fetch(`/api/financial/loans?id=${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to update loan'))
  }

  const data = await response.json()
  return normalizeLoan(data.loan)
}

export async function addLoanPayment(payload: {
  loanId: string
  accountId: string
  totalAmount: number
  paymentDate: string
  interestComponent?: number
  note?: string
}): Promise<{ payment: LoanPayment; loan: Loan }> {
  const response = await fetch('/api/financial/loans/payments', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create loan payment'))
  }

  const data = await response.json()
  return {
    payment: normalizeLoanPayment(data.payment),
    loan: normalizeLoan(data.loan),
  }
}

export async function modelSinglePaymentLoan(payload: {
  principal_amount: number
  flat_interest_rate: number
  loan_duration_days: number
  start_date?: string
}): Promise<{
  total_due: number
  due_date: string
  effective_apr: number
  high_priority_debt: boolean
}> {
  const response = await fetch('/api/financial/loans/model', {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to model loan'))
  }

  const data = await response.json()
  return {
    total_due: toNumber(data.total_due),
    due_date: String(data.due_date || ''),
    effective_apr: toNumber(data.effective_apr),
    high_priority_debt: Boolean(data.high_priority_debt),
  }
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

