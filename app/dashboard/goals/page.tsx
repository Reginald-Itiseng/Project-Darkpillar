"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { getGoals, addGoal, updateGoal, deleteGoal } from "@/lib/storage"
import type { Goal } from "@/lib/types"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Plus, Target, X, Edit2, Trash2, CheckCircle, Pause, Play, AlertTriangle, Clock, Flag } from "lucide-react"

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [showContributeModal, setShowContributeModal] = useState<Goal | null>(null)
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "paused">("all")

  const loadGoals = () => {
    setGoals(getGoals())
  }

  useEffect(() => {
    loadGoals()
  }, [])

  const filteredGoals = goals.filter((g) => {
    if (filter === "all") return true
    return g.status === filter
  })

  const activeGoals = goals.filter((g) => g.status === "active")
  const completedGoals = goals.filter((g) => g.status === "completed")
  const totalTargetAmount = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0)
  const totalCurrentAmount = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0)

  const handleDelete = (id: string) => {
    if (confirm("CONFIRM GOAL DELETION?")) {
      deleteGoal(id)
      loadGoals()
    }
  }

  const handleToggleStatus = (goal: Goal) => {
    const newStatus = goal.status === "paused" ? "active" : "paused"
    updateGoal(goal.id, { status: newStatus })
    loadGoals()
  }

  const handleComplete = (goal: Goal) => {
    updateGoal(goal.id, { status: "completed", currentAmount: goal.targetAmount })
    loadGoals()
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="font-mono text-2xl text-foreground">MISSION OBJECTIVES</h1>
              <p className="font-mono text-sm text-muted-foreground">FINANCIAL GOAL TRACKING</p>
            </div>
            <button
              onClick={() => {
                setEditingGoal(null)
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              NEW OBJECTIVE
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">ACTIVE OBJECTIVES</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{activeGoals.length}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-success/10 border border-success/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">COMPLETED</div>
              </div>
              <div className="font-mono text-2xl text-success">{completedGoals.length}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-accent/10 border border-accent/30 flex items-center justify-center">
                  <Flag className="w-5 h-5 text-accent" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">TARGET TOTAL</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{formatCurrency(totalTargetAmount)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-warning/10 border border-warning/30 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-warning" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">PROGRESS</div>
              </div>
              <div className="font-mono text-2xl text-warning">{formatCurrency(totalCurrentAmount)}</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 mb-6">
            {(["all", "active", "completed", "paused"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded font-mono text-xs transition-colors ${
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Goals Grid */}
          {filteredGoals.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-12 text-center">
              <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <div className="font-mono text-sm text-muted-foreground">NO OBJECTIVES FOUND</div>
              <div className="font-mono text-xs text-muted-foreground mt-1">
                {goals.length === 0 ? "CREATE YOUR FIRST FINANCIAL GOAL" : "TRY A DIFFERENT FILTER"}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGoals.map((goal) => {
                const percentage = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
                const daysRemaining = Math.ceil(
                  (new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                )
                const isOverdue = daysRemaining < 0 && goal.status === "active"

                const priorityColors = {
                  low: "text-muted-foreground bg-muted/20 border-muted/30",
                  medium: "text-primary bg-primary/10 border-primary/30",
                  high: "text-warning bg-warning/10 border-warning/30",
                  critical: "text-destructive bg-destructive/10 border-destructive/30",
                }

                return (
                  <div
                    key={goal.id}
                    className={`bg-card border rounded-lg overflow-hidden transition-all ${
                      goal.status === "completed"
                        ? "border-success/50"
                        : goal.status === "paused"
                          ? "border-border/50 opacity-60"
                          : isOverdue
                            ? "border-destructive/50"
                            : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="font-mono text-sm text-foreground mb-1">{goal.name}</div>
                          <div
                            className={`inline-flex px-2 py-0.5 rounded border text-xs font-mono ${priorityColors[goal.priority]}`}
                          >
                            {goal.priority.toUpperCase()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {goal.status === "active" && (
                            <>
                              <button
                                onClick={() => setShowContributeModal(goal)}
                                className="p-1.5 hover:bg-success/10 rounded transition-colors"
                                title="Add funds"
                              >
                                <Plus className="w-3.5 h-3.5 text-success" />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(goal)}
                                className="p-1.5 hover:bg-warning/10 rounded transition-colors"
                                title="Pause"
                              >
                                <Pause className="w-3.5 h-3.5 text-warning" />
                              </button>
                            </>
                          )}
                          {goal.status === "paused" && (
                            <button
                              onClick={() => handleToggleStatus(goal)}
                              className="p-1.5 hover:bg-success/10 rounded transition-colors"
                              title="Resume"
                            >
                              <Play className="w-3.5 h-3.5 text-success" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setEditingGoal(goal)
                              setShowModal(true)
                            }}
                            className="p-1.5 hover:bg-secondary rounded transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </button>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-xs text-muted-foreground">PROGRESS</span>
                          <span
                            className={`font-mono text-xs ${
                              goal.status === "completed"
                                ? "text-success"
                                : percentage >= 75
                                  ? "text-success"
                                  : percentage >= 50
                                    ? "text-warning"
                                    : "text-muted-foreground"
                            }`}
                          >
                            {Math.round(percentage)}%
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              goal.status === "completed"
                                ? "bg-success"
                                : percentage >= 75
                                  ? "bg-success"
                                  : percentage >= 50
                                    ? "bg-warning"
                                    : "bg-primary"
                            }`}
                            style={{ width: `${Math.min(percentage, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Amounts */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="font-mono text-lg text-foreground">{formatCurrency(goal.currentAmount)}</div>
                          <div className="font-mono text-xs text-muted-foreground">
                            of {formatCurrency(goal.targetAmount)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm text-muted-foreground">
                            {formatCurrency(goal.targetAmount - goal.currentAmount)}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">REMAINING</div>
                        </div>
                      </div>

                      {/* Deadline */}
                      <div className="pt-3 border-t border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-mono text-xs text-muted-foreground">{formatDate(goal.deadline)}</span>
                        </div>
                        {goal.status === "completed" ? (
                          <span className="font-mono text-xs text-success flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" />
                            COMPLETED
                          </span>
                        ) : goal.status === "paused" ? (
                          <span className="font-mono text-xs text-muted-foreground flex items-center gap-1">
                            <Pause className="w-3.5 h-3.5" />
                            PAUSED
                          </span>
                        ) : isOverdue ? (
                          <span className="font-mono text-xs text-destructive flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            OVERDUE
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-foreground">{daysRemaining} DAYS LEFT</span>
                        )}
                      </div>

                      {/* Complete Button */}
                      {goal.status === "active" && percentage >= 100 && (
                        <button
                          onClick={() => handleComplete(goal)}
                          className="w-full mt-3 px-4 py-2 bg-success text-success-foreground font-mono text-xs rounded hover:bg-success/90 transition-colors flex items-center justify-center gap-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          MARK AS COMPLETED
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {/* Goal Modal */}
      {showModal && (
        <GoalModal
          goal={editingGoal}
          onClose={() => {
            setShowModal(false)
            setEditingGoal(null)
          }}
          onSave={() => {
            loadGoals()
            setShowModal(false)
            setEditingGoal(null)
          }}
        />
      )}

      {/* Contribute Modal */}
      {showContributeModal && (
        <ContributeModal
          goal={showContributeModal}
          onClose={() => setShowContributeModal(null)}
          onSave={() => {
            loadGoals()
            setShowContributeModal(null)
          }}
        />
      )}
    </div>
  )
}

function GoalModal({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(goal?.name || "")
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount?.toString() || "")
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount?.toString() || "0")
  const [deadline, setDeadline] = useState(goal?.deadline || "")
  const [priority, setPriority] = useState<Goal["priority"]>(goal?.priority || "medium")
  const [error, setError] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("OBJECTIVE NAME REQUIRED")
      return
    }

    if (!targetAmount || Number.parseFloat(targetAmount) <= 0) {
      setError("VALID TARGET AMOUNT REQUIRED")
      return
    }

    if (!deadline) {
      setError("DEADLINE REQUIRED")
      return
    }

    const goalData = {
      name: name.trim().toUpperCase(),
      targetAmount: Number.parseFloat(targetAmount),
      currentAmount: Number.parseFloat(currentAmount) || 0,
      deadline,
      priority,
      status: goal?.status || ("active" as const),
    }

    if (goal) {
      updateGoal(goal.id, goalData)
    } else {
      addGoal(goalData)
    }

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-mono text-sm text-foreground">{goal ? "MODIFY OBJECTIVE" : "NEW MISSION OBJECTIVE"}</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">OBJECTIVE NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary uppercase"
              placeholder="E.G., EMERGENCY FUND"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">TARGET (P)</label>
              <input
                type="number"
                step="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                placeholder="10000.00"
              />
            </div>
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">CURRENT (P)</label>
              <input
                type="number"
                step="0.01"
                value={currentAmount}
                onChange={(e) => setCurrentAmount(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">DEADLINE</label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">PRIORITY LEVEL</label>
            <div className="grid grid-cols-4 gap-2">
              {(["low", "medium", "high", "critical"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPriority(p)}
                  className={`p-2 rounded border font-mono text-xs transition-colors ${
                    priority === p
                      ? p === "low"
                        ? "bg-muted/20 border-muted text-foreground"
                        : p === "medium"
                          ? "bg-primary/10 border-primary text-primary"
                          : p === "high"
                            ? "bg-warning/10 border-warning text-warning"
                            : "bg-destructive/10 border-destructive text-destructive"
                      : "bg-secondary border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
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
              {goal ? "UPDATE" : "CREATE"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ContributeModal({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal
  onClose: () => void
  onSave: () => void
}) {
  const [amount, setAmount] = useState("")
  const [error, setError] = useState("")

  const remaining = goal.targetAmount - goal.currentAmount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!amount || Number.parseFloat(amount) <= 0) {
      setError("VALID AMOUNT REQUIRED")
      return
    }

    const newAmount = goal.currentAmount + Number.parseFloat(amount)
    const status = newAmount >= goal.targetAmount ? "completed" : goal.status

    updateGoal(goal.id, {
      currentAmount: Math.min(newAmount, goal.targetAmount),
      status,
    })

    onSave()
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-mono text-sm text-foreground">ADD FUNDS</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 bg-secondary/50 rounded border border-border">
            <div className="font-mono text-xs text-muted-foreground mb-1">OBJECTIVE</div>
            <div className="font-mono text-sm text-foreground">{goal.name}</div>
            <div className="font-mono text-xs text-muted-foreground mt-2">
              REMAINING: <span className="text-primary">{formatCurrency(remaining)}</span>
            </div>
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">CONTRIBUTION (P)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAmount((remaining / 4).toFixed(2))}
              className="flex-1 px-2 py-1 border border-border text-muted-foreground font-mono text-xs rounded hover:bg-secondary"
            >
              25%
            </button>
            <button
              type="button"
              onClick={() => setAmount((remaining / 2).toFixed(2))}
              className="flex-1 px-2 py-1 border border-border text-muted-foreground font-mono text-xs rounded hover:bg-secondary"
            >
              50%
            </button>
            <button
              type="button"
              onClick={() => setAmount(remaining.toFixed(2))}
              className="flex-1 px-2 py-1 border border-border text-muted-foreground font-mono text-xs rounded hover:bg-secondary"
            >
              100%
            </button>
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
              className="flex-1 px-4 py-2 border border-border text-muted-foreground font-mono text-sm rounded hover:bg-secondary transition-colors"
            >
              CANCEL
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-success text-success-foreground font-mono text-sm rounded hover:bg-success/90 transition-colors"
            >
              ADD FUNDS
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
