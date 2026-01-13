"use client"

import type React from "react"
import { useEffect, useState, useTransition } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { getAccounts, addAccount, updateAccount } from "@/app/actions/accounts"
import type { Account } from "@/lib/types"
import { formatCurrency, formatDate, calculateInterest } from "@/lib/utils"
import {
  Plus,
  Wallet,
  PiggyBank,
  MoreVertical,
  Edit2,
  Power,
  TrendingUp,
  Calendar,
  Percent,
  X,
  Check,
  AlertCircle,
} from "lucide-react"

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [showMenu, setShowMenu] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const loadAccounts = async () => {
    const data = await getAccounts()
    setAccounts(data)
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const activeAccounts = accounts.filter((a) => a.isActive)
  const inactiveAccounts = accounts.filter((a) => !a.isActive)
  const totalBalance = activeAccounts.reduce((sum, a) => sum + a.balance, 0)

  const handleToggleActive = async (account: Account) => {
    startTransition(async () => {
      await updateAccount(account.id, { isActive: !account.isActive })
      await loadAccounts()
      setShowMenu(null)
    })
  }

  const handleEdit = (account: Account) => {
    setEditingAccount(account)
    setShowModal(true)
    setShowMenu(null)
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
              <h1 className="font-mono text-2xl text-foreground">ACCOUNT REGISTRY</h1>
              <p className="font-mono text-sm text-muted-foreground">MANAGE FINANCIAL CONTAINMENT UNITS</p>
            </div>
            <button
              onClick={() => {
                setEditingAccount(null)
                setShowModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              NEW ACCOUNT
            </button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-primary" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">TOTAL ASSETS</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{formatCurrency(totalBalance)}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-success/10 border border-success/30 flex items-center justify-center">
                  <Check className="w-5 h-5 text-success" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">ACTIVE ACCOUNTS</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{activeAccounts.length}</div>
            </div>
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded bg-muted/10 border border-muted/30 flex items-center justify-center">
                  <Power className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="font-mono text-xs text-muted-foreground">INACTIVE ACCOUNTS</div>
              </div>
              <div className="font-mono text-2xl text-foreground">{inactiveAccounts.length}</div>
            </div>
          </div>

          {/* Active Accounts */}
          <div className="mb-6">
            <h2 className="font-mono text-sm text-muted-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-success rounded-full" />
              ACTIVE CONTAINMENT UNITS
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {activeAccounts.length === 0 ? (
                <div className="col-span-full bg-card border border-border rounded-lg p-8 text-center">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <div className="font-mono text-sm text-muted-foreground">NO ACTIVE ACCOUNTS</div>
                  <div className="font-mono text-xs text-muted-foreground mt-1">
                    CREATE AN ACCOUNT TO BEGIN TRACKING
                  </div>
                </div>
              ) : (
                activeAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    showMenu={showMenu === account.id}
                    onMenuToggle={() => setShowMenu(showMenu === account.id ? null : account.id)}
                    onEdit={() => handleEdit(account)}
                    onToggleActive={() => handleToggleActive(account)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Inactive Accounts */}
          {inactiveAccounts.length > 0 && (
            <div>
              <h2 className="font-mono text-sm text-muted-foreground mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-muted-foreground rounded-full" />
                DEACTIVATED UNITS
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    showMenu={showMenu === account.id}
                    onMenuToggle={() => setShowMenu(showMenu === account.id ? null : account.id)}
                    onEdit={() => handleEdit(account)}
                    onToggleActive={() => handleToggleActive(account)}
                  />
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Account Modal */}
      {showModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setShowModal(false)
            setEditingAccount(null)
          }}
          onSave={async () => {
            await loadAccounts()
            setShowModal(false)
            setEditingAccount(null)
          }}
        />
      )}
    </div>
  )
}

function AccountCard({
  account,
  showMenu,
  onMenuToggle,
  onEdit,
  onToggleActive,
}: {
  account: Account
  showMenu: boolean
  onMenuToggle: () => void
  onEdit: () => void
  onToggleActive: () => void
}) {
  const isFixedDeposit = account.type === "fixed-deposit"
  const estimatedInterest =
    isFixedDeposit && account.depositDate && account.maturityDate && account.interestRate
      ? calculateInterest(account.balance, account.interestRate, account.depositDate, account.maturityDate)
      : 0

  return (
    <div
      className={`bg-card border rounded-lg overflow-hidden transition-all ${
        account.isActive ? "border-border hover:border-primary/50" : "border-border/50 opacity-60"
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded flex items-center justify-center ${
                isFixedDeposit ? "bg-accent/10 border border-accent/30" : "bg-primary/10 border border-primary/30"
              }`}
            >
              {isFixedDeposit ? (
                <PiggyBank className={`w-5 h-5 ${account.isActive ? "text-accent" : "text-muted-foreground"}`} />
              ) : (
                <Wallet className={`w-5 h-5 ${account.isActive ? "text-primary" : "text-muted-foreground"}`} />
              )}
            </div>
            <div>
              <div className="font-mono text-sm text-foreground">{account.name}</div>
              <div className="font-mono text-xs text-muted-foreground uppercase">
                {isFixedDeposit ? "FIXED DEPOSIT" : "DAY-TO-DAY"}
                {account.isPrimary && <span className="text-primary ml-2">• PRIMARY</span>}
              </div>
            </div>
          </div>
          <div className="relative">
            <button onClick={onMenuToggle} className="p-1 hover:bg-secondary rounded transition-colors">
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 bg-card border border-border rounded shadow-lg z-10 min-w-[150px]">
                <button
                  onClick={onEdit}
                  className="flex items-center gap-2 w-full px-4 py-2 font-mono text-xs text-foreground hover:bg-secondary transition-colors"
                >
                  <Edit2 className="w-3 h-3" />
                  EDIT
                </button>
                <button
                  onClick={onToggleActive}
                  className="flex items-center gap-2 w-full px-4 py-2 font-mono text-xs text-foreground hover:bg-secondary transition-colors"
                >
                  <Power className="w-3 h-3" />
                  {account.isActive ? "DEACTIVATE" : "ACTIVATE"}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="font-mono text-2xl text-foreground mb-4">{formatCurrency(account.balance)}</div>

        {isFixedDeposit && (
          <div className="space-y-2 pt-4 border-t border-border">
            {account.interestRate && (
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Percent className="w-3 h-3" />
                  INTEREST RATE
                </span>
                <span className="text-success">{account.interestRate}% p.a.</span>
              </div>
            )}
            {account.maturityDate && (
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  MATURITY
                </span>
                <span className="text-foreground">{formatDate(account.maturityDate)}</span>
              </div>
            )}
            {estimatedInterest > 0 && (
              <div className="flex items-center justify-between font-mono text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  EST. INTEREST
                </span>
                <span className="text-success">+{formatCurrency(estimatedInterest)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div
        className={`px-4 py-2 font-mono text-xs ${
          account.isActive ? "bg-success/10 text-success" : "bg-muted/10 text-muted-foreground"
        }`}
      >
        STATUS: {account.isActive ? "ACTIVE" : "INACTIVE"}
      </div>
    </div>
  )
}

function AccountModal({
  account,
  onClose,
  onSave,
}: {
  account: Account | null
  onClose: () => void
  onSave: () => void
}) {
  const [name, setName] = useState(account?.name || "")
  const [type, setType] = useState<"day-to-day" | "fixed-deposit">(account?.type || "day-to-day")
  const [balance, setBalance] = useState(account?.balance?.toString() || "0")
  const [interestRate, setInterestRate] = useState(account?.interestRate?.toString() || "")
  const [depositDate, setDepositDate] = useState(account?.depositDate || "")
  const [maturityDate, setMaturityDate] = useState(account?.maturityDate || "")
  const [isPrimary, setIsPrimary] = useState(account?.isPrimary || false)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("ACCOUNT DESIGNATION REQUIRED")
      return
    }

    if (type === "fixed-deposit" && (!depositDate || !maturityDate)) {
      setError("DEPOSIT AND MATURITY DATES REQUIRED FOR FIXED DEPOSITS")
      return
    }

    const accountData = {
      name: name.trim().toUpperCase(),
      type,
      balance: Number.parseFloat(balance) || 0,
      interestRate: type === "fixed-deposit" ? Number.parseFloat(interestRate) || undefined : undefined,
      depositDate: type === "fixed-deposit" ? depositDate : undefined,
      maturityDate: type === "fixed-deposit" ? maturityDate : undefined,
      isPrimary,
    }

    startTransition(async () => {
      if (account) {
        await updateAccount(account.id, accountData)
      } else {
        await addAccount(accountData)
      }
      onSave()
    })
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-mono text-sm text-foreground">
            {account ? "MODIFY ACCOUNT" : "NEW ACCOUNT REGISTRATION"}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-secondary rounded transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">ACCOUNT DESIGNATION</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary uppercase"
              placeholder="E.G., PRIMARY CHECKING"
            />
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">ACCOUNT TYPE</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType("day-to-day")}
                className={`p-3 rounded border font-mono text-xs transition-colors ${
                  type === "day-to-day"
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <Wallet className="w-5 h-5 mx-auto mb-1" />
                DAY-TO-DAY
              </button>
              <button
                type="button"
                onClick={() => setType("fixed-deposit")}
                className={`p-3 rounded border font-mono text-xs transition-colors ${
                  type === "fixed-deposit"
                    ? "bg-accent/10 border-accent text-accent"
                    : "bg-secondary border-border text-muted-foreground hover:border-accent/50"
                }`}
              >
                <PiggyBank className="w-5 h-5 mx-auto mb-1" />
                FIXED DEPOSIT
              </button>
            </div>
          </div>

          <div>
            <label className="font-mono text-xs text-muted-foreground block mb-2">
              {account ? "CURRENT BALANCE (P)" : "INITIAL BALANCE (P)"}
            </label>
            <input
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
              placeholder="0.00"
            />
          </div>

          {type === "fixed-deposit" && (
            <>
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-2">INTEREST RATE (% P.A.)</label>
                <input
                  type="number"
                  step="0.01"
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                  placeholder="5.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">DEPOSIT DATE</label>
                  <input
                    type="date"
                    value={depositDate}
                    onChange={(e) => setDepositDate(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="font-mono text-xs text-muted-foreground block mb-2">MATURITY DATE</label>
                  <input
                    type="date"
                    value={maturityDate}
                    onChange={(e) => setMaturityDate(e.target.value)}
                    className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </>
          )}

          {type === "day-to-day" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="font-mono text-xs text-muted-foreground">SET AS PRIMARY ACCOUNT (RECEIVES INCOME)</span>
            </label>
          )}

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
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? "PROCESSING..." : account ? "UPDATE" : "CREATE"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
