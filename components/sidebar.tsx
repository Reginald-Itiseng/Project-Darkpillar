"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import * as apiStorage from "@/lib/api-storage"
import { LayoutDashboard, Wallet, ArrowLeftRight, Target, PiggyBank, HandCoins, LogOut, Shield } from "lucide-react"

const navItems = [
  {
    label: "OVERVIEW",
    hint: "Current status and alerts",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "ACCOUNTS",
    hint: "Balances and reconciliation",
    href: "/dashboard/accounts",
    icon: Wallet,
  },
  {
    label: "TRANSACTIONS",
    hint: "Income, expenses, transfers",
    href: "/dashboard/transactions",
    icon: ArrowLeftRight,
  },
  {
    label: "BUDGETS",
    hint: "Spending limits by category",
    href: "/dashboard/budgets",
    icon: PiggyBank,
  },
  {
    label: "GOALS",
    hint: "Savings targets and progress",
    href: "/dashboard/goals",
    icon: Target,
  },
  {
    label: "LOANS",
    hint: "Debt tracking and payments",
    href: "/dashboard/loans",
    icon: HandCoins,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await apiStorage.logout()
    } finally {
      apiStorage.clearAllData()
      router.push("/")
    }
  }

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-mono text-sm font-bold text-foreground">SCP-FINANCE</div>
            <div className="font-mono text-xs text-muted-foreground">LEVEL 4 ACCESS</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4">
        <div className="px-2 pb-2 font-mono text-xs text-muted-foreground">NAVIGATION MODULES</div>
        <div className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded font-mono text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                )}
              >
                <item.icon className="w-4 h-4" />
                <div className="min-w-0">
                  <div>{item.label}</div>
                  <div className="text-[10px] opacity-80 truncate">{item.hint}</div>
                </div>
              </Link>
            )
          })}

          <Link
            href="/dashboard/admin"
            className={cn(
              "mt-4 flex items-center gap-3 px-4 py-3 rounded font-mono text-sm transition-colors border",
              pathname === "/dashboard/admin"
                ? "bg-warning/10 text-warning border-warning/30"
                : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary",
            )}
          >
            <Shield className="w-4 h-4" />
            <div className="min-w-0">
              <div>ADMIN CONTROLS</div>
              <div className="text-[10px] opacity-80 truncate">Invite codes and access controls</div>
            </div>
          </Link>
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded font-mono text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          <span>LOGOUT</span>
        </button>
        <div className="mt-4 px-4 font-mono text-xs text-muted-foreground">
          <div>SECURE SESSION</div>
          <div className="text-primary">ENCRYPTED LINK</div>
        </div>
      </div>
    </aside>
  )
}
