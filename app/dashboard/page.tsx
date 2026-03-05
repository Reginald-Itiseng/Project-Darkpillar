"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import * as apiStorage from "@/lib/api-storage"
import type { Account, AccountBalanceSnapshot, Budget, Goal, Transaction } from "@/lib/types"
import { formatCurrency, formatDate, getCurrentMonth, getMonthName } from "@/lib/utils"
import { Wallet, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Clock } from "lucide-react"
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
  const [reconciliationSnapshots, setReconciliationSnapshots] = useState<AccountBalanceSnapshot[]>([])
  const [selectedReconciliationAccountId, setSelectedReconciliationAccountId] = useState("")
  const [user, setUserState] = useState<{ username: string } | null>(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      const [userData, accounts, transactions, budgets, goals, loanData, obligations, snapshots] = await Promise.all([
        apiStorage.verifySession(),
        apiStorage.getAccounts(),
        apiStorage.getTransactions(),
        apiStorage.getBudgets(),
        apiStorage.getGoals(),
        apiStorage.getLoans(),
        apiStorage.getUpcomingObligations(30),
        apiStorage.getAccountBalanceSnapshots(),
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
      setUpcomingObligations(obligations.slice(0, 8))
      setAccountsIndex(accounts)
      setReconciliationSnapshots(snapshots)
      if (!selectedReconciliationAccountId && accounts[0]?.id) {
        setSelectedReconciliationAccountId(accounts[0].id)
      }
    }

    void loadDashboardData()
  }, [selectedReconciliationAccountId])

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
              <span className="font-mono text-xs text-muted-foreground">NEXT 30 DAYS</span>
            </div>
            <div className="divide-y divide-border">
              {upcomingObligations.length === 0 ? (
                <div className="p-8 text-center font-mono text-sm text-muted-foreground">NO UPCOMING OBLIGATIONS</div>
              ) : (
                upcomingObligations.map((item) => (
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
