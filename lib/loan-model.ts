export interface SinglePaymentLoanInput {
  principal_amount: number
  flat_interest_rate: number
  loan_duration_days: number
  start_date?: string
}

export interface SinglePaymentLoanOutput {
  total_due: number
  due_date: string
  effective_apr: number
  high_priority_debt: boolean
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function parseDateOnlyToUtc(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error("start_date must use YYYY-MM-DD format")
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(parsed.getTime()) || toDateOnly(parsed) !== value) {
    throw new Error("start_date must use YYYY-MM-DD format")
  }

  return parsed
}

function getTodayDateOnlyUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

export function modelSinglePaymentLoan(input: SinglePaymentLoanInput): SinglePaymentLoanOutput {
  const principal = Number(input.principal_amount)
  const flatRate = Number(input.flat_interest_rate)
  const durationDays = Number(input.loan_duration_days)

  if (!Number.isFinite(principal) || principal <= 0) {
    throw new Error("principal_amount must be a number greater than zero")
  }

  if (!Number.isFinite(flatRate) || flatRate < 0) {
    throw new Error("flat_interest_rate must be a number greater than or equal to zero")
  }

  if (!Number.isFinite(durationDays) || durationDays <= 0 || !Number.isInteger(durationDays)) {
    throw new Error("loan_duration_days must be a positive integer")
  }

  const startDate = input.start_date ? parseDateOnlyToUtc(input.start_date) : getTodayDateOnlyUtc()

  const interest = principal * flatRate
  const totalDue = principal + interest
  const dueDate = new Date(startDate)
  dueDate.setUTCDate(dueDate.getUTCDate() + durationDays)

  const apr = ((interest / principal) / durationDays) * 365 * 100

  return {
    total_due: round2(totalDue),
    due_date: toDateOnly(dueDate),
    effective_apr: round2(apr),
    high_priority_debt: apr > 36,
  }
}
