"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { getBudgets, getCategories, addBudget, updateBudget, deleteBudget, getTransactions } from "@/lib/storage"
import type { Budget, Category } from "@/lib/types"
import { formatCurrency, getCurrentMonth, getMonthName } from "@/lib/utils"
import {
  Plus,
  PiggyBank,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  X,
  Edit2,
  Trash2,
  TrendingUp,
} from "lucide-react"

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const loadData = () => {
    setBudgets(getBudgets())
    setCategories(getCategories())
  }

  useEffect(() => {
    loadData()
    recalculateSpent()
  }, [])

  // Recalculate spent amounts based on transactions
  const recalculateSpent = () => {
    const transactions = getTransactions()
    const allBudgets = getBudgets()

    const updatedBudgets = allBudgets.map((budget) => {
      const spent = transactions
        .filter((t) => t.type === "expense" && t.category === budget.category && t.date.startsWith(budget.month))
        .reduce((sum, t) => sum + t.amount, 0)

      if (spent !== budget.spent) {
        updateBudget(budget.id, { spent })
        return { ...budget, spent }
      }
      return budget
    })

    setBudgets(updatedBudgets)
  }

  const monthBudgets = budgets.filter((b) => b.month === selectedMonth)
  const totalBudgeted = monthBudgets.reduce((sum, b) => sum + b.amount, 0)
  const totalSpent = monthBudgets.reduce((sum, b) => sum + b.spent, 0)
  const remaining = totalBudgeted - totalSpent
  const overallPercentage = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0

  const navigateMonth = (direction: "prev" | "next") => {
    const [year, month] = selectedMonth.split("-").map(Number)
    const date = new Date(year, month - 1 + (direction === "next" ? 1 : -1))
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`)
  }

  const handleDelete = (id: string) => {
    if (confirm("CONFIRM BUDGET DELETION?")) {
      deleteBudget(id)
      loadData()
    }
  }

  const expenseCategories = categories.filter((c) => c.type === "expense")
  const usedCategories = monthBudgets.map((b) => b.category)
  const availableCategories = expenseCategories.filter((c) => !usedCategories.includes(c.name))

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-mono text-2xl text-foreground">BUDGET ALLOCATION</h1>
              <p className="font-mono text-sm text-muted-foreground">MONTHLY CONTAINMENT LIMITS</p>
            </div>
            <button
              onClick={() => {
                setEditingBudget(null)
                setShowModal(true)
              }}
              disabled={availableCategories.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              NEW BUDGET
            </button>
          </div>

          {/* Month Navigator */}
          <div className="flex items-center justify-center gap-4 mb-6">
            <button onClick={() => navigateMonth("prev")} className="p-2 hover:bg-secondary rounded transition-colors">
              <ChevronLeft className="w-5 h-5 text-muted-foreground" />
            </button>
            <div className="font-mono text-lg text-foreground min-w-[200px] text-center">
              {getMonthName(selectedMonth).toUpperCase()}
            </div>
            <button onClick={() => navigateMonth("next")} className="p-2 hover:bg-secondary rounded transition-colors">
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <PiggyBank className="w-5 h-5 text-primary" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">TOTAL BUDGETED</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{formatCurrency(totalBudgeted)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-destructive" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">TOTAL SPENT</div>
              </div>
              <div className="font-mono text-2xl text-destructive">{formatCurrency(totalSpent)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center ${
                    remaining >= 0
                      ? "bg-success/10 border border-success/30"
                      : "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  {remaining >= 0 ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  )}
                </div>
                <div className="font-mono text-xs text-muted-foreground">REMAINING</div>
              </div>
              <div className={`font-mono text-2xl ${remaining >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(Math.abs(remaining))}
              </div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center ${
                    overallPercentage < 80
                      ? "bg-success/10 border border-success/30"
                      : overallPercentage < 100
                        ? "bg-warning/10 border border-warning/30"
                        : "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  <span
                    className={`font-mono text-xs font-bold ${
                      overallPercentage < 80
                        ? "text-success"
                        : overallPercentage < 100
                          ? "text-warning"
                          : "text-destructive"
                    }`}
                  >
                    %
                  </span>
                </div>
                <div className="font-mono text-xs text-muted-foreground">UTILIZATION</div>
              </div>
              <div
                className={`font-mono text-2xl ${
                  overallPercentage < 80
                    ? "text-success"
                    : overallPercentage < 100
                      ? "text-warning"
                      : "text-destructive"
                }`}
              >
                {Math.round(overallPercentage)}%
              </div>
            </div>
          </div>

          {/* Budget List */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-mono text-sm text-foreground">BUDGET ALLOCATIONS</h2>
              <span className="font-mono text-xs text-muted-foreground">{monthBudgets.length} CATEGORIES</span>
            </div>

            {monthBudgets.length === 0 ? (
              <div className="p-12 text-center">
                <PiggyBank className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <div className="font-mono text-sm text-muted-foreground">NO BUDGETS FOR THIS MONTH</div>
                <div className="font-mono text-xs text-muted-foreground mt-1">
                  CREATE BUDGETS TO TRACK YOUR SPENDING
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {monthBudgets.map((budget) => {
                  const percentage = budget.amount > 0 ? (budget.spent / budget.amount) * 100 : 0
                  const status = percentage >= 100 ? "exceeded" : percentage >= 80 ? "warning" : "safe"

                  return (
                    <div key={budget.id} className="p-4 hover:bg-secondary/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded flex items-center justify-center ${
                              status === "exceeded"
                                ? "bg-destructive/10 text-destructive"
                                : status === "warning"
                                  ? "bg-warning/10 text-warning"
                                  : "bg-success/10 text-success"
                            }`}
                          >
                            {status === "exceeded" ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : status === "warning" ? (
                              <AlertTriangle className="w-4 h-4" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="font-mono text-sm text-foreground">{budget.category}</div>
                            <div className="font-mono text-xs text-muted-foreground">
                              {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-mono text-sm ${
                              status === "exceeded"
                                ? "text-destructive"
                                : status === "warning"
                                  ? "text-warning"
                                  : "text-success"
                            }`}
                          >
                            {Math.round(percentage)}%
                          </span>
                          <button
                            onClick={() => {
                              setEditingBudget(budget)
                              setShowModal(true)
                            }}
                            className="p-1.5 hover:bg-secondary rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(budget.id)}
                            className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>
                      {/* Progress Bar */}
                      <div className="h-2 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            status === "exceeded"
                              ? "bg-destructive"
                              : status === "warning"
                                ? "bg-warning"
                                : "bg-success"
                          }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      {percentage > 100 && (
                        <div className="mt-2 font-mono text-xs text-destructive">
                          OVERSPENT BY {formatCurrency(budget.spent - budget.amount)}
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

      {/* Budget Modal */}
      {showModal && (
        <BudgetModal
          budget={editingBudget}
          month={selectedMonth}
          categories={editingBudget ? expenseCategories : availableCategories}
          onClose={() => {
            setShowModal(false)
            setEditingBudget(null)
          }}
          onSave={() => {
            loadData()
            setShowModal(false)
            setEditingBudget(null)
          }}
        />
      )}
    </div>
  )
}

function BudgetModal({
  budget,
  month,
  categories,
  onClose,
  onSave,
}: {
  budget: Budget | null
  month: string
  categories: Category[]
  onClose: () => void
  onSave: () => void
}) {
  const [category, setCategory] = useState(budget?.category || categories[0]?.name || "")
  const [amount, setAmount] = useState(budget?.amount?.toString() || "")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!category) {
      setError("CATEGORY REQUIRED")
      return
    }

    if (!amount || Number.parseFloat(amount) <= 0) {
      setError("VALID AMOUNT REQUIRED")
      return
    }

    if (budget) {
      updateBudget(budget.id, { amount: Number.parseFloat(amount) })
    } else {
      addBudget({
        category,
        amount: Number.parseFloat(amount),
        month,
      })
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-mono text-sm text-foreground">{budget ? "MODIFY BUDGET" : "NEW BUDGET ALLOCATION"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 bg-secondary/50 rounded border border-border font-mono text-xs text-muted-foreground">
            PERIOD: {getMonthName(month).toUpperCase()}
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">CATEGORY</label>
            {budget ? (
              <div className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground">
                {budget.category}
              </div>
            ) : (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">BUDGET AMOUNT (P)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              placeholder="0.00"
            />
          </div>

          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded font-mono text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border text-muted-foreground font-mono text-sm rounded hover:bg-secondary transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 transition-colors"
            >
              {budget ? "UPDATE" : "CREATE"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
