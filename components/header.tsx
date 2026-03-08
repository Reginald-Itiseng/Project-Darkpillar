"use client"

import { useEffect, useState } from "react"
import * as apiStorage from "@/lib/api-storage"
import { Bell, Compass } from "lucide-react"

function getUtcOffsetLabel(date = new Date()): string {
  const offsetMinutes = -date.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? "+" : "-"
  const abs = Math.abs(offsetMinutes)
  const hours = String(Math.floor(abs / 60)).padStart(2, "0")
  const minutes = String(abs % 60).padStart(2, "0")
  return `UTC${sign}${hours}:${minutes}`
}

export function Header() {
  const [user, setUserState] = useState<{ username: string } | null>(null)
  const [currentTime, setCurrentTime] = useState("")
  const [utcOffset, setUtcOffset] = useState(getUtcOffsetLabel())

  useEffect(() => {
    const loadUser = async () => {
      const cachedUser = apiStorage.getCurrentUser()
      if (cachedUser) {
        setUserState({ username: cachedUser.username })
        return
      }

      const verifiedUser = await apiStorage.verifySession()
      if (verifiedUser) {
        apiStorage.setCurrentUser(verifiedUser)
        setUserState({ username: verifiedUser.username })
      }
    }

    void loadUser()

    const updateClock = () => {
      const now = new Date()
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }),
      )
      setUtcOffset(getUtcOffsetLabel(now))
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      <div className="flex items-center gap-3 text-muted-foreground">
        <Compass className="w-4 h-4" />
        <div className="font-mono text-xs">
          FIELD TIP: Review <span className="text-foreground">OVERVIEW</span> first, then log activity in{" "}
          <span className="text-foreground">TRANSACTIONS</span>.
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="font-mono text-sm text-muted-foreground">
          <span className="text-primary">{currentTime}</span>
          <span className="mx-2">|</span>
          <span>{utcOffset}</span>
        </div>

        <button className="relative p-2 hover:bg-secondary rounded transition-colors" title="Notifications">
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
