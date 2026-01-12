"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { getAccounts, getTransactions, getBudgets, getGoals, getUser } from "@/lib/storage"
import { formatCurrency, getCurrentMonth, getMonthName } from "@/lib/utils"
import { Wallet, TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle, Clock } from "lucide-react"

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    activeGoals: 0,
    budgetHealth: 0,
  })
  const [recentTransactions, setRecentTransactions] = useState<any[]>([])
  const [budgetAlerts, setBudgetAlerts] = useState<any[]>([])
  const [user, setUserState] = useState<{ username: string } | null>(null)

  useEffect(() => {
    const userData = getUser()
    if (userData) {
      setUserState({ username: userData.username })
    }

    const accounts = getAccounts()
    const transactions = getTransactions()
    const budgets = getBudgets()
    const goals = getGoals()
    const currentMonth = getCurrentMonth()

    // Calculate stats
    const totalBalance = accounts.filter((a) => a.isActive).reduce((sum, a) => sum + a.balance, 0)

    const monthlyTransactions = transactions.filter((t) => t.date.startsWith(currentMonth))

    const monthlyIncome = monthlyTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)

    const monthlyExpenses = monthlyTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0)

    const activeGoals = goals.filter((g) => g.status === "active").length

    const currentBudgets = budgets.filter((b) => b.month === currentMonth)
    const budgetHealth =
      currentBudgets.length > 0
        ? currentBudgets.reduce((sum, b) => {
            const usage = b.amount > 0 ? (b.spent / b.amount) * 100 : 0
            return sum + (usage <= 100 ? 100 - usage : 0)
          }, 0) / currentBudgets.length
        : 100

    setStats({
      totalBalance,
      monthlyIncome,
      monthlyExpenses,
      activeGoals,
      budgetHealth,
    })

    // Recent transactions
    setRecentTransactions(
      transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    )

    // Budget alerts
    const alerts = currentBudgets
      .map((b) => ({
        ...b,
        percentage: b.amount > 0 ? (b.spent / b.amount) * 100 : 0,
      }))
      .filter((b) => b.percentage >= 80)
      .sort((a, b) => b.percentage - a.percentage)

    setBudgetAlerts(alerts)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          {/* Welcome Banner */}
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
                <div className="text-primary">● SECURE CONNECTION</div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="TOTAL ASSETS"
              value={formatCurrency(stats.totalBalance)}
              icon={Wallet}
              color="primary"
              subtitle="ALL ACTIVE ACCOUNTS"
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
            {/* Recent Transactions */}
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

            {/* Budget Alerts */}
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

          {/* System Status */}
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
  color: "primary" | "success" | "destructive" | "accent"
  subtitle: string
}) {
  const colorClasses = {
    primary: "text-primary bg-primary/10 border-primary/30",
    success: "text-success bg-success/10 border-success/30",
    destructive: "text-destructive bg-destructive/10 border-destructive/30",
    accent: "text-accent bg-accent/10 border-accent/30",
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
