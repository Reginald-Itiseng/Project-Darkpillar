"use client"

import { useEffect, useState } from "react"
import { getUser } from "@/lib/storage"
import { Bell, Search } from "lucide-react"

export function Header() {
  const [user, setUserState] = useState<{ username: string } | null>(null)
  const [currentTime, setCurrentTime] = useState("")

  useEffect(() => {
    const userData = getUser()
    if (userData) {
      setUserState({ username: userData.username })
    }

    const updateTime = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      )
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="SEARCH RECORDS..."
            className="bg-secondary border border-border rounded pl-10 pr-4 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary w-64"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="font-mono text-sm text-muted-foreground">
          <span className="text-primary">{currentTime}</span>
          <span className="mx-2">|</span>
          <span>UTC+0</span>
        </div>

        <button className="relative p-2 hover:bg-secondary rounded transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-warning rounded-full" />
        </button>

        <div className="flex items-center gap-3 pl-4 border-l border-border">
          <div className="w-8 h-8 rounded bg-primary/10 border border-primary/30 flex items-center justify-center font-mono text-sm text-primary">
            {user?.username?.[0] || "A"}
          </div>
          <div className="font-mono text-sm">
            <div className="text-foreground">{user?.username || "AGENT"}</div>
            <div className="text-xs text-muted-foreground">CLEARANCE L4</div>
          </div>
        </div>
      </div>
    </header>
  )
}
