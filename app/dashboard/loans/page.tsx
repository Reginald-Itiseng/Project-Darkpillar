"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import * as apiStorage from "@/lib/api-storage"
import type { Account, Loan, LoanPayment } from "@/lib/types"
import { formatCurrency, formatDate, getCurrentMonth } from "@/lib/utils"
import { Plus, HandCoins, CalendarClock, AlertTriangle, Percent, X } from "lucide-react"

function isDueSoon(dueDate: string): boolean {
  const now = new Date()
  const due = new Date(`${dueDate}T00:00:00`)
  const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays >= 0 && diffDays <= 7
}

type LoanModelResult = {
  total_due: number
  due_date: string
  effective_apr: number
  high_priority_debt: boolean
}

type StoredLoanModel = {
  kind: "single-payment"
  flat_interest_rate: number
  loan_duration_days: number
  total_due: number
  effective_apr: number
  high_priority_debt: boolean
}

const LOAN_MODEL_PREFIX = "__SINGLE_PAYMENT_MODEL__:"

function parseLoanNotes(notes?: string): { model: StoredLoanModel | null; plainNotes: string } {
  if (!notes) return { model: null, plainNotes: "" }

  const [firstLine, ...rest] = notes.split("\n")
  if (!firstLine.startsWith(LOAN_MODEL_PREFIX)) {
    return { model: null, plainNotes: notes }
  }

  try {
    const raw = JSON.parse(firstLine.slice(LOAN_MODEL_PREFIX.length)) as StoredLoanModel
    if (raw?.kind !== "single-payment") {
      return { model: null, plainNotes: rest.join("\n").trim() }
    }
    return { model: raw, plainNotes: rest.join("\n").trim() }
  } catch {
    return { model: null, plainNotes: notes }
  }
}

function composeLoanNotes(plainNotes: string, model: StoredLoanModel | null): string | undefined {
  const normalizedNotes = plainNotes.trim()
  if (!model && !normalizedNotes) return undefined
  if (!model) return normalizedNotes

  const modelLine = `${LOAN_MODEL_PREFIX}${JSON.stringify(model)}`
  return normalizedNotes ? `${modelLine}\n${normalizedNotes}` : modelLine
}

export default function LoansPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [payments, setPayments] = useState<LoanPayment[]>([])
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [paymentLoan, setPaymentLoan] = useState<Loan | null>(null)

  const loadData = async () => {
    const [accountsData, loanData] = await Promise.all([apiStorage.getAccounts(), apiStorage.getLoans()])
    setAccounts(accountsData.filter((a) => a.isActive))
    setLoans(loanData.loans)
    setPayments(loanData.payments)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const activeLoans = loans.filter((loan) => loan.status === "active")
  const totalOutstanding = activeLoans.reduce((sum, loan) => sum + (Number(loan.outstandingPrincipal) || 0), 0)
  const dueSoonCount = activeLoans.filter((loan) => isDueSoon(loan.dueDate)).length
  const currentMonth = getCurrentMonth()
  const monthlyInterestPaid = payments
    .filter((payment) => payment.paymentDate.startsWith(currentMonth))
    .reduce((sum, payment) => sum + (Number(payment.interestComponent) || 0), 0)

  const accountNames = useMemo(() => {
    const map = new Map<string, string>()
    accounts.forEach((account) => map.set(account.id, account.name))
    return map
  }, [accounts])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-mono text-2xl text-foreground">LOAN CONTROL</h1>
              <p className="font-mono text-sm text-muted-foreground">TRACK PRINCIPAL, INTEREST, AND REPAYMENT WINDOWS</p>
            </div>
            <button
              onClick={() => {
                setEditingLoan(null)
                setShowLoanModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              NEW LOAN
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                  <HandCoins className="w-5 h-5 text-destructive" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">TOTAL OUTSTANDING</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{formatCurrency(totalOutstanding)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-warning/10 border border-warning/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">DUE IN 7 DAYS</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{dueSoonCount}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Percent className="w-5 h-5 text-primary" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">INTEREST PAID THIS MONTH</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{formatCurrency(monthlyInterestPaid)}</div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-mono text-sm text-foreground">ACTIVE AND HISTORICAL LOANS</h2>
              <span className="font-mono text-xs text-muted-foreground">{loans.length} TOTAL</span>
            </div>

            {loans.length === 0 ? (
              <div className="p-10 text-center font-mono text-sm text-muted-foreground">
                NO LOANS RECORDED. CREATE A LOAN WHEN YOU TAKE BORROWED FUNDS.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {loans.map((loan) => {
                  const principal = Number(loan.principal) || 0
                  const outstanding = Number(loan.outstandingPrincipal) || 0
                  const repaid = principal - outstanding
                  const progress = principal > 0 ? Math.min(100, Math.max(0, (repaid / principal) * 100)) : 0
                  const parsedNotes = parseLoanNotes(loan.notes)
                  const modeledLoan = parsedNotes.model

                  return (
                    <div key={loan.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-mono text-sm text-foreground">{loan.lenderName}</div>
                          <div className="font-mono text-xs text-muted-foreground mt-1">
                            ACCOUNT: {accountNames.get(loan.accountId) || "UNKNOWN"} | START: {formatDate(loan.startDate)}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <CalendarClock className="w-3.5 h-3.5" />
                            <span>DUE: {formatDate(loan.dueDate)}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-xs text-muted-foreground">
                            STATUS:{" "}
                            <span
                              className={
                                loan.status === "active"
                                  ? "text-warning"
                                  : loan.status === "paid"
                                    ? "text-success"
                                    : "text-destructive"
                              }
                            >
                              {loan.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="font-mono text-xs text-muted-foreground mt-1">
                            {modeledLoan ? "EFFECTIVE APR" : "ANNUAL RATE"}: {loan.annualRate}%
                          </div>
                        </div>
                      </div>

                      {modeledLoan && (
                        <div className="mt-3 p-3 bg-secondary/40 border border-border rounded">
                          <div className="font-mono text-xs text-muted-foreground mb-2">SINGLE-PAYMENT MODEL OUTPUT</div>
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <div className="font-mono text-xs text-foreground">
                              TOTAL DUE: {formatCurrency(modeledLoan.total_due)}
                            </div>
                            <div className="font-mono text-xs text-foreground">
                              FLAT RATE: {(modeledLoan.flat_interest_rate * 100).toFixed(2)}%
                            </div>
                            <div className="font-mono text-xs text-foreground">
                              DURATION: {modeledLoan.loan_duration_days} DAYS
                            </div>
                            <div className="font-mono text-xs text-foreground">
                              FIXED INTEREST: {formatCurrency(modeledLoan.total_due - principal)}
                            </div>
                          </div>
                          {modeledLoan.high_priority_debt && (
                            <div className="mt-2 font-mono text-xs text-destructive flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              HIGH-PRIORITY DEBT (APR ABOVE 36%)
                            </div>
                          )}
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 bg-secondary/40 border border-border rounded">
                          <div className="font-mono text-xs text-muted-foreground">PRINCIPAL</div>
                          <div className="font-mono text-sm text-foreground">{formatCurrency(principal)}</div>
                        </div>
                        <div className="p-3 bg-secondary/40 border border-border rounded">
                          <div className="font-mono text-xs text-muted-foreground">OUTSTANDING</div>
                          <div className="font-mono text-sm text-foreground">{formatCurrency(outstanding)}</div>
                        </div>
                        <div className="p-3 bg-secondary/40 border border-border rounded">
                          <div className="font-mono text-xs text-muted-foreground">REPAID</div>
                          <div className="font-mono text-sm text-foreground">{formatCurrency(repaid)}</div>
                        </div>
                      </div>

                      <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                      </div>

                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setPaymentLoan(loan)}
                          disabled={loan.status !== "active"}
                          className="px-3 py-2 bg-primary text-primary-foreground font-mono text-xs rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          RECORD PAYMENT
                        </button>
                        <button
                          onClick={() => {
                            setEditingLoan(loan)
                            setShowLoanModal(true)
                          }}
                          className="px-3 py-2 border border-border text-muted-foreground font-mono text-xs rounded hover:bg-secondary hover:text-foreground"
                        >
                          EDIT TERMS
                        </button>
                      </div>

                      {parsedNotes.plainNotes && (
                        <div className="mt-3 p-3 bg-secondary/20 border border-border rounded">
                          <div className="font-mono text-xs text-muted-foreground mb-1">NOTES</div>
                          <div className="font-mono text-xs text-foreground whitespace-pre-wrap">{parsedNotes.plainNotes}</div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {showLoanModal && (
        <LoanModal
          loan={editingLoan}
          accounts={accounts}
          onClose={() => {
            setShowLoanModal(false)
            setEditingLoan(null)
          }}
          onSaved={async () => {
            await loadData()
            setShowLoanModal(false)
            setEditingLoan(null)
          }}
        />
      )}

      {paymentLoan && (
        <PaymentModal
          loan={paymentLoan}
          onClose={() => setPaymentLoan(null)}
          onSaved={async () => {
            await loadData()
            setPaymentLoan(null)
          }}
        />
      )}
    </div>
  )
}

function LoanModal({
  loan,
  accounts,
  onClose,
  onSaved,
}: {
  loan: Loan | null
  accounts: Account[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const parsedLoanNotes = parseLoanNotes(loan?.notes)
  const existingModel = parsedLoanNotes.model
  const [lenderName, setLenderName] = useState(loan?.lenderName || "")
  const [accountId, setAccountId] = useState(loan?.accountId || accounts[0]?.id || "")
  const [principal, setPrincipal] = useState(loan ? String(loan.principal) : "")
  const [annualRate, setAnnualRate] = useState(loan ? String(loan.annualRate) : "")
  const [startDate, setStartDate] = useState(loan?.startDate || new Date().toISOString().split("T")[0])
  const [dueDate, setDueDate] = useState(loan?.dueDate || new Date().toISOString().split("T")[0])
  const [status, setStatus] = useState<Loan["status"]>(loan?.status || "active")
  const [notes, setNotes] = useState(parsedLoanNotes.plainNotes)
  const [loanType, setLoanType] = useState<"standard" | "single-payment">(existingModel ? "single-payment" : "standard")
  const [flatInterestRatePercent, setFlatInterestRatePercent] = useState(
    existingModel ? String(existingModel.flat_interest_rate * 100) : ""
  )
  const [loanDurationDays, setLoanDurationDays] = useState(existingModel ? String(existingModel.loan_duration_days) : "")
  const [modelResult, setModelResult] = useState<LoanModelResult | null>(
    existingModel
      ? {
          total_due: existingModel.total_due,
          due_date: loan?.dueDate || new Date().toISOString().split("T")[0],
          effective_apr: existingModel.effective_apr,
          high_priority_debt: existingModel.high_priority_debt,
        }
      : null
  )
  const [isModeling, setIsModeling] = useState(false)
  const [error, setError] = useState("")
  const isEdit = !!loan

  const handleRunModel = async () => {
    setError("")
    setModelResult(null)
    try {
      setIsModeling(true)
      const result = await apiStorage.modelSinglePaymentLoan({
        principal_amount: Number(principal),
        flat_interest_rate: Number(flatInterestRatePercent) / 100,
        loan_duration_days: Number(loanDurationDays),
        start_date: startDate,
      })

      setModelResult(result)
      setDueDate(result.due_date)
      setAnnualRate(String(result.effective_apr))
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : "FAILED TO MODEL LOAN")
    } finally {
      setIsModeling(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      const isSinglePayment = loanType === "single-payment"
      if (isSinglePayment && !modelResult) {
        throw new Error("Run the single-payment model before saving this loan")
      }

      const storedModel: StoredLoanModel | null =
        isSinglePayment && modelResult
          ? {
              kind: "single-payment",
              flat_interest_rate: Number(flatInterestRatePercent) / 100,
              loan_duration_days: Number(loanDurationDays),
              total_due: Number(modelResult.total_due),
              effective_apr: Number(modelResult.effective_apr),
              high_priority_debt: Boolean(modelResult.high_priority_debt),
            }
          : null

      const combinedNotes = composeLoanNotes(notes, storedModel)
      const effectiveRate = isSinglePayment && modelResult ? Number(modelResult.effective_apr) : Number(annualRate)
      const effectiveDueDate = isSinglePayment && modelResult ? modelResult.due_date : dueDate

      if (isEdit && loan) {
        await apiStorage.updateLoan(loan.id, {
          lenderName,
          annualRate: effectiveRate,
          dueDate: effectiveDueDate,
          status,
          notes: combinedNotes,
        })
      } else {
        await apiStorage.addLoan({
          lenderName,
          accountId,
          principal: Number(principal),
          annualRate: effectiveRate,
          startDate,
          dueDate: effectiveDueDate,
          notes: combinedNotes,
        })
      }

      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : "FAILED TO SAVE LOAN")
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-mono text-sm text-foreground">{isEdit ? "EDIT LOAN" : "NEW LOAN"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">LOAN TYPE</label>
            <select
              value={loanType}
              onChange={(e) => {
                const nextType = e.target.value as "standard" | "single-payment"
                setLoanType(nextType)
                if (nextType === "standard") {
                  setModelResult(null)
                } else if (!loanDurationDays && startDate && dueDate) {
                  const start = new Date(`${startDate}T00:00:00Z`).getTime()
                  const due = new Date(`${dueDate}T00:00:00Z`).getTime()
                  const days = Math.max(1, Math.ceil((due - start) / (1000 * 60 * 60 * 24)))
                  setLoanDurationDays(String(days))
                }
              }}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
            >
              <option value="standard">STANDARD LOAN</option>
              <option value="single-payment">SINGLE-PAYMENT (FLAT INTEREST)</option>
            </select>
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">LENDER NAME</label>
            <input
              type="text"
              value={lenderName}
              onChange={(e) => setLenderName(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary uppercase"
            />
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">ACCOUNT</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              disabled={isEdit}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">PRINCIPAL (P)</label>
              <input
                type="number"
                step="0.01"
                value={principal}
                disabled={isEdit}
                onChange={(e) => setPrincipal(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">
                {loanType === "single-payment" ? "EFFECTIVE APR (%)" : "ANNUAL RATE (%)"}
              </label>
              <input
                type="number"
                step="0.01"
                value={annualRate}
                onChange={(e) => setAnnualRate(e.target.value)}
                disabled={loanType === "single-payment"}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
          </div>

          {loanType === "single-payment" && (
            <div className="p-3 bg-secondary/30 border border-border rounded space-y-3">
              <div className="font-mono text-xs text-muted-foreground">SINGLE-PAYMENT MODEL INPUTS</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">FLAT INTEREST (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={flatInterestRatePercent}
                    onChange={(e) => setFlatInterestRatePercent(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">DURATION (DAYS)</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={loanDurationDays}
                    onChange={(e) => setLoanDurationDays(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleRunModel()}
                disabled={isModeling}
                className="px-3 py-2 bg-primary text-primary-foreground font-mono text-xs rounded hover:bg-primary/90 disabled:opacity-60"
              >
                {isModeling ? "MODELING..." : "RUN MODEL"}
              </button>

              {modelResult && (
                <div className="p-3 bg-background/40 border border-border rounded">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div className="font-mono text-xs text-foreground">TOTAL DUE: {formatCurrency(modelResult.total_due)}</div>
                    <div className="font-mono text-xs text-foreground">DUE DATE: {formatDate(modelResult.due_date)}</div>
                    <div className="font-mono text-xs text-foreground">EFFECTIVE APR: {modelResult.effective_apr}%</div>
                  </div>
                  {modelResult.high_priority_debt && (
                    <div className="mt-2 font-mono text-xs text-destructive flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      HIGH-PRIORITY DEBT (APR ABOVE 36%)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">START DATE</label>
              <input
                type="date"
                value={startDate}
                disabled={isEdit}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">DUE DATE</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={loanType === "single-payment"}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary disabled:opacity-50"
              />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">STATUS</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Loan["status"])}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              >
                <option value="active">ACTIVE</option>
                <option value="paid">PAID</option>
                <option value="defaulted">DEFAULTED</option>
              </select>
            </div>
          )}

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">NOTES</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary min-h-[80px]"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded font-mono text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border text-muted-foreground font-mono text-sm rounded hover:bg-secondary"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90"
            >
              {isEdit ? "UPDATE" : "CREATE"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PaymentModal({
  loan,
  onClose,
  onSaved,
}: {
  loan: Loan
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const [totalAmount, setTotalAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0])
  const [interestComponent, setInterestComponent] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    try {
      await apiStorage.addLoanPayment({
        loanId: loan.id,
        accountId: loan.accountId,
        totalAmount: Number(totalAmount),
        paymentDate,
        interestComponent: interestComponent ? Number(interestComponent) : undefined,
        note,
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : "FAILED TO RECORD PAYMENT")
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-mono text-sm text-foreground">RECORD PAYMENT</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto">
          <div className="p-3 bg-secondary/40 border border-border rounded">
            <div className="font-mono text-xs text-muted-foreground">LOAN</div>
            <div className="font-mono text-sm text-foreground">{loan.lenderName}</div>
            <div className="font-mono text-xs text-muted-foreground mt-1">
              OUTSTANDING: {formatCurrency(Number(loan.outstandingPrincipal) || 0)}
            </div>
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">TOTAL PAYMENT (P)</label>
            <input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">PAYMENT DATE</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">INTEREST PART (OPTIONAL)</label>
              <input
                type="number"
                step="0.01"
                value={interestComponent}
                onChange={(e) => setInterestComponent(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                placeholder="AUTO IF BLANK"
              />
            </div>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            FOR SINGLE-PAYMENT MODELED LOANS, LEAVE INTEREST BLANK TO AUTO-POST THE FIXED INTEREST AS "LOAN INTEREST" EXPENSE.
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">NOTE</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary uppercase"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded font-mono text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border text-muted-foreground font-mono text-sm rounded hover:bg-secondary"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90"
            >
              RECORD
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
