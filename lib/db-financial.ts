import type { PoolClient } from '@neondatabase/serverless'
import { query, transaction } from './db'
import type { Account, Transaction, Budget, Goal, Category, Loan, LoanPayment, AccountBalanceSnapshot } from './types'

interface LoanPaymentInput {
  loanId: string
  accountId: string
  totalAmount: number
  paymentDate: string
  interestComponent?: number
  note?: string
}

export interface UpcomingObligation {
  id: string
  kind: 'loan' | 'recurring-expense'
  title: string
  amount: number
  dueDate: string
}

interface StoredSinglePaymentLoanModel {
  kind: 'single-payment'
  total_due: number
}

const LOAN_MODEL_PREFIX = '__SINGLE_PAYMENT_MODEL__:'
const MAX_MATERIALIZE_ITERATIONS = 500

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function insufficientBalanceError(context: string, available: number, required: number): Error & { statusCode: number } {
  const error = new Error(
    `Insufficient account balance for ${context}: available ${available}, required ${required}`
  ) as Error & { statusCode: number }
  error.statusCode = 400
  return error
}

/**
 * Applies a signed balance change to an account within an existing DB
 * transaction. Credits (delta >= 0) always succeed. Debits (delta < 0) lock
 * the account row, verify the balance can cover the debit, and reject with a
 * 400 if it can't -- this is the single place account-sufficiency is
 * enforced for every user-initiated balance change (transactions, loan
 * payments, goal contributions).
 */
async function applyAccountDelta(
  client: PoolClient,
  userId: string,
  accountId: string,
  delta: number,
  context: string
): Promise<void> {
  const rounded = roundMoney(delta)
  if (rounded === 0) return

  if (rounded > 0) {
    const result = await client.query(
      'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
      [rounded, accountId, userId]
    )
    if (!result.rowCount) throw new Error(`Account not found (${context})`)
    return
  }

  const debitAmount = roundMoney(-rounded)
  const accountResult = await client.query<{ balance: string }>(
    'SELECT balance FROM public.accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
    [accountId, userId]
  )
  const account = accountResult.rows[0]
  if (!account) throw new Error(`Account not found (${context})`)

  const available = roundMoney(Number(account.balance) || 0)
  if (available < debitAmount) {
    throw insufficientBalanceError(context, available, debitAmount)
  }

  await client.query(
    'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
    [debitAmount, accountId, userId]
  )
}

function isRecurrenceRule(value: unknown): value is 'weekly' | 'monthly' {
  return value === 'weekly' || value === 'monthly'
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function addMonths(monthOnly: string, months: number): string {
  const [year, month] = monthOnly.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1 + months, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function addMonthsDateOnly(dateOnly: string, months: number): string {
  const [year, month, day] = dateOnly.split('-').map(Number)
  const firstDayTargetMonth = new Date(Date.UTC(year, month - 1 + months, 1))
  const targetYear = firstDayTargetMonth.getUTCFullYear()
  const targetMonth = firstDayTargetMonth.getUTCMonth()
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  const clampedDay = Math.min(day, lastDayOfTargetMonth)
  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`
}

function compareDateOnly(a: string, b: string): number {
  if (a === b) return 0
  return a < b ? -1 : 1
}

function parseStoredSinglePaymentLoanModel(notes?: string): StoredSinglePaymentLoanModel | null {
  if (!notes) return null
  const firstLine = notes.split('\n')[0] || ''
  if (!firstLine.startsWith(LOAN_MODEL_PREFIX)) return null

  try {
    const parsed = JSON.parse(firstLine.slice(LOAN_MODEL_PREFIX.length)) as StoredSinglePaymentLoanModel
    if (parsed?.kind !== 'single-payment') return null
    if (!Number.isFinite(Number(parsed.total_due)) || Number(parsed.total_due) <= 0) return null
    return parsed
  } catch {
    return null
  }
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
        institution,
        account_product as "accountProduct",
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
        institution,
        account_product,
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
        $10,
        $11,
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
        institution,
        account_product as "accountProduct",
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
        account.institution || null,
        account.accountProduct || null,
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
      institution: 'institution',
      accountProduct: 'account_product',
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
        institution,
        account_product as "accountProduct",
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

// NOTE: balance changes below intentionally do NOT go through the
// sufficiency-checked applyAccountDelta() helper. This function runs
// automatically inside getTransactions() (a read path) to roll forward any
// recurring rule up to today; a recurring bill is due whether or not the
// account can currently absorb it (same as a real-world debit order), and
// throwing here would break simply viewing the transaction list. Overdraft
// from a recurring rule is expected; sufficiency is only enforced for
// discrete, user-initiated actions (see applyAccountDelta call sites below).
async function materializeRecurringTransactions(userId: string): Promise<void> {
  await transaction(async (client) => {
    const recurringResult = await client.query<
      Pick<Transaction, 'id' | 'type' | 'amount' | 'category' | 'description' | 'accountId' | 'toAccountId' | 'date'> & {
        recurrenceRule: 'weekly' | 'monthly'
        recurrenceEndDate: string | null
      }
    >(
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
        recurrence_rule as "recurrenceRule",
        recurrence_end_date as "recurrenceEndDate"
      FROM public.transactions
      WHERE
        user_id = $1
        AND recurrence_rule IS NOT NULL
        AND parent_transaction_id IS NULL
      `,
      [userId]
    )

    const today = new Date().toISOString().slice(0, 10)

    for (const source of recurringResult.rows) {
      const maxExistingResult = await client.query<{ maxDate: string | null }>(
        `
        SELECT MAX(date)::text as "maxDate"
        FROM public.transactions
        WHERE
          user_id = $1
          AND (id = $2 OR parent_transaction_id = $2)
        `,
        [userId, source.id]
      )

      let nextDate = maxExistingResult.rows[0]?.maxDate || source.date
      let iterations = 0
      while (true) {
        iterations += 1
        if (iterations > MAX_MATERIALIZE_ITERATIONS) {
          console.warn(`materializeRecurringTransactions: hit iteration cap for recurring transaction ${source.id}`)
          break
        }

        nextDate =
          source.recurrenceRule === 'weekly'
            ? addDays(nextDate, 7)
            : addMonthsDateOnly(nextDate, 1)

        if (compareDateOnly(nextDate, today) > 0) break
        if (source.recurrenceEndDate && compareDateOnly(nextDate, source.recurrenceEndDate) > 0) break

        const existingResult = await client.query<{ exists: boolean }>(
          `
          SELECT EXISTS (
            SELECT 1
            FROM public.transactions
            WHERE user_id = $1 AND parent_transaction_id = $2 AND date = $3
          ) as exists
          `,
          [userId, source.id, nextDate]
        )
        if (existingResult.rows[0]?.exists) continue

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
            recurrence_rule,
            recurrence_end_date,
            parent_transaction_id,
            is_system_generated,
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
            NULL,
            NULL,
            $9,
            true,
            NOW()
          )
          `,
          [
            userId,
            source.type,
            source.amount,
            source.category,
            source.description,
            source.accountId,
            source.toAccountId || null,
            nextDate,
            source.id,
          ]
        )

        if (source.type === 'income') {
          await client.query(
            'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
            [source.amount, source.accountId, userId]
          )
        } else if (source.type === 'expense') {
          await client.query(
            'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
            [source.amount, source.accountId, userId]
          )
        } else if (source.type === 'transfer' && source.toAccountId) {
          await client.query(
            'UPDATE public.accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
            [source.amount, source.accountId, userId]
          )
          await client.query(
            'UPDATE public.accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
            [source.amount, source.toAccountId, userId]
          )
        }
      }
    }
  }, userId)
}

export async function getTransactions(userId: string): Promise<Transaction[]> {
  try {
    await materializeRecurringTransactions(userId)

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
        recurrence_rule as "recurrenceRule",
        recurrence_end_date as "recurrenceEndDate",
        parent_transaction_id as "parentTransactionId",
        is_system_generated as "isSystemGenerated",
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
        recurrence_rule,
        recurrence_end_date,
        parent_transaction_id,
        is_system_generated,
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
        $10,
        NULL,
        false,
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
        recurrence_rule as "recurrenceRule",
        recurrence_end_date as "recurrenceEndDate",
        parent_transaction_id as "parentTransactionId",
        is_system_generated as "isSystemGenerated",
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
        isRecurrenceRule(trans.recurrenceRule) ? trans.recurrenceRule : null,
        trans.recurrenceEndDate || null,
      ]
    )

    if (!transResult.rows[0]) throw new Error('Failed to create transaction')

    // Update account balance
    if (trans.type === 'income') {
      await applyAccountDelta(client, userId, trans.accountId, trans.amount, 'income transaction')
    } else if (trans.type === 'expense') {
      await applyAccountDelta(client, userId, trans.accountId, -trans.amount, 'expense transaction')
    } else if (trans.type === 'transfer' && trans.toAccountId) {
      await applyAccountDelta(client, userId, trans.accountId, -trans.amount, 'transfer transaction')
      await applyAccountDelta(client, userId, trans.toAccountId, trans.amount, 'transfer transaction')
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

    // Reverse the balance effects applied during insertion. Budget "spent" is
    // derived from transactions at read time (see getBudgets), so no budget
    // reversal is needed here. Reversing a prior credit is itself a debit
    // (e.g. undoing an income or an inbound transfer), so it goes through
    // applyAccountDelta and can be rejected if the balance can't absorb it.
    if (trans.type === 'income') {
      await applyAccountDelta(client, userId, trans.accountId, -trans.amount, 'transaction deletion')
    } else if (trans.type === 'expense') {
      await applyAccountDelta(client, userId, trans.accountId, trans.amount, 'transaction deletion')
    } else if (trans.type === 'transfer' && trans.toAccountId) {
      await applyAccountDelta(client, userId, trans.accountId, trans.amount, 'transaction deletion')
      await applyAccountDelta(client, userId, trans.toAccountId, -trans.amount, 'transaction deletion')
    } else if (trans.type === 'transfer' && !trans.toAccountId) {
      // System inbound transfer (e.g., loan funding): reverse the one-sided credit.
      await applyAccountDelta(client, userId, trans.accountId, -trans.amount, 'transaction deletion')
    }

    const deleted = await client.query(
      'DELETE FROM public.transactions WHERE id = $1 AND user_id = $2',
      [transactionId, userId]
    )

    return (deleted.rowCount || 0) > 0
  }, userId)
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  updates: { amount?: number; category?: string; description?: string; date?: string }
): Promise<Transaction | null> {
  return transaction(async (client) => {
    const existing = await client.query<
      Pick<Transaction, 'id' | 'type' | 'amount' | 'category' | 'description' | 'accountId' | 'toAccountId' | 'date' | 'isSystemGenerated'>
    >(
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
        is_system_generated as "isSystemGenerated"
      FROM public.transactions
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [transactionId, userId]
    )

    const trans = existing.rows[0]
    if (!trans) return null
    if (trans.isSystemGenerated) {
      const error = new Error('System-generated entries cannot be edited directly') as Error & { statusCode?: number }
      error.statusCode = 400
      throw error
    }

    const newAmount = updates.amount !== undefined ? roundMoney(updates.amount) : Number(trans.amount)
    const newCategory = updates.category !== undefined ? updates.category : trans.category
    const newDescription = updates.description !== undefined ? updates.description : trans.description
    const newDate = updates.date !== undefined ? updates.date : trans.date

    // Apply the NET effect of reversing the OLD amount and reapplying the NEW
    // amount in a single balance change per account, rather than two separate
    // updates -- this ensures the sufficiency check (inside applyAccountDelta)
    // sees the correct post-reversal balance rather than a stale pre-reversal
    // one. Type and accounts are never changed by an edit, so this mirrors
    // deleteTransaction's reversal for the applicable branch only.
    if (trans.type === 'income') {
      await applyAccountDelta(client, userId, trans.accountId, newAmount - trans.amount, 'transaction update')
    } else if (trans.type === 'expense') {
      await applyAccountDelta(client, userId, trans.accountId, trans.amount - newAmount, 'transaction update')
    } else if (trans.type === 'transfer' && trans.toAccountId) {
      await applyAccountDelta(client, userId, trans.accountId, trans.amount - newAmount, 'transaction update')
      await applyAccountDelta(client, userId, trans.toAccountId, newAmount - trans.amount, 'transaction update')
    } else if (trans.type === 'transfer' && !trans.toAccountId) {
      await applyAccountDelta(client, userId, trans.accountId, newAmount - trans.amount, 'transaction update')
    }

    const updated = await client.query<Transaction>(
      `
      UPDATE public.transactions
      SET amount = $1, category = $2, description = $3, date = $4
      WHERE id = $5 AND user_id = $6
      RETURNING
        id,
        type,
        amount,
        category,
        description,
        account_id as "accountId",
        to_account_id as "toAccountId",
        date,
        recurrence_rule as "recurrenceRule",
        recurrence_end_date as "recurrenceEndDate",
        parent_transaction_id as "parentTransactionId",
        is_system_generated as "isSystemGenerated",
        created_at as "createdAt"
      `,
      [newAmount, newCategory, newDescription, newDate, transactionId, userId]
    )

    return updated.rows[0] || null
  }, userId)
}

// ============================================================================
// BUDGETS
// ============================================================================

async function materializeRecurringBudgets(userId: string): Promise<void> {
  await transaction(async (client) => {
    const recurringResult = await client.query<
      Pick<Budget, 'category' | 'amount' | 'month'> & { isRecurring: boolean }
    >(
      `
      SELECT
        category,
        amount,
        month,
        is_recurring as "isRecurring"
      FROM public.budgets
      WHERE user_id = $1 AND is_recurring = true
      ORDER BY month ASC
      `,
      [userId]
    )

    const currentMonth = new Date().toISOString().slice(0, 7)
    const templateByCategory = new Map<string, { amount: number; month: string }>()
    recurringResult.rows.forEach((row) => {
      const existing = templateByCategory.get(row.category)
      if (!existing || existing.month < row.month) {
        templateByCategory.set(row.category, { amount: Number(row.amount) || 0, month: row.month })
      }
    })

    for (const [category, template] of templateByCategory.entries()) {
      let nextMonth = addMonths(template.month, 1)
      let iterations = 0
      while (nextMonth <= currentMonth) {
        iterations += 1
        if (iterations > MAX_MATERIALIZE_ITERATIONS) {
          console.warn(`materializeRecurringBudgets: hit iteration cap for category ${category}`)
          break
        }

        const existingResult = await client.query<{ exists: boolean }>(
          `
          SELECT EXISTS (
            SELECT 1
            FROM public.budgets
            WHERE user_id = $1 AND category = $2 AND month = $3
          ) as exists
          `,
          [userId, category, nextMonth]
        )

        if (!existingResult.rows[0]?.exists) {
          await client.query(
            `
            INSERT INTO public.budgets (
              id,
              user_id,
              category,
              amount,
              spent,
              month,
              is_recurring,
              created_at
            )
            VALUES (
              gen_random_uuid(),
              $1,
              $2,
              $3,
              0,
              $4,
              true,
              NOW()
            )
            `,
            [userId, category, template.amount, nextMonth]
          )
        }

        nextMonth = addMonths(nextMonth, 1)
      }
    }
  }, userId)
}

export async function getBudgets(userId: string): Promise<Budget[]> {
  try {
    await materializeRecurringBudgets(userId)

    const result = await query<Budget>(
      `
      SELECT
        b.id,
        b.category,
        b.amount,
        COALESCE((
          SELECT SUM(t.amount)
          FROM public.transactions t
          WHERE t.user_id = b.user_id
            AND t.type = 'expense'
            AND t.category = b.category
            AND t.date >= (b.month || '-01')::date
            AND t.date < ((b.month || '-01')::date + INTERVAL '1 month')
        ), 0) as spent,
        b.month,
        b.is_recurring as "isRecurring",
        b.created_at as "createdAt"
      FROM public.budgets b
      WHERE b.user_id = $1
      ORDER BY b.month DESC, b.category ASC
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
        is_recurring,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        0,
        $4,
        $5,
        NOW()
      )
      RETURNING 
        id,
        category,
        amount,
        spent,
        month,
        is_recurring as "isRecurring",
        created_at as "createdAt"
      `,
      [userId, budget.category, budget.amount, budget.month, Boolean(budget.isRecurring)],
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
      isRecurring: 'is_recurring',
    }

    const filteredEntries = Object.entries(updates).filter(
      ([key, value]) => key in allowedFields && value !== undefined
    )

    const setClause = filteredEntries
      .map(([key], index) => `${allowedFields[key]} = $${index + 2}`)
      .join(', ')

    if (!setClause) return null

    const updated = await query<{ id: string }>(
      `
      UPDATE public.budgets
      SET ${setClause}
      WHERE id = $1 AND user_id = $${filteredEntries.length + 2}
      RETURNING id
      `,
      [budgetId, ...filteredEntries.map(([, value]) => value), userId],
      userId
    )

    const updatedId = updated.rows[0]?.id
    if (!updatedId) return null

    const result = await query<Budget>(
      `
      SELECT
        b.id,
        b.category,
        b.amount,
        COALESCE((
          SELECT SUM(t.amount)
          FROM public.transactions t
          WHERE t.user_id = b.user_id
            AND t.type = 'expense'
            AND t.category = b.category
            AND t.date >= (b.month || '-01')::date
            AND t.date < ((b.month || '-01')::date + INTERVAL '1 month')
        ), 0) as spent,
        b.month,
        b.is_recurring as "isRecurring",
        b.created_at as "createdAt"
      FROM public.budgets b
      WHERE b.id = $1 AND b.user_id = $2
      `,
      [updatedId, userId],
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

export async function contributeToGoal(
  userId: string,
  goalId: string,
  payload: { accountId: string; amount: number; date?: string }
): Promise<{ goal: Goal; transaction: Transaction }> {
  return transaction(async (client) => {
    const goalResult = await client.query<Goal>(
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
      WHERE id = $1 AND user_id = $2
      FOR UPDATE
      `,
      [goalId, userId]
    )

    const goal = goalResult.rows[0]
    if (!goal) throw new Error('Goal not found')
    if (goal.status !== 'active') throw new Error('Only active goals can receive contributions')

    const amount = roundMoney(payload.amount)
    if (amount <= 0) throw new Error('Contribution amount must be greater than zero')

    const contributionDate = payload.date || new Date().toISOString().slice(0, 10)

    await applyAccountDelta(client, userId, payload.accountId, -amount, 'goal contribution')

    const transactionResult = await client.query<Transaction>(
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
        'Savings',
        $3,
        $4,
        NULL,
        $5,
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
        recurrence_rule as "recurrenceRule",
        recurrence_end_date as "recurrenceEndDate",
        parent_transaction_id as "parentTransactionId",
        is_system_generated as "isSystemGenerated",
        created_at as "createdAt"
      `,
      [userId, amount, `GOAL CONTRIBUTION - ${goal.name.toUpperCase()}`, payload.accountId, contributionDate]
    )

    const newCurrentAmount = roundMoney((Number(goal.currentAmount) || 0) + amount)
    const newStatus = newCurrentAmount >= Number(goal.targetAmount) ? 'completed' : goal.status

    const updatedGoalResult = await client.query<Goal>(
      `
      UPDATE public.goals
      SET current_amount = $1, status = $2
      WHERE id = $3 AND user_id = $4
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
      [newCurrentAmount, newStatus, goalId, userId]
    )

    const updatedGoal = updatedGoalResult.rows[0]
    const createdTransaction = transactionResult.rows[0]
    if (!updatedGoal || !createdTransaction) throw new Error('Failed to record goal contribution')

    return { goal: updatedGoal, transaction: createdTransaction }
  }, userId)
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

export async function getAccountBalanceSnapshots(userId: string): Promise<AccountBalanceSnapshot[]> {
  try {
    const result = await query<AccountBalanceSnapshot>(
      `
      SELECT
        id,
        account_id as "accountId",
        snapshot_date as "snapshotDate",
        app_calculated_balance as "appCalculatedBalance",
        actual_balance as "actualBalance",
        delta,
        note,
        created_at as "createdAt"
      FROM public.account_balance_snapshots
      WHERE user_id = $1
      ORDER BY snapshot_date DESC, created_at DESC
      `,
      [userId],
      userId
    )
    return result.rows
  } catch (error) {
    console.error('Error fetching account balance snapshots:', error)
    throw error
  }
}

export async function addAccountBalanceSnapshot(
  userId: string,
  payload: {
    accountId: string
    snapshotDate: string
    appCalculatedBalance: number
    actualBalance: number
    note?: string
  }
): Promise<AccountBalanceSnapshot> {
  try {
    const delta = roundMoney(payload.actualBalance - payload.appCalculatedBalance)
    const result = await query<AccountBalanceSnapshot>(
      `
      INSERT INTO public.account_balance_snapshots (
        id,
        user_id,
        account_id,
        snapshot_date,
        app_calculated_balance,
        actual_balance,
        delta,
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
        NOW()
      )
      RETURNING
        id,
        account_id as "accountId",
        snapshot_date as "snapshotDate",
        app_calculated_balance as "appCalculatedBalance",
        actual_balance as "actualBalance",
        delta,
        note,
        created_at as "createdAt"
      `,
      [
        userId,
        payload.accountId,
        payload.snapshotDate,
        roundMoney(payload.appCalculatedBalance),
        roundMoney(payload.actualBalance),
        delta,
        payload.note || null,
      ],
      userId
    )

    if (!result.rows[0]) throw new Error('Failed to create account balance snapshot')
    return result.rows[0]
  } catch (error) {
    console.error('Error creating account balance snapshot:', error)
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

export async function getUpcomingObligations(userId: string, daysAhead = 30): Promise<UpcomingObligation[]> {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const rangeEnd = addDays(today, daysAhead)

    const obligations: UpcomingObligation[] = []

    const loansResult = await query<Loan>(
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
      WHERE user_id = $1 AND status = 'active' AND due_date >= $2 AND due_date <= $3
      `,
      [userId, today, rangeEnd],
      userId
    )

    const paidInterestResult = await query<{ loanId: string; totalInterest: string }>(
      `
      SELECT loan_id as "loanId", COALESCE(SUM(interest_component), 0)::text as "totalInterest"
      FROM public.loan_payments
      WHERE user_id = $1
      GROUP BY loan_id
      `,
      [userId],
      userId
    )
    const paidInterestMap = new Map<string, number>()
    paidInterestResult.rows.forEach((row) => paidInterestMap.set(row.loanId, Number(row.totalInterest) || 0))

    for (const loan of loansResult.rows) {
      const outstandingPrincipal = Number(loan.outstandingPrincipal) || 0
      const modeled = parseStoredSinglePaymentLoanModel(loan.notes)
      let dueAmount = outstandingPrincipal

      if (modeled) {
        const modeledTotalDue = Number(modeled.total_due) || 0
        const modeledInterest = Math.max(0, modeledTotalDue - (Number(loan.principal) || 0))
        const paidInterest = paidInterestMap.get(loan.id) || 0
        dueAmount += Math.max(0, modeledInterest - paidInterest)
      }

      obligations.push({
        id: `loan:${loan.id}`,
        kind: 'loan',
        title: `LOAN DUE - ${loan.lenderName}`,
        amount: roundMoney(dueAmount),
        dueDate: loan.dueDate,
      })
    }

    const recurringRootsResult = await query<
      Pick<Transaction, 'id' | 'category' | 'amount' | 'description' | 'date' | 'type'> & {
        recurrenceRule: 'weekly' | 'monthly'
        recurrenceEndDate: string | null
      }
    >(
      `
      SELECT
        id,
        type,
        amount,
        category,
        description,
        date,
        recurrence_rule as "recurrenceRule",
        recurrence_end_date as "recurrenceEndDate"
      FROM public.transactions
      WHERE
        user_id = $1
        AND recurrence_rule IS NOT NULL
        AND parent_transaction_id IS NULL
        AND type IN ('expense', 'transfer')
      `,
      [userId],
      userId
    )

    for (const root of recurringRootsResult.rows) {
      const maxExistingResult = await query<{ maxDate: string | null }>(
        `
        SELECT MAX(date)::text as "maxDate"
        FROM public.transactions
        WHERE user_id = $1 AND (id = $2 OR parent_transaction_id = $2)
        `,
        [userId, root.id],
        userId
      )

      let nextDate = maxExistingResult.rows[0]?.maxDate || root.date
      while (true) {
        nextDate = root.recurrenceRule === 'weekly' ? addDays(nextDate, 7) : addMonthsDateOnly(nextDate, 1)
        if (nextDate > rangeEnd) break
        if (root.recurrenceEndDate && nextDate > root.recurrenceEndDate) break
        if (nextDate < today) continue

        obligations.push({
          id: `recurring:${root.id}:${nextDate}`,
          kind: 'recurring-expense',
          title: root.description || root.category,
          amount: Number(root.amount) || 0,
          dueDate: nextDate,
        })
      }
    }

    return obligations.sort((a, b) => (a.dueDate === b.dueDate ? b.amount - a.amount : a.dueDate.localeCompare(b.dueDate)))
  } catch (error) {
    console.error('Error fetching upcoming obligations:', error)
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
        'transfer',
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
    const singlePaymentModel = parseStoredSinglePaymentLoanModel(loan.notes)
    let modeledInterestToApply: number | undefined

    if (singlePaymentModel) {
      const modeledTotalDue = roundMoney(Number(singlePaymentModel.total_due))
      const totalModeledInterest = roundMoney(Math.max(0, modeledTotalDue - (Number(loan.principal) || 0)))
      const paidInterestResult = await client.query<{ total: string | null }>(
        `
        SELECT COALESCE(SUM(interest_component), 0)::text as total
        FROM public.loan_payments
        WHERE loan_id = $1 AND user_id = $2
        `,
        [payment.loanId, userId]
      )
      const paidInterestSoFar = roundMoney(Number(paidInterestResult.rows[0]?.total || 0))
      const remainingModeledInterest = roundMoney(Math.max(0, totalModeledInterest - paidInterestSoFar))
      modeledInterestToApply = Math.min(totalAmount, remainingModeledInterest)
    }

    const explicitInterest = payment.interestComponent !== undefined ? roundMoney(payment.interestComponent) : undefined
    const interestComponent =
      explicitInterest ??
      (modeledInterestToApply !== undefined ? modeledInterestToApply : Math.min(totalAmount, accruedInterest))
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
    await applyAccountDelta(client, userId, payment.accountId, -totalAmount, 'loan payment')

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
