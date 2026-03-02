import { query, transaction } from './db'
import type { Account, Transaction, Budget, Goal, Category } from './types'

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
    const setClause = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'createdAt')
      .map(([key], index) => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        return `${dbKey} = $${index + 2}`
      })
      .join(', ')

    if (!setClause) return null

    const result = await query<Account>(
      `
      UPDATE public.accounts
      SET ${setClause}
      WHERE id = $1 AND user_id = $${Object.keys(updates).length + 1}
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
      [accountId, ...Object.values(updates), userId],
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
    const setClause = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'createdAt')
      .map(([key], index) => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        return `${dbKey} = $${index + 2}`
      })
      .join(', ')

    if (!setClause) return null

    const result = await query<Budget>(
      `
      UPDATE public.budgets
      SET ${setClause}
      WHERE id = $1 AND user_id = $${Object.keys(updates).length + 1}
      RETURNING 
        id,
        category,
        amount,
        spent,
        month,
        created_at as "createdAt"
      `,
      [budgetId, ...Object.values(updates), userId],
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
    const setClause = Object.entries(updates)
      .filter(([key]) => key !== 'id' && key !== 'createdAt')
      .map(([key], index) => {
        const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        return `${dbKey} = $${index + 2}`
      })
      .join(', ')

    if (!setClause) return null

    const result = await query<Goal>(
      `
      UPDATE public.goals
      SET ${setClause}
      WHERE id = $1 AND user_id = $${Object.keys(updates).length + 1}
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
      [goalId, ...Object.values(updates), userId],
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
