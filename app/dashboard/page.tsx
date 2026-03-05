"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import * as apiStorage from "@/lib/api-storage"
import type { Account, AccountBalanceSnapshot, Budget, Goal, IncomeClaim, Loan, Transaction } from "@/lib/types"
import { formatCurrency, formatDate, getCurrentMonth, getMonthName } from "@/lib/utils"
import { Wallet, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Clock, Plus, X } from "lucide-react"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

const LOAN_MODEL_PREFIX = "__SINGLE_PAYMENT_MODEL__:"

function getModeledTotalDue(notes?: string): number | null {
  if (!notes) return null
  const firstLine = notes.split("\n")[0] || ""
  if (!firstLine.startsWith(LOAN_MODEL_PREFIX)) return null

  try {
    const parsed = JSON.parse(firstLine.slice(LOAN_MODEL_PREFIX.length)) as { total_due?: unknown; kind?: unknown }
    if (parsed?.kind !== "single-payment") return null
    const totalDue = Number(parsed.total_due)
    return Number.isFinite(totalDue) && totalDue > 0 ? totalDue : null
  } catch {
    return null
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalBalance: 0,
    totalLiabilities: 0,
    netWorth: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    activeGoals: 0,
    budgetHealth: 0,
  })
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([])
  const [budgetAlerts, setBudgetAlerts] = useState<Array<Budget & { percentage: number }>>([])
  const [upcomingObligations, setUpcomingObligations] = useState<Array<{
    id: string
    kind: "loan" | "recurring-expense"
    title: string
    amount: number
    dueDate: string
  }>>([])
  const [accountsIndex, setAccountsIndex] = useState<Account[]>([])
  const [activeLoans, setActiveLoans] = useState<Loan[]>([])
  const [incomeClaims, setIncomeClaims] = useState<IncomeClaim[]>([])
  const [showIncomeClaimModal, setShowIncomeClaimModal] = useState(false)
  const [isSavingIncomeClaim, setIsSavingIncomeClaim] = useState(false)
  const [selectedIncomeClaimId, setSelectedIncomeClaimId] = useState("")
  const [selectedLoanId, setSelectedLoanId] = useState("")
  const [plannedExtraLoanPayment, setPlannedExtraLoanPayment] = useState("")
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [reconciliationSnapshots, setReconciliationSnapshots] = useState<AccountBalanceSnapshot[]>([])
  const [selectedReconciliationAccountId, setSelectedReconciliationAccountId] = useState("")
  const [user, setUserState] = useState<{ username: string } | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      const [userData, accounts, transactions, budgets, goals, loanData, obligations, snapshots, claims] = await Promise.all([
        apiStorage.verifySession(),
        apiStorage.getAccounts(),
        apiStorage.getTransactions(),
        apiStorage.getBudgets(),
        apiStorage.getGoals(),
        apiStorage.getLoans(),
        apiStorage.getUpcomingObligations(90),
        apiStorage.getAccountBalanceSnapshots(),
        apiStorage.getIncomeClaims(),
      ])

      if (userData) {
        apiStorage.setCurrentUser(userData)
        setUserState({ username: userData.username })
      }

      const currentMonth = getCurrentMonth()

      const totalBalance = accounts
        .filter((a) => a.isActive)
        .reduce((sum, a) => sum + (Number(a.balance) || 0), 0)

      const monthlyTransactions = transactions.filter((t) => t.date.startsWith(currentMonth))

      const monthlyIncome = monthlyTransactions
        .filter((t) => t.type === "income" && t.category !== "Loan Disbursement")
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

      const monthlyExpenses = monthlyTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)

      const paidInterestByLoanId = new Map<string, number>()
      loanData.payments.forEach((payment) => {
        paidInterestByLoanId.set(
          payment.loanId,
          (paidInterestByLoanId.get(payment.loanId) || 0) + (Number(payment.interestComponent) || 0),
        )
      })

      const totalLiabilities = loanData.loans
        .filter((loan) => loan.status === "active")
        .reduce((sum, loan) => {
          const outstandingPrincipal = Number(loan.outstandingPrincipal) || 0
          const modeledTotalDue = getModeledTotalDue(loan.notes)

          if (!modeledTotalDue) {
            return sum + outstandingPrincipal
          }

          const principal = Number(loan.principal) || 0
          const modeledInterest = Math.max(0, modeledTotalDue - principal)
          const paidInterest = paidInterestByLoanId.get(loan.id) || 0
          const remainingInterest = Math.max(0, modeledInterest - paidInterest)
          return sum + outstandingPrincipal + remainingInterest
        }, 0)

      const netWorth = totalBalance - totalLiabilities

      const activeGoals = goals.filter((g: Goal) => g.status === "active").length

      const currentBudgets = budgets.filter((b) => b.month === currentMonth)
      const budgetHealth =
        currentBudgets.length > 0
          ? currentBudgets.reduce((sum, b) => {
              const amount = Number(b.amount) || 0
              const spent = Number(b.spent) || 0
              const usage = amount > 0 ? (spent / amount) * 100 : 0
              return sum + (usage <= 100 ? 100 - usage : 0)
            }, 0) / currentBudgets.length
          : 100

      setStats({
        totalBalance,
        totalLiabilities,
        netWorth,
        monthlyIncome,
        monthlyExpenses,
        activeGoals,
        budgetHealth,
      })

      setRecentTransactions(
        [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
      )

      const alerts = currentBudgets
        .map((b) => ({
          ...b,
          percentage: (Number(b.amount) || 0) > 0 ? ((Number(b.spent) || 0) / (Number(b.amount) || 0)) * 100 : 0,
        }))
        .filter((b) => b.percentage >= 80)
        .sort((a, b) => b.percentage - a.percentage)

      setBudgetAlerts(alerts)
      setUpcomingObligations(obligations)
      setAccountsIndex(accounts)
      const nextActiveLoans = loanData.loans.filter((loan) => loan.status === "active")
      setActiveLoans(nextActiveLoans)
      const nextClaims = claims.sort((a, b) => a.expectedPayDate.localeCompare(b.expectedPayDate))
      setIncomeClaims(nextClaims)
      if (!selectedIncomeClaimId) {
        const firstPending = nextClaims.find((claim) => claim.status === "pending")
        if (firstPending) {
          setSelectedIncomeClaimId(firstPending.id)
        }
      }
      if (!selectedLoanId && nextActiveLoans[0]?.id) {
        setSelectedLoanId(nextActiveLoans[0].id)
      }
      setReconciliationSnapshots(snapshots)
      if (!selectedReconciliationAccountId && accounts[0]?.id) {
        setSelectedReconciliationAccountId(accounts[0].id)
      }
    }

    void loadDashboardData()
  }, [selectedReconciliationAccountId, refreshNonce])

  const pendingIncomeClaims = incomeClaims.filter((claim) => claim.status === "pending")
  const pendingIncomeTotal = pendingIncomeClaims.reduce((sum, claim) => sum + (Number(claim.expectedAmount) || 0), 0)
  const selectedIncomeClaim = pendingIncomeClaims.find((claim) => claim.id === selectedIncomeClaimId) || null
  const selectedLoan = activeLoans.find((loan) => loan.id === selectedLoanId) || null
  const extraLoanPaymentAmount = Math.max(0, Number(plannedExtraLoanPayment) || 0)
  const obligationsByPayDate = selectedIncomeClaim
    ? upcomingObligations
        .filter((item) => item.dueDate <= selectedIncomeClaim.expectedPayDate)
        .reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
    : 0
  const projectedAfterObligations = selectedIncomeClaim ? Number(selectedIncomeClaim.expectedAmount) - obligationsByPayDate : 0
  const projectedAfterLoanPlan = projectedAfterObligations - extraLoanPaymentAmount

  const handleAddIncomeClaim = async (payload: {
    organizationName: string
    accountId: string
    hoursWorked: number
    hourlyRate: number
    expectedAmount?: number
    submittedDate: string
    expectedPayDate: string
    notes?: string
  }) => {
    setIsSavingIncomeClaim(true)
    try {
      await apiStorage.addIncomeClaim(payload)
      setShowIncomeClaimModal(false)
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add income claim"
      alert(message)
    } finally {
      setIsSavingIncomeClaim(false)
    }
  }

  const handleMarkClaimPaid = async (claimId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const paymentDateInput = prompt("Enter credited date (YYYY-MM-DD):", today)
    if (paymentDateInput === null) return

    const paymentDate = paymentDateInput.trim()
    if (!paymentDate) return

    const confirmed = confirm("MARK THIS CLAIM AS PAID? This will post an income transaction and increase account balance.")
    if (!confirmed) return

    try {
      await apiStorage.settleIncomeClaim({ claimId, paymentDate })
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to mark claim as paid"
      alert(message)
    }
  }

  const snapshotsForSelectedAccount = reconciliationSnapshots
    .filter((snapshot) => snapshot.accountId === selectedReconciliationAccountId)
    .sort((a, b) => a.snapshotDate.localeCompare(b.snapshotDate))

  const reconciliationChartData = snapshotsForSelectedAccount.map((snapshot) => ({
    date: snapshot.snapshotDate,
    app: Number(snapshot.appCalculatedBalance) || 0,
    actual: Number(snapshot.actualBalance) || 0,
    delta: Number(snapshot.delta) || 0,
  }))

  const latestReconciliation = snapshotsForSelectedAccount[snapshotsForSelectedAccount.length - 1]
  const averageAbsoluteDelta =
    snapshotsForSelectedAccount.length > 0
      ? snapshotsForSelectedAccount.reduce((sum, item) => sum + Math.abs(Number(item.delta) || 0), 0) /
        snapshotsForSelectedAccount.length
      : 0

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-6 p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-mono text-2xl text-foreground mb-1">WELCOME BACK, AGENT {user?.username || ""}</h1>
                <p className="font-mono text-sm text-muted-foreground">
                  FINANCIAL CONTAINMENT STATUS: <span className="text-success">STABLE</span> | REPORT DATE:{" "}
                  {getMonthName(getCurrentMonth()).toUpperCase()}
                </p>
              </div>
              <div className="text-right font-mono text-xs text-muted-foreground">
                <div>SESSION ID: {Math.random().toString(36).substring(2, 10).toUpperCase()}</div>
                <div className="text-primary">â— SECURE CONNECTION</div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-mono text-sm text-foreground">UPCOMING OBLIGATIONS</h2>
              <span className="font-mono text-xs text-muted-foreground">NEXT 90 DAYS</span>
            </div>
            <div className="divide-y divide-border">
              {upcomingObligations.length === 0 ? (
                <div className="p-8 text-center font-mono text-sm text-muted-foreground">NO UPCOMING OBLIGATIONS</div>
              ) : (
                upcomingObligations.slice(0, 8).map((item) => (
                  <div key={item.id} className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                    <div>
                      <div className="font-mono text-sm text-foreground">{item.title}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {item.kind === "loan" ? "LOAN LIABILITY" : "RECURRING EXPENSE"} | DUE {formatDate(item.dueDate)}
                      </div>
                    </div>
                    <div className="font-mono text-sm text-warning">{formatCurrency(item.amount)}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between gap-4">
              <div>
                <h2 className="font-mono text-sm text-foreground">PENDING INCOME CLAIMS</h2>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  SUBMITTED HOURS TRACKED BEFORE CASH IS CREDITED
                </p>
              </div>
              <button
                onClick={() => setShowIncomeClaimModal(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-primary text-primary font-mono text-xs hover:bg-primary/10 transition-colors"
              >
                <Plus className="w-3 h-3" />
                LOG CLAIM
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-border">
              <div className="p-3 bg-secondary/40 border border-border rounded">
                <div className="font-mono text-xs text-muted-foreground">PENDING CLAIMS</div>
                <div className="font-mono text-sm text-foreground">{pendingIncomeClaims.length}</div>
              </div>
              <div className="p-3 bg-secondary/40 border border-border rounded">
                <div className="font-mono text-xs text-muted-foreground">TOTAL EXPECTED</div>
                <div className="font-mono text-sm text-success">{formatCurrency(pendingIncomeTotal)}</div>
              </div>
              <div className="p-3 bg-secondary/40 border border-border rounded">
                <div className="font-mono text-xs text-muted-foreground">NEXT PAY DATE</div>
                <div className="font-mono text-sm text-foreground">
                  {pendingIncomeClaims[0] ? formatDate(pendingIncomeClaims[0].expectedPayDate) : "N/A"}
                </div>
              </div>
            </div>

            <div className="p-4 border-b border-border">
              <h3 className="font-mono text-xs text-muted-foreground mb-3">INCOME-TO-DEBT FORECAST</h3>
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-3">
                <select
                  value={selectedIncomeClaimId}
                  onChange={(e) => setSelectedIncomeClaimId(e.target.value)}
                  className="bg-secondary border border-border rounded px-3 py-2 font-mono text-xs text-foreground"
                >
                  <option value="">SELECT CLAIM</option>
                  {pendingIncomeClaims.map((claim) => (
                    <option key={claim.id} value={claim.id}>
                      {claim.organizationName} | {formatCurrency(claim.expectedAmount)} | {claim.expectedPayDate}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedLoanId}
                  onChange={(e) => setSelectedLoanId(e.target.value)}
                  className="bg-secondary border border-border rounded px-3 py-2 font-mono text-xs text-foreground"
                >
                  <option value="">OPTIONAL: CHOOSE LOAN</option>
                  {activeLoans.map((loan) => (
                    <option key={loan.id} value={loan.id}>
                      {loan.lenderName} | OUTSTANDING {formatCurrency(loan.outstandingPrincipal)}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={plannedExtraLoanPayment}
                  onChange={(e) => setPlannedExtraLoanPayment(e.target.value)}
                  placeholder="EXTRA LOAN PAYMENT"
                  className="bg-secondary border border-border rounded px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground"
                />

                <div className="px-3 py-2 bg-secondary border border-border rounded font-mono text-xs text-muted-foreground">
                  {selectedLoan ? `LOAN PICKED: ${selectedLoan.lenderName}` : "NO LOAN SELECTED"}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3 bg-secondary/40 border border-border rounded">
                  <div className="font-mono text-xs text-muted-foreground">CLAIM EXPECTED</div>
                  <div className="font-mono text-sm text-success">
                    {selectedIncomeClaim ? formatCurrency(selectedIncomeClaim.expectedAmount) : formatCurrency(0)}
                  </div>
                </div>
                <div className="p-3 bg-secondary/40 border border-border rounded">
                  <div className="font-mono text-xs text-muted-foreground">OBLIGATIONS BY PAY DATE</div>
                  <div className="font-mono text-sm text-warning">{formatCurrency(obligationsByPayDate)}</div>
                </div>
                <div className="p-3 bg-secondary/40 border border-border rounded">
                  <div className="font-mono text-xs text-muted-foreground">PROJECTED LEFT AFTER PLAN</div>
                  <div className={`font-mono text-sm ${projectedAfterLoanPlan >= 0 ? "text-primary" : "text-destructive"}`}>
                    {formatCurrency(projectedAfterLoanPlan)}
                  </div>
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {pendingIncomeClaims.length === 0 ? (
                <div className="p-8 text-center font-mono text-sm text-muted-foreground">
                  NO PENDING CLAIMS. LOG A CLAIM WHEN YOU SUBMIT YOUR TIMESHEET.
                </div>
              ) : (
                pendingIncomeClaims.slice(0, 6).map((claim) => (
                  <div key={claim.id} className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors">
                    <div>
                      <div className="font-mono text-sm text-foreground">{claim.organizationName}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        SUBMITTED {formatDate(claim.submittedDate)} | EXPECTED {formatDate(claim.expectedPayDate)} | {claim.hoursWorked}H @ {formatCurrency(claim.hourlyRate)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-sm text-success">{formatCurrency(claim.expectedAmount)}</div>
                      <button
                        onClick={() => void handleMarkClaimPaid(claim.id)}
                        className="px-3 py-1 rounded border border-success/40 text-success font-mono text-xs hover:bg-success/10 transition-colors"
                      >
                        MARK AS PAID
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            <StatCard
              title="TOTAL ASSETS"
              value={formatCurrency(stats.totalBalance)}
              icon={Wallet}
              color="primary"
              subtitle="CASH IN ACTIVE ACCOUNTS"
            />
            <StatCard
              title="TOTAL LIABILITIES"
              value={formatCurrency(stats.totalLiabilities)}
              icon={AlertTriangle}
              color="warning"
              subtitle="LOAN PRINCIPAL + MODELED INTEREST DUE"
            />
            <StatCard
              title="NET WORTH"
              value={formatCurrency(stats.netWorth)}
              icon={stats.netWorth >= 0 ? CheckCircle : AlertTriangle}
              color={stats.netWorth >= 0 ? "success" : "destructive"}
              subtitle="ASSETS - LIABILITIES"
            />
            <StatCard
              title="MONTHLY INCOME"
              value={formatCurrency(stats.monthlyIncome)}
              icon={TrendingUp}
              color="success"
              subtitle="CURRENT PERIOD"
            />
            <StatCard
              title="MONTHLY EXPENSES"
              value={formatCurrency(stats.monthlyExpenses)}
              icon={TrendingDown}
              color="destructive"
              subtitle="CURRENT PERIOD"
            />
            <StatCard
              title="ACTIVE OBJECTIVES"
              value={stats.activeGoals.toString()}
              icon={Target}
              color="accent"
              subtitle="GOALS IN PROGRESS"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-mono text-sm text-foreground">RECENT TRANSACTIONS</h2>
                <span className="font-mono text-xs text-muted-foreground">LAST 5 RECORDS</span>
              </div>
              <div className="divide-y divide-border">
                {recentTransactions.length === 0 ? (
                  <div className="p-8 text-center font-mono text-sm text-muted-foreground">
                    NO TRANSACTIONS RECORDED
                  </div>
                ) : (
                  recentTransactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded flex items-center justify-center ${
                            transaction.type === "income"
                              ? "bg-success/10 text-success"
                              : transaction.type === "expense"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-primary/10 text-primary"
                          }`}
                        >
                          {transaction.type === "income" ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : (
                            <TrendingDown className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-mono text-sm text-foreground">
                            {transaction.description || transaction.category}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">{transaction.category}</div>
                        </div>
                      </div>
                      <div
                        className={`font-mono text-sm ${
                          transaction.type === "income" ? "text-success" : "text-destructive"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-mono text-sm text-foreground">CONTAINMENT ALERTS</h2>
                <span className="font-mono text-xs text-muted-foreground">BUDGET STATUS</span>
              </div>
              <div className="divide-y divide-border">
                {budgetAlerts.length === 0 ? (
                  <div className="p-8 text-center">
                    <CheckCircle className="w-8 h-8 text-success mx-auto mb-2" />
                    <div className="font-mono text-sm text-muted-foreground">ALL BUDGETS WITHIN PARAMETERS</div>
                  </div>
                ) : (
                  budgetAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded flex items-center justify-center ${
                            alert.percentage >= 100
                              ? "bg-destructive/10 text-destructive"
                              : "bg-warning/10 text-warning"
                          }`}
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-mono text-sm text-foreground">{alert.category}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {formatCurrency(alert.spent)} / {formatCurrency(alert.amount)}
                          </div>
                        </div>
                      </div>
                      <div
                        className={`font-mono text-sm ${alert.percentage >= 100 ? "text-destructive" : "text-warning"}`}
                      >
                        {Math.round(alert.percentage)}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between gap-4">
              <div>
                <h2 className="font-mono text-sm text-foreground">RECONCILIATION TRACKING</h2>
                <p className="font-mono text-xs text-muted-foreground mt-1">
                  APP-CALCULATED VS ACTUAL ACCOUNT BALANCE OVER TIME
                </p>
              </div>
              <select
                value={selectedReconciliationAccountId}
                onChange={(e) => setSelectedReconciliationAccountId(e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-2 font-mono text-xs text-foreground"
              >
                {accountsIndex.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {reconciliationChartData.length === 0 ? (
              <div className="p-8 text-center font-mono text-sm text-muted-foreground">
                NO RECONCILIATION SNAPSHOTS YET. LOG ACTUAL ACCOUNT BALANCES FROM ACCOUNT REGISTRY.
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-secondary/40 border border-border rounded">
                    <div className="font-mono text-xs text-muted-foreground">LATEST DRIFT</div>
                    <div className={`font-mono text-sm ${(latestReconciliation?.delta || 0) >= 0 ? "text-warning" : "text-primary"}`}>
                      {formatCurrency(Number(latestReconciliation?.delta || 0))}
                    </div>
                  </div>
                  <div className="p-3 bg-secondary/40 border border-border rounded">
                    <div className="font-mono text-xs text-muted-foreground">AVG ABS DRIFT</div>
                    <div className="font-mono text-sm text-foreground">{formatCurrency(averageAbsoluteDelta)}</div>
                  </div>
                  <div className="p-3 bg-secondary/40 border border-border rounded">
                    <div className="font-mono text-xs text-muted-foreground">SNAPSHOTS</div>
                    <div className="font-mono text-sm text-foreground">{reconciliationChartData.length}</div>
                  </div>
                </div>

                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reconciliationChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value) => formatDate(value)}
                      />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number, key: string) => [formatCurrency(Number(value) || 0), key.toUpperCase()]}
                        labelFormatter={(value) => `DATE: ${formatDate(String(value))}`}
                      />
                      <Line type="monotone" dataKey="app" name="App" stroke="#3b82f6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="actual" name="Actual" stroke="#22c55e" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 p-4 bg-card border border-border rounded-lg">
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-success rounded-full" />
                  <span>SYSTEM STATUS: OPERATIONAL</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3" />
                  <span>LAST SYNC: REAL-TIME</span>
                </div>
              </div>
              <div>SCP FOUNDATION FINANCIAL DIVISION | CLASSIFIED LEVEL 4</div>
            </div>
          </div>
        </main>
      </div>
      {showIncomeClaimModal && (
        <IncomeClaimModal
          accounts={accountsIndex.filter((item) => item.isActive)}
          onClose={() => setShowIncomeClaimModal(false)}
          onSave={handleAddIncomeClaim}
          isSaving={isSavingIncomeClaim}
        />
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ElementType
  color: "primary" | "success" | "destructive" | "accent" | "warning"
  subtitle: string
}) {
  const colorClasses = {
    primary: "text-primary bg-primary/10 border-primary/30",
    success: "text-success bg-success/10 border-success/30",
    destructive: "text-destructive bg-destructive/10 border-destructive/30",
    accent: "text-accent bg-accent/10 border-accent/30",
    warning: "text-warning bg-warning/10 border-warning/30",
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded flex items-center justify-center border ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="font-mono text-xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="font-mono text-xs text-muted-foreground mb-1">{title}</div>
      <div className="font-mono text-2xl text-foreground">{value}</div>
    </div>
  )
}

function IncomeClaimModal({
  accounts,
  onClose,
  onSave,
  isSaving,
}: {
  accounts: Account[]
  onClose: () => void
  onSave: (payload: {
    organizationName: string
    accountId: string
    hoursWorked: number
    hourlyRate: number
    expectedAmount?: number
    submittedDate: string
    expectedPayDate: string
    notes?: string
  }) => Promise<void>
  isSaving: boolean
}) {
  const [organizationName, setOrganizationName] = useState("")
  const [accountId, setAccountId] = useState(accounts[0]?.id || "")
  const [hoursWorked, setHoursWorked] = useState("")
  const [hourlyRate, setHourlyRate] = useState("")
  const [expectedAmount, setExpectedAmount] = useState("")
  const [submittedDate, setSubmittedDate] = useState(new Date().toISOString().split("T")[0])
  const [expectedPayDate, setExpectedPayDate] = useState("")
  const [notes, setNotes] = useState("")

  const autoExpected = (Number(hoursWorked) || 0) * (Number(hourlyRate) || 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationName || !accountId || !hoursWorked || !hourlyRate || !submittedDate || !expectedPayDate) return

    await onSave({
      organizationName,
      accountId,
      hoursWorked: Number(hoursWorked),
      hourlyRate: Number(hourlyRate),
      expectedAmount: expectedAmount ? Number(expectedAmount) : undefined,
      submittedDate,
      expectedPayDate,
      notes: notes || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-card border border-border rounded-lg max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-mono text-sm text-foreground">LOG PENDING INCOME CLAIM</h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-secondary transition-colors"
            aria-label="Close"
            disabled={isSaving}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-73px)]">
          <div>
            <label className="block font-mono text-xs text-muted-foreground mb-2">ORGANIZATION</label>
            <input
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              required
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground"
            />
          </div>

          <div>
            <label className="block font-mono text-xs text-muted-foreground mb-2">TARGET ACCOUNT (ON PAYDAY)</label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs text-muted-foreground mb-2">HOURS WORKED</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={hoursWorked}
                onChange={(e) => setHoursWorked(e.target.value)}
                required
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted-foreground mb-2">HOURLY RATE</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                required
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-muted-foreground mb-2">
              EXPECTED AMOUNT (OPTIONAL OVERRIDE)
            </label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={expectedAmount}
              onChange={(e) => setExpectedAmount(e.target.value)}
              placeholder={`AUTO: ${autoExpected.toFixed(2)}`}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-xs text-muted-foreground mb-2">SUBMITTED DATE</label>
              <input
                type="date"
                value={submittedDate}
                onChange={(e) => setSubmittedDate(e.target.value)}
                required
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground"
              />
            </div>
            <div>
              <label className="block font-mono text-xs text-muted-foreground mb-2">EXPECTED PAY DATE</label>
              <input
                type="date"
                value={expectedPayDate}
                onChange={(e) => setExpectedPayDate(e.target.value)}
                required
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block font-mono text-xs text-muted-foreground mb-2">NOTES (OPTIONAL)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded border border-border font-mono text-xs text-muted-foreground hover:bg-secondary transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded bg-primary text-primary-foreground font-mono text-xs hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {isSaving ? "SAVING..." : "SAVE CLAIM"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
