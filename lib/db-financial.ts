import { query, transaction } from './db'
import type { Account, Transaction, Budget, Goal, Category, Loan, LoanPayment } from './types'

interface LoanPaymentInput {
  loanId: string
  accountId: string
  totalAmount: number
  paymentDate: string
  interestComponent?: number
  note?: string
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

// ============================================================================
// ACCOUNTS
// ============================================================================

export async function getAccounts(userId: string): Promise<Account[]> {
  try {
    const result = await query<Account>(
      `
      SELECT 
        id,
        name,
        type,
        balance,
        interest_rate as "interestRate",
        maturity_date as "maturityDate",
        deposit_date as "depositDate",
        is_active as "isActive",
        is_primary as "isPrimary",
        created_at as "createdAt"
      FROM public.accounts
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching accounts:', error)
    throw error
  }
}

export async function addAccount(
  userId: string,
  account: Omit<Account, 'id' | 'createdAt'>
): Promise<Account> {
  try {
    const result = await query<Account>(
      `
      INSERT INTO public.accounts (
        id,
        user_id,
        name,
        type,
        balance,
        interest_rate,
        maturity_date,
        deposit_date,
        is_active,
        is_primary,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        NOW()
      )
      RETURNING 
        id,
        name,
        type,
        balance,
        interest_rate as "interestRate",
        maturity_date as "maturityDate",
        deposit_date as "depositDate",
        is_active as "isActive",
        is_primary as "isPrimary",
        created_at as "createdAt"
      `,
      [
        userId,
        account.name,
        account.type,
        account.balance,
        account.interestRate || null,
        account.maturityDate || null,
        account.depositDate || null,
        account.isActive,
        account.isPrimary || false,
      ],
      userId
    )

    if (!result.rows[0]) throw new Error('Failed to create account')
    return result.rows[0]
  } catch (error) {
    console.error('Error adding account:', error)
    throw error
  }
}

export async function updateAccount(
  userId: string,
  accountId: string,
  updates: Partial<Account>
): Promise<Account | null> {
  try {
    const allowedFields: Record<string, string> = {
      name: 'name',
      type: 'type',
      balance: 'balance',
      interestRate: 'interest_rate',
      maturityDate: 'maturity_date',
      depositDate: 'deposit_date',
      isActive: 'is_active',
      isPrimary: 'is_primary',
    }

    const filteredEntries = Object.entries(updates).filter(
      ([key, value]) => key in allowedFields && value !== undefined
    )

    const setClause = filteredEntries
      .map(([key], index) => `${allowedFields[key]} = $${index + 2}`)
      .join(', ')

    if (!setClause) return null

    const result = await query<Account>(
      `
      UPDATE public.accounts
      SET ${setClause}
      WHERE id = $1 AND user_id = $${filteredEntries.length + 2}
      RETURNING 
        id,
        name,
        type,
        balance,
        interest_rate as "interestRate",
        maturity_date as "maturityDate",
        deposit_date as "depositDate",
        is_active as "isActive",
        is_primary as "isPrimary",
        created_at as "createdAt"
      `,
      [accountId, ...filteredEntries.map(([, value]) => value), userId],
      userId
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating account:', error)
    throw error
  }
}

// ============================================================================
// TRANSACTIONS
// ============================================================================

export async function getTransactions(userId: string): Promise<Transaction[]> {
  try {
    const result = await query<Transaction>(
      `
      SELECT 
        id,
        type,
        amount,
        category,
        description,
        account_id as "accountId",
        to_account_id as "toAccountId",
        date,
        created_at as "createdAt"
      FROM public.transactions
      WHERE user_id = $1
      ORDER BY date DESC, created_at DESC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching transactions:', error)
    throw error
  }
}

export async function addTransaction(
  userId: string,
  trans: Omit<Transaction, 'id' | 'createdAt'>
): Promise<Transaction> {
  return transaction(async (client) => {
    // Insert transaction
    const transResult = await client.query<Transaction>(
      `
      INSERT INTO public.transactions (
        id,
        user_id,
        type,
        amount,
        category,
        description,
        account_id,
        to_account_id,
        date,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        NOW()
      )
      RETURNING 
        id,
        type,
        amount,
        category,
        description,
        account_id as "accountId",
        to_account_id as "toAccountId",
        date,
        created_at as "createdAt"
      `,
      [
        userId,
        trans.type,
        trans.amount,
        trans.category,
        trans.description,
        trans.accountId,
        trans.toAccountId || null,
        trans.date,
      ]
    )

    if (!transResult.rows[0]) throw new Error('Failed to create transaction')

    // Update account balance
    if (trans.type === 'income') {
      await client.query(
        'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.accountId, userId]
      )
    } else if (trans.type === 'expense') {
      await client.query(
        'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.accountId, userId]
      )
    } else if (trans.type === 'transfer' && trans.toAccountId) {
      await client.query(
        'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.accountId, userId]
      )
      await client.query(
        'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.toAccountId, userId]
      )
    }

    // Update budget if expense
    if (trans.type === 'expense') {
      const month = trans.date.substring(0, 7)
      await client.query(
        `
        UPDATE public.budgets
        SET spent = spent + $1
        WHERE user_id = $2 AND category = $3 AND month = $4
        `,
        [trans.amount, userId, trans.category, month]
      )
    }

    return transResult.rows[0]
  }, userId)
}

export async function deleteTransaction(userId: string, transactionId: string): Promise<boolean> {
  return transaction(async (client) => {
    const existing = await client.query<Transaction>(
      `
      SELECT
        id,
        type,
        amount,
        category,
        account_id as "accountId",
        to_account_id as "toAccountId",
        date
      FROM public.transactions
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [transactionId, userId]
    )

    const trans = existing.rows[0]
    if (!trans) return false

    // Reverse the balance and budget effects applied during insertion.
    if (trans.type === 'income') {
      await client.query(
        'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.accountId, userId]
      )
    } else if (trans.type === 'expense') {
      await client.query(
        'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.accountId, userId]
      )

      const month = trans.date.substring(0, 7)
      await client.query(
        `
        UPDATE public.budgets
        SET spent = GREATEST(spent - $1, 0)
        WHERE user_id = $2 AND category = $3 AND month = $4
        `,
        [trans.amount, userId, trans.category, month]
      )
    } else if (trans.type === 'transfer' && trans.toAccountId) {
      await client.query(
        'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.accountId, userId]
      )
      await client.query(
        'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
        [trans.amount, trans.toAccountId, userId]
      )
    }

    const deleted = await client.query(
      'DELETE FROM public.transactions WHERE id = $1 AND user_id = $2',
      [transactionId, userId]
    )

    return (deleted.rowCount || 0) > 0
  }, userId)
}

// ============================================================================
// BUDGETS
// ============================================================================

export async function getBudgets(userId: string): Promise<Budget[]> {
  try {
    const result = await query<Budget>(
      `
      SELECT 
        id,
        category,
        amount,
        spent,
        month,
        created_at as "createdAt"
      FROM public.budgets
      WHERE user_id = $1
      ORDER BY month DESC, category ASC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching budgets:', error)
    throw error
  }
}

export async function addBudget(
  userId: string,
  budget: Omit<Budget, 'id' | 'createdAt' | 'spent'>
): Promise<Budget> {
  try {
    const existing = await query<{ id: string }>(
      `
      SELECT id
      FROM public.budgets
      WHERE user_id = $1 AND category = $2 AND month = $3
      LIMIT 1
      `,
      [userId, budget.category, budget.month],
      userId
    )

    if (existing.rows[0]) {
      throw new Error('Budget already exists for category and month')
    }

    const result = await query<Budget>(
      `
      INSERT INTO public.budgets (
        id,
        user_id,
        category,
        amount,
        spent,
        month,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        0,
        $4,
        NOW()
      )
      RETURNING 
        id,
        category,
        amount,
        spent,
        month,
        created_at as "createdAt"
      `,
      [userId, budget.category, budget.amount, budget.month],
      userId
    )

    if (!result.rows[0]) throw new Error('Failed to create budget')
    return result.rows[0]
  } catch (error) {
    console.error('Error adding budget:', error)
    throw error
  }
}

export async function updateBudget(
  userId: string,
  budgetId: string,
  updates: Partial<Budget>
): Promise<Budget | null> {
  try {
    const allowedFields: Record<string, string> = {
      category: 'category',
      amount: 'amount',
      month: 'month',
      spent: 'spent',
    }

    const filteredEntries = Object.entries(updates).filter(
      ([key, value]) => key in allowedFields && value !== undefined
    )

    const setClause = filteredEntries
      .map(([key], index) => `${allowedFields[key]} = $${index + 2}`)
      .join(', ')

    if (!setClause) return null

    const result = await query<Budget>(
      `
      UPDATE public.budgets
      SET ${setClause}
      WHERE id = $1 AND user_id = $${filteredEntries.length + 2}
      RETURNING 
        id,
        category,
        amount,
        spent,
        month,
        created_at as "createdAt"
      `,
      [budgetId, ...filteredEntries.map(([, value]) => value), userId],
      userId
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating budget:', error)
    throw error
  }
}

export async function deleteBudget(userId: string, budgetId: string): Promise<boolean> {
  try {
    const result = await query(
      'DELETE FROM public.budgets WHERE id = $1 AND user_id = $2',
      [budgetId, userId],
      userId
    )
    return result.rowCount ? result.rowCount > 0 : false
  } catch (error) {
    console.error('Error deleting budget:', error)
    throw error
  }
}

// ============================================================================
// GOALS
// ============================================================================

export async function getGoals(userId: string): Promise<Goal[]> {
  try {
    const result = await query<Goal>(
      `
      SELECT 
        id,
        name,
        target_amount as "targetAmount",
        current_amount as "currentAmount",
        deadline,
        priority,
        status,
        created_at as "createdAt"
      FROM public.goals
      WHERE user_id = $1
      ORDER BY priority DESC, deadline ASC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching goals:', error)
    throw error
  }
}

export async function addGoal(
  userId: string,
  goal: Omit<Goal, 'id' | 'createdAt'>
): Promise<Goal> {
  try {
    const result = await query<Goal>(
      `
      INSERT INTO public.goals (
        id,
        user_id,
        name,
        target_amount,
        current_amount,
        deadline,
        priority,
        status,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        NOW()
      )
      RETURNING 
        id,
        name,
        target_amount as "targetAmount",
        current_amount as "currentAmount",
        deadline,
        priority,
        status,
        created_at as "createdAt"
      `,
      [
        userId,
        goal.name,
        goal.targetAmount,
        goal.currentAmount,
        goal.deadline,
        goal.priority,
        goal.status,
      ],
      userId
    )

    if (!result.rows[0]) throw new Error('Failed to create goal')
    return result.rows[0]
  } catch (error) {
    console.error('Error adding goal:', error)
    throw error
  }
}

export async function updateGoal(
  userId: string,
  goalId: string,
  updates: Partial<Goal>
): Promise<Goal | null> {
  try {
    const allowedFields: Record<string, string> = {
      name: 'name',
      targetAmount: 'target_amount',
      currentAmount: 'current_amount',
      deadline: 'deadline',
      priority: 'priority',
      status: 'status',
    }

    const filteredEntries = Object.entries(updates).filter(
      ([key, value]) => key in allowedFields && value !== undefined
    )

    const setClause = filteredEntries
      .map(([key], index) => `${allowedFields[key]} = $${index + 2}`)
      .join(', ')

    if (!setClause) return null

    const result = await query<Goal>(
      `
      UPDATE public.goals
      SET ${setClause}
      WHERE id = $1 AND user_id = $${filteredEntries.length + 2}
      RETURNING 
        id,
        name,
        target_amount as "targetAmount",
        current_amount as "currentAmount",
        deadline,
        priority,
        status,
        created_at as "createdAt"
      `,
      [goalId, ...filteredEntries.map(([, value]) => value), userId],
      userId
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating goal:', error)
    throw error
  }
}

export async function deleteGoal(userId: string, goalId: string): Promise<boolean> {
  try {
    const result = await query(
      'DELETE FROM public.goals WHERE id = $1 AND user_id = $2',
      [goalId, userId],
      userId
    )
    return result.rowCount ? result.rowCount > 0 : false
  } catch (error) {
    console.error('Error deleting goal:', error)
    throw error
  }
}

// ============================================================================
// CATEGORIES
// ============================================================================

export async function getCategories(userId: string): Promise<Category[]> {
  try {
    const result = await query<Category>(
      `
      SELECT 
        id,
        name,
        type,
        is_default as "isDefault",
        icon
      FROM public.categories
      WHERE user_id = $1 OR is_default = true
      ORDER BY is_default DESC, name ASC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching categories:', error)
    throw error
  }
}

export async function addCategory(
  userId: string,
  category: Omit<Category, 'id' | 'isDefault'>
): Promise<Category> {
  try {
    const result = await query<Category>(
      `
      INSERT INTO public.categories (
        id,
        user_id,
        name,
        type,
        is_default,
        icon
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        false,
        $4
      )
      RETURNING 
        id,
        name,
        type,
        is_default as "isDefault",
        icon
      `,
      [userId, category.name, category.type, category.icon || null],
      userId
    )

    if (!result.rows[0]) throw new Error('Failed to create category')
    return result.rows[0]
  } catch (error) {
    console.error('Error adding category:', error)
    throw error
  }
}

// ============================================================================
// LOANS
// ============================================================================

export async function getLoans(userId: string): Promise<Loan[]> {
  try {
    const result = await query<Loan>(
      `
      SELECT
        id,
        lender_name as "lenderName",
        account_id as "accountId",
        principal,
        annual_rate as "annualRate",
        start_date as "startDate",
        due_date as "dueDate",
        outstanding_principal as "outstandingPrincipal",
        status,
        notes,
        created_at as "createdAt"
      FROM public.loans
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching loans:', error)
    throw error
  }
}

export async function getLoanPayments(userId: string): Promise<LoanPayment[]> {
  try {
    const result = await query<LoanPayment>(
      `
      SELECT
        id,
        loan_id as "loanId",
        account_id as "accountId",
        payment_date as "paymentDate",
        total_amount as "totalAmount",
        principal_component as "principalComponent",
        interest_component as "interestComponent",
        note,
        created_at as "createdAt"
      FROM public.loan_payments
      WHERE user_id = $1
      ORDER BY payment_date DESC, created_at DESC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching loan payments:', error)
    throw error
  }
}

export async function addLoan(
  userId: string,
  loan: Omit<Loan, 'id' | 'createdAt' | 'outstandingPrincipal' | 'status'>
): Promise<Loan> {
  return transaction(async (client) => {
    const loanResult = await client.query<Loan>(
      `
      INSERT INTO public.loans (
        id,
        user_id,
        lender_name,
        account_id,
        principal,
        annual_rate,
        start_date,
        due_date,
        outstanding_principal,
        status,
        notes,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $4,
        'active',
        $8,
        NOW(),
        NOW()
      )
      RETURNING
        id,
        lender_name as "lenderName",
        account_id as "accountId",
        principal,
        annual_rate as "annualRate",
        start_date as "startDate",
        due_date as "dueDate",
        outstanding_principal as "outstandingPrincipal",
        status,
        notes,
        created_at as "createdAt"
      `,
      [
        userId,
        loan.lenderName,
        loan.accountId,
        loan.principal,
        loan.annualRate,
        loan.startDate,
        loan.dueDate,
        loan.notes || null,
      ]
    )

    const createdLoan = loanResult.rows[0]
    if (!createdLoan) throw new Error('Failed to create loan')

    // Loan disbursement increases account balance.
    const accountCredit = await client.query(
      'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
      [loan.principal, loan.accountId, userId]
    )
    if (!accountCredit.rowCount) throw new Error('Disbursement account not found')

    // Keep disbursement visible in transaction history.
    await client.query(
      `
      INSERT INTO public.transactions (
        id,
        user_id,
        type,
        amount,
        category,
        description,
        account_id,
        to_account_id,
        date,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        'income',
        $2,
        'Loan Disbursement',
        $3,
        $4,
        NULL,
        $5,
        NOW()
      )
      `,
      [userId, loan.principal, `LOAN FROM ${loan.lenderName.toUpperCase()}`, loan.accountId, loan.startDate]
    )

    return createdLoan
  }, userId)
}

export async function updateLoan(
  userId: string,
  loanId: string,
  updates: Partial<Loan>
): Promise<Loan | null> {
  try {
    const allowedFields: Record<string, string> = {
      lenderName: 'lender_name',
      annualRate: 'annual_rate',
      dueDate: 'due_date',
      status: 'status',
      notes: 'notes',
    }

    const filteredEntries = Object.entries(updates).filter(
      ([key, value]) => key in allowedFields && value !== undefined
    )

    const setClause = filteredEntries
      .map(([key], index) => `${allowedFields[key]} = $${index + 2}`)
      .concat('updated_at = NOW()')
      .join(', ')

    if (!filteredEntries.length) return null

    const result = await query<Loan>(
      `
      UPDATE public.loans
      SET ${setClause}
      WHERE id = $1 AND user_id = $${filteredEntries.length + 2}
      RETURNING
        id,
        lender_name as "lenderName",
        account_id as "accountId",
        principal,
        annual_rate as "annualRate",
        start_date as "startDate",
        due_date as "dueDate",
        outstanding_principal as "outstandingPrincipal",
        status,
        notes,
        created_at as "createdAt"
      `,
      [loanId, ...filteredEntries.map(([, value]) => value), userId],
      userId
    )

    return result.rows[0] || null
  } catch (error) {
    console.error('Error updating loan:', error)
    throw error
  }
}

export async function addLoanPayment(
  userId: string,
  payment: LoanPaymentInput
): Promise<{ payment: LoanPayment; loan: Loan }> {
  return transaction(async (client) => {
    const loanResult = await client.query<Loan>(
      `
      SELECT
        id,
        lender_name as "lenderName",
        account_id as "accountId",
        principal,
        annual_rate as "annualRate",
        start_date as "startDate",
        due_date as "dueDate",
        outstanding_principal as "outstandingPrincipal",
        status,
        notes,
        created_at as "createdAt"
      FROM public.loans
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [payment.loanId, userId]
    )

    const loan = loanResult.rows[0]
    if (!loan) throw new Error('Loan not found')
    if (loan.status !== 'active') throw new Error('Loan is not active')

    if (loan.accountId !== payment.accountId) {
      throw new Error('Payment account must match the loan disbursement account')
    }

    const totalAmount = roundMoney(payment.totalAmount)
    const annualRate = Number(loan.annualRate) || 0
    const outstanding = roundMoney(Number(loan.outstandingPrincipal) || 0)

    const lastPaymentResult = await client.query<{ paymentDate: string }>(
      `
      SELECT payment_date as "paymentDate"
      FROM public.loan_payments
      WHERE loan_id = $1 AND user_id = $2
      ORDER BY payment_date DESC, created_at DESC
      LIMIT 1
      `,
      [payment.loanId, userId]
    )

    const baseDate = lastPaymentResult.rows[0]?.paymentDate || loan.startDate
    const startTs = new Date(`${baseDate}T00:00:00Z`).getTime()
    const endTs = new Date(`${payment.paymentDate}T00:00:00Z`).getTime()
    const elapsedDays = Math.max(0, Math.floor((endTs - startTs) / (1000 * 60 * 60 * 24)))

    const accruedInterest = roundMoney((outstanding * annualRate * elapsedDays) / 36500)
    const explicitInterest = payment.interestComponent !== undefined ? roundMoney(payment.interestComponent) : undefined
    const interestComponent = explicitInterest ?? Math.min(totalAmount, accruedInterest)
    const principalComponent = roundMoney(totalAmount - interestComponent)

    if (interestComponent < 0 || principalComponent < 0) {
      throw new Error('Invalid payment split')
    }

    if (principalComponent > outstanding) {
      throw new Error('Principal component cannot exceed outstanding principal')
    }

    const newOutstanding = roundMoney(outstanding - principalComponent)
    const nextStatus = newOutstanding <= 0 ? 'paid' : 'active'

    const paymentResult = await client.query<LoanPayment>(
      `
      INSERT INTO public.loan_payments (
        id,
        user_id,
        loan_id,
        account_id,
        payment_date,
        total_amount,
        principal_component,
        interest_component,
        note,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        NOW()
      )
      RETURNING
        id,
        loan_id as "loanId",
        account_id as "accountId",
        payment_date as "paymentDate",
        total_amount as "totalAmount",
        principal_component as "principalComponent",
        interest_component as "interestComponent",
        note,
        created_at as "createdAt"
      `,
      [
        userId,
        payment.loanId,
        payment.accountId,
        payment.paymentDate,
        totalAmount,
        principalComponent,
        interestComponent,
        payment.note || null,
      ]
    )

    const createdPayment = paymentResult.rows[0]
    if (!createdPayment) throw new Error('Failed to create loan payment')

    await client.query(
      `
      UPDATE public.loans
      SET outstanding_principal = $1, status = $2, updated_at = NOW()
      WHERE id = $3 AND user_id = $4
      `,
      [newOutstanding, nextStatus, payment.loanId, userId]
    )

    // Loan repayment always reduces the account by full paid amount.
    const accountDebit = await client.query(
      'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
      [totalAmount, payment.accountId, userId]
    )
    if (!accountDebit.rowCount) throw new Error('Payment account not found')

    if (interestComponent > 0) {
      // Interest is the expense portion for budgeting/cashflow reports.
      await client.query(
        `
        INSERT INTO public.transactions (
          id,
          user_id,
          type,
          amount,
          category,
          description,
          account_id,
          to_account_id,
          date,
          created_at
        )
        VALUES (
          gen_random_uuid(),
          $1,
          'expense',
          $2,
          'Loan Interest',
          $3,
          $4,
          NULL,
          $5,
          NOW()
        )
        `,
        [
          userId,
          interestComponent,
          `INTEREST PAYMENT - ${loan.lenderName.toUpperCase()}`,
          payment.accountId,
          payment.paymentDate,
        ]
      )

      const month = payment.paymentDate.substring(0, 7)
      await client.query(
        `
        UPDATE public.budgets
        SET spent = spent + $1
        WHERE user_id = $2 AND category = 'Loan Interest' AND month = $3
        `,
        [interestComponent, userId, month]
      )
    }

    const updatedLoanResult = await client.query<Loan>(
      `
      SELECT
        id,
        lender_name as "lenderName",
        account_id as "accountId",
        principal,
        annual_rate as "annualRate",
        start_date as "startDate",
        due_date as "dueDate",
        outstanding_principal as "outstandingPrincipal",
        status,
        notes,
        created_at as "createdAt"
      FROM public.loans
      WHERE id = $1 AND user_id = $2
      `,
      [payment.loanId, userId]
    )

    const updatedLoan = updatedLoanResult.rows[0]
    if (!updatedLoan) throw new Error('Failed to refresh loan after payment')

    return { payment: createdPayment, loan: updatedLoan }
  }, userId)
}
