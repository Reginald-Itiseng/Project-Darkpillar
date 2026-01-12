"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { getTransactions, getAccounts, getCategories, addTransaction, addCategory } from "@/lib/storage"
import type { Transaction, Account, Category } from "@/lib/types"
import { formatCurrency, formatDate, getCurrentMonth } from "@/lib/utils"
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight, Filter, X, Search, AlertCircle } from "lucide-react"

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [showModal, setShowModal] = useState(false)
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "transfer">("all")
  const [filterAccount, setFilterAccount] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const loadData = () => {
    setTransactions(getTransactions())
    setAccounts(getAccounts())
    setCategories(getCategories())
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredTransactions = transactions
    .filter((t) => {
      if (filterType !== "all" && t.type !== filterType) return false
      if (filterAccount !== "all" && t.accountId !== filterAccount) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return t.description?.toLowerCase().includes(query) || t.category.toLowerCase().includes(query)
      }
      return true
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  const currentMonth = getCurrentMonth()
  const monthlyIncome = transactions
    .filter((t) => t.type === "income" && t.date.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.amount, 0)
  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense" && t.date.startsWith(currentMonth))
    .reduce((sum, t) => sum + t.amount, 0)
  const netFlow = monthlyIncome - monthlyExpenses

  const getAccountName = (id: string) => {
    return accounts.find((a) => a.id === id)?.name || "UNKNOWN"
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
              <h1 className="font-mono text-2xl text-foreground">TRANSACTION LOG</h1>
              <p className="font-mono text-sm text-muted-foreground">FINANCIAL FLOW RECORDS</p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              NEW ENTRY
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-success/10 border border-success/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-success" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">MONTHLY INCOME</div>
              </div>
              <div className="font-mono text-2xl text-success">+{formatCurrency(monthlyIncome)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-destructive/10 border border-destructive/30 flex items-center justify-center">
                  <TrendingDown className="w-5 h-5 text-destructive" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">MONTHLY EXPENSES</div>
              </div>
              <div className="font-mono text-2xl text-destructive">-{formatCurrency(monthlyExpenses)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`w-10 h-10 rounded flex items-center justify-center ${
                    netFlow >= 0
                      ? "bg-success/10 border border-success/30"
                      : "bg-destructive/10 border border-destructive/30"
                  }`}
                >
                  <ArrowLeftRight className={`w-5 h-5 ${netFlow >= 0 ? "text-success" : "text-destructive"}`} />
                </div>
                <div className="font-mono text-xs text-muted-foreground">NET FLOW</div>
              </div>
              <div className={`font-mono text-2xl ${netFlow >= 0 ? "text-success" : "text-destructive"}`}>
                {netFlow >= 0 ? "+" : ""}
                {formatCurrency(netFlow)}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="SEARCH RECORDS..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-secondary border border-border rounded pl-10 pr-4 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as typeof filterType)}
                  className="bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
                >
                  <option value="all">ALL TYPES</option>
                  <option value="income">INCOME</option>
                  <option value="expense">EXPENSE</option>
                  <option value="transfer">TRANSFER</option>
                </select>
              </div>

              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary appearance-none cursor-pointer"
              >
                <option value="all">ALL ACCOUNTS</option>
                {accounts
                  .filter((a) => a.isActive)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h2 className="font-mono text-sm text-foreground">TRANSACTION RECORDS</h2>
              <span className="font-mono text-xs text-muted-foreground">{filteredTransactions.length} ENTRIES</span>
            </div>

            {filteredTransactions.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <div className="font-mono text-sm text-muted-foreground">NO TRANSACTIONS FOUND</div>
                <div className="font-mono text-xs text-muted-foreground mt-1">
                  {transactions.length === 0 ? "CREATE YOUR FIRST TRANSACTION TO BEGIN" : "TRY ADJUSTING YOUR FILTERS"}
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="p-4 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded flex items-center justify-center ${
                          transaction.type === "income"
                            ? "bg-success/10 text-success"
                            : transaction.type === "expense"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary/10 text-primary"
                        }`}
                      >
                        {transaction.type === "income" ? (
                          <TrendingUp className="w-5 h-5" />
                        ) : transaction.type === "expense" ? (
                          <TrendingDown className="w-5 h-5" />
                        ) : (
                          <ArrowLeftRight className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <div className="font-mono text-sm text-foreground">
                          {transaction.description || transaction.category}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                          <span>{transaction.category}</span>
                          <span>•</span>
                          <span>{getAccountName(transaction.accountId)}</span>
                          {transaction.type === "transfer" && transaction.toAccountId && (
                            <>
                              <span>→</span>
                              <span>{getAccountName(transaction.toAccountId)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-mono text-sm ${
                          transaction.type === "income"
                            ? "text-success"
                            : transaction.type === "expense"
                              ? "text-destructive"
                              : "text-primary"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
                        {formatCurrency(transaction.amount)}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{formatDate(transaction.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Transaction Modal */}
      {showModal && (
        <TransactionModal
          accounts={accounts.filter((a) => a.isActive)}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={() => {
            loadData()
            setShowModal(false)
          }}
          onAddCategory={(category) => {
            addCategory(category)
            loadData()
          }}
        />
      )}
    </div>
  )
}

function TransactionModal({
  accounts,
  categories,
  onClose,
  onSave,
  onAddCategory,
}: {
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSave: () => void
  onAddCategory: (category: { name: string; type: "income" | "expense" }) => void
}) {
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState("")
  const [description, setDescription] = useState("")
  const [accountId, setAccountId] = useState(accounts[0]?.id || "")
  const [toAccountId, setToAccountId] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [error, setError] = useState("")
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState("")

  const filteredCategories = categories.filter((c) => (type === "transfer" ? false : c.type === type))

  useEffect(() => {
    if (filteredCategories.length > 0 && !category) {
      setCategory(filteredCategories[0].name)
    }
  }, [type, filteredCategories, category])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!amount || Number.parseFloat(amount) <= 0) {
      setError("VALID AMOUNT REQUIRED")
      return
    }

    if (!accountId) {
      setError("SOURCE ACCOUNT REQUIRED")
      return
    }

    if (type === "transfer" && !toAccountId) {
      setError("DESTINATION ACCOUNT REQUIRED")
      return
    }

    if (type === "transfer" && accountId === toAccountId) {
      setError("CANNOT TRANSFER TO SAME ACCOUNT")
      return
    }

    addTransaction({
      type,
      amount: Number.parseFloat(amount),
      category: type === "transfer" ? "Transfer" : category,
      description: description.trim().toUpperCase(),
      accountId,
      toAccountId: type === "transfer" ? toAccountId : undefined,
      date,
    })

    onSave()
  }

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      onAddCategory({
        name: newCategoryName.trim().toUpperCase(),
        type: type as "income" | "expense",
      })
      setCategory(newCategoryName.trim().toUpperCase())
      setNewCategoryName("")
      setShowNewCategory(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-mono text-sm text-foreground">NEW TRANSACTION ENTRY</h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Type Selection */}
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">TRANSACTION TYPE</label>
            <div className="grid grid-cols-3 gap-2">
              {(["income", "expense", "transfer"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setType(t)
                    setCategory("")
                  }}
                  className={`p-3 rounded border font-mono text-xs transition-colors ${
                    type === t
                      ? t === "income"
                        ? "bg-success/10 border-success text-success"
                        : t === "expense"
                          ? "bg-destructive/10 border-destructive text-destructive"
                          : "bg-primary/10 border-primary text-primary"
                      : "bg-secondary border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {t === "income" ? (
                    <TrendingUp className="w-5 h-5 mx-auto mb-1" />
                  ) : t === "expense" ? (
                    <TrendingDown className="w-5 h-5 mx-auto mb-1" />
                  ) : (
                    <ArrowLeftRight className="w-5 h-5 mx-auto mb-1" />
                  )}
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">AMOUNT (P)</label>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              placeholder="0.00"
            />
          </div>

          {/* Account Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">
                {type === "transfer" ? "FROM ACCOUNT" : "ACCOUNT"}
              </label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            {type === "transfer" ? (
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-2">TO ACCOUNT</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                >
                  <option value="">SELECT...</option>
                  {accounts
                    .filter((a) => a.id !== accountId)
                    .map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-2">DATE</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {type === "transfer" && (
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">DATE</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              />
            </div>
          )}

          {/* Category (not for transfers) */}
          {type !== "transfer" && (
            <div>
              <label className="font-mono text-xs text-muted-foreground block mb-2">CATEGORY</label>
              {showNewCategory ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary uppercase"
                    placeholder="NEW CATEGORY NAME"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="px-3 py-2 bg-primary text-primary-foreground font-mono text-xs rounded hover:bg-primary/90"
                  >
                    ADD
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCategory(false)}
                    className="px-3 py-2 border border-border text-muted-foreground font-mono text-xs rounded hover:bg-secondary"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    {filteredCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewCategory(true)}
                    className="px-3 py-2 border border-border text-muted-foreground font-mono text-xs rounded hover:bg-secondary hover:text-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">DESCRIPTION (OPTIONAL)</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary uppercase"
              placeholder="TRANSACTION DETAILS..."
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
              RECORD ENTRY
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
