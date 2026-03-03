"use client"

import type React from "react"

import { useEffect, useMemo, useRef, useState } from "react"
import * as apiStorage from "@/lib/api-storage"

const STORAGE_KEY_TIMEOUT = "inactivity_lock_timeout_ms"
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000
const TIMEOUT_OPTIONS_MS = [
  1 * 60 * 1000,
  2 * 60 * 1000,
  5 * 60 * 1000,
  10 * 60 * 1000,
  15 * 60 * 1000,
  30 * 60 * 1000,
]

function formatTimeoutLabel(valueMs: number): string {
  const minutes = Math.round(valueMs / 60000)
  return `${minutes} MIN`
}

function getSavedTimeout(): number {
  if (typeof window === "undefined") return DEFAULT_TIMEOUT_MS
  const raw = localStorage.getItem(STORAGE_KEY_TIMEOUT)
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 30000 ? parsed : DEFAULT_TIMEOUT_MS
}

export function InactivityLock({ children }: { children: React.ReactNode }) {
  const [timeoutMs, setTimeoutMs] = useState<number>(DEFAULT_TIMEOUT_MS)
  const [locked, setLocked] = useState(false)
  const [pin, setPin] = useState("")
  const [error, setError] = useState("")
  const [unlocking, setUnlocking] = useState(false)
  const [identifier, setIdentifier] = useState("")
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hint = useMemo(() => {
    if (!identifier) return "Enter PIN to unlock"
    return `Unlock as ${identifier.toUpperCase()}`
  }, [identifier])

  const resetTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (locked) return
    timerRef.current = setTimeout(() => {
      setLocked(true)
      setPin("")
      setError("")
    }, timeoutMs)
  }

  useEffect(() => {
    setTimeoutMs(getSavedTimeout())
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY_TIMEOUT, String(timeoutMs))
    }
    resetTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, locked])

  useEffect(() => {
    const hydrateIdentity = async () => {
      const currentUser = apiStorage.getCurrentUser()
      if (currentUser?.email || currentUser?.username) {
        setIdentifier((currentUser.email || currentUser.username || "").toLowerCase())
        return
      }

      const verified = await apiStorage.verifySession()
      if (verified?.email || verified?.username) {
        setIdentifier((verified.email || verified.username || "").toLowerCase())
      }
    }

    void hydrateIdentity()
  }, [])

  useEffect(() => {
    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ]

    const handler = () => resetTimer()
    events.forEach((event) => window.addEventListener(event, handler, { passive: true }))
    resetTimer()

    return () => {
      events.forEach((event) => window.removeEventListener(event, handler))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, locked])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const authIdentifier = identifier.trim().toLowerCase()
    if (!authIdentifier || !pin) {
      setError("IDENTITY OR PIN MISSING")
      return
    }

    try {
      setUnlocking(true)
      const { user } = await apiStorage.login(authIdentifier, pin)
      apiStorage.setCurrentUser(user)
      setLocked(false)
      setPin("")
      resetTimer()
    } catch (err) {
      setError(err instanceof Error ? err.message.toUpperCase() : "FAILED TO UNLOCK")
    } finally {
      setUnlocking(false)
    }
  }

  return (
    <div className="relative min-h-screen">
      <div className={locked ? "pointer-events-none select-none blur-sm" : ""}>{children}</div>

      <div className="fixed bottom-3 right-3 z-[70] bg-card border border-border rounded px-3 py-2 font-mono text-xs text-muted-foreground">
        <span className="mr-2">AUTO-LOCK</span>
        <select
          value={timeoutMs}
          onChange={(e) => setTimeoutMs(Number(e.target.value))}
          className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground"
          disabled={locked}
        >
          {TIMEOUT_OPTIONS_MS.map((value) => (
            <option key={value} value={value}>
              {formatTimeoutLabel(value)}
            </option>
          ))}
        </select>
      </div>

      {locked && (
        <div className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-lg overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-mono text-sm text-foreground">SESSION LOCKED</h2>
              <p className="font-mono text-xs text-muted-foreground mt-1">
                {hint}
              </p>
            </div>
            <div className="px-4 pt-4 pb-1 font-mono text-[11px] text-muted-foreground">
              ******** ******** ******** ********
            </div>
            <form onSubmit={handleUnlock} className="p-4 space-y-4">
              <div>
                <label className="font-mono text-xs text-muted-foreground block mb-2">PIN</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded font-mono text-xs text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={unlocking}
                className="w-full px-4 py-2 bg-primary text-primary-foreground font-mono text-sm rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {unlocking ? "VERIFYING..." : "UNLOCK"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

