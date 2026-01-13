"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { registerUser, loginUser } from "@/app/actions/auth"

const BOOT_SEQUENCE = [
  "INITIALIZING SCP FOUNDATION FINANCIAL CONTAINMENT SYSTEM...",
  "LOADING SECURE PROTOCOLS...",
  "ESTABLISHING ENCRYPTED CONNECTION...",
  "VERIFYING SYSTEM INTEGRITY... OK",
  "LOADING FINANCIAL ANOMALY DATABASE...",
  "CONNECTING TO SECURE DATABASE...",
  "SYSTEM READY.",
  "",
  "═══════════════════════════════════════════════════════════════",
  "  ███████╗ ██████╗██████╗       ███████╗██╗███╗   ██╗ █████╗ ███╗   ██╗ ██████╗███████╗",
  "  ██╔════╝██╔════╝██╔══██╗      ██╔════╝██║████╗  ██║██╔══██╗████╗  ██║██╔════╝██╔════╝",
  "  ███████╗██║     ██████╔╝█████╗█████╗  ██║██╔██╗ ██║███████║██╔██╗ ██║██║     █████╗  ",
  "  ╚════██║██║     ██╔═══╝ ╚════╝██╔══╝  ██║██║╚██╗██║██╔══██║██║╚██╗██║██║     ██╔══╝  ",
  "  ███████║╚██████╗██║           ██║     ██║██║ ╚████║██║  ██║██║ ╚████║╚██████╗███████╗",
  "  ╚══════╝ ╚═════╝╚═╝           ╚═╝     ╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝╚══════╝",
  "═══════════════════════════════════════════════════════════════",
  "  SECURE CONTAINMENT PROTOCOL - FINANCIAL ASSET MANAGEMENT",
  "  CLASSIFICATION: LEVEL 4 CLEARANCE REQUIRED",
  "═══════════════════════════════════════════════════════════════",
  "",
]

export function TerminalLogin() {
  const router = useRouter()
  const [bootLines, setBootLines] = useState<string[]>([])
  const [bootComplete, setBootComplete] = useState(false)
  const [mode, setMode] = useState<"login" | "register">("login")
  const [username, setUsername] = useState("")
  const [pin, setPIN] = useState("")
  const [confirmPIN, setConfirmPIN] = useState("")
  const [error, setError] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // Boot sequence animation
    let currentLine = 0
    const bootInterval = setInterval(() => {
      if (currentLine < BOOT_SEQUENCE.length) {
        setBootLines((prev) => [...prev, BOOT_SEQUENCE[currentLine]])
        currentLine++
      } else {
        clearInterval(bootInterval)
        setBootComplete(true)
      }
    }, 80)

    return () => clearInterval(bootInterval)
  }, [])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [bootLines])

  useEffect(() => {
    if (bootComplete && inputRef.current) {
      inputRef.current.focus()
    }
  }, [bootComplete])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsProcessing(true)

    try {
      if (mode === "register") {
        if (username.length < 3) {
          setError("ERROR: AGENT DESIGNATION MUST BE AT LEAST 3 CHARACTERS")
          setIsProcessing(false)
          return
        }
        if (pin.length < 4) {
          setError("ERROR: ACCESS CODE MUST BE AT LEAST 4 DIGITS")
          setIsProcessing(false)
          return
        }
        if (pin !== confirmPIN) {
          setError("ERROR: ACCESS CODES DO NOT MATCH")
          setIsProcessing(false)
          return
        }

        const result = await registerUser(username.toUpperCase(), pin)
        if (result.success) {
          router.push("/dashboard")
        } else {
          setError(`ERROR: ${result.error?.toUpperCase()}`)
        }
      } else {
        const result = await loginUser(username.toUpperCase(), pin)
        if (result.success) {
          router.push("/dashboard")
        } else {
          setError(`ERROR: ${result.error?.toUpperCase()}`)
        }
      }
    } catch (err) {
      setError("ERROR: SYSTEM FAILURE. PLEASE TRY AGAIN.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Scanline effect */}
      <div className="fixed inset-0 pointer-events-none z-50">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/[0.02] to-transparent h-[200%] scanline" />
      </div>

      {/* CRT flicker effect */}
      <div className="fixed inset-0 pointer-events-none bg-primary/[0.01] z-40" />

      <div className="w-full max-w-4xl">
        {/* Terminal window */}
        <div className="border border-border rounded-sm overflow-hidden shadow-2xl shadow-primary/10">
          {/* Terminal header */}
          <div className="bg-secondary px-4 py-2 flex items-center gap-2 border-b border-border">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div className="w-3 h-3 rounded-full bg-warning" />
              <div className="w-3 h-3 rounded-full bg-success" />
            </div>
            <span className="font-mono text-xs text-muted-foreground ml-4">
              SCP-FINANCE-TERMINAL-v4.7.2 — SECURE SESSION
            </span>
          </div>

          {/* Terminal content */}
          <div ref={terminalRef} className="bg-background p-6 h-[600px] overflow-y-auto font-mono text-sm">
            {/* Boot sequence */}
            {bootLines.map((line, index) => (
              <div
                key={index}
                className={`${
                  (line && line.includes("═")) || (line && line.includes("█"))
                    ? "text-primary"
                    : line && (line.includes("OK") || line.includes("READY"))
                      ? "text-success"
                      : line && line.includes("CLASSIFICATION")
                        ? "text-warning"
                        : "text-foreground"
                } whitespace-pre`}
              >
                {line || "\u00A0"}
              </div>
            ))}

            {/* Login/Register form */}
            {bootComplete && (
              <div className="mt-4">
                <div className="text-muted-foreground mb-4">
                  {mode === "register" ? (
                    <>
                      <span className="text-warning">[NOTICE]</span> NEW AGENT REGISTRATION.
                      <br />
                      INITIATING SECURE PROFILE CREATION PROTOCOL...
                    </>
                  ) : (
                    <>
                      <span className="text-primary">[SECURE]</span> AGENT AUTHENTICATION REQUIRED.
                      <br />
                      ENTER CREDENTIALS TO ACCESS FINANCIAL CONTAINMENT SYSTEM.
                    </>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-primary">AGENT_DESIGNATION:</span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-foreground font-mono uppercase"
                      placeholder="ENTER DESIGNATION"
                      disabled={isProcessing}
                      autoComplete="off"
                    />
                    <span className="cursor-blink text-primary">█</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-primary">ACCESS_CODE:</span>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPIN(e.target.value)}
                      className="flex-1 bg-transparent border-none outline-none text-foreground font-mono tracking-widest"
                      placeholder="••••"
                      disabled={isProcessing}
                    />
                  </div>

                  {mode === "register" && (
                    <div className="flex items-center gap-2">
                      <span className="text-primary">CONFIRM_CODE:</span>
                      <input
                        type="password"
                        value={confirmPIN}
                        onChange={(e) => setConfirmPIN(e.target.value)}
                        className="flex-1 bg-transparent border-none outline-none text-foreground font-mono tracking-widest"
                        placeholder="••••"
                        disabled={isProcessing}
                      />
                    </div>
                  )}

                  {error && <div className="text-destructive animate-pulse">{error}</div>}

                  <div className="pt-4 flex items-center gap-4">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="px-6 py-2 border border-primary text-primary hover:bg-primary hover:text-background transition-colors font-mono text-sm glitch-hover disabled:opacity-50"
                    >
                      {isProcessing ? "PROCESSING..." : mode === "register" ? "[REGISTER AGENT]" : "[AUTHENTICATE]"}
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode(mode === "login" ? "register" : "login")}
                      className="text-muted-foreground hover:text-foreground font-mono text-sm"
                    >
                      {mode === "login" ? "[NEW AGENT REGISTRATION]" : "[EXISTING AGENT LOGIN]"}
                    </button>
                  </div>
                </form>

                <div className="mt-8 pt-4 border-t border-border text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="text-warning">⚠</span>
                    <span>UNAUTHORIZED ACCESS IS STRICTLY PROHIBITED. ALL ACTIVITIES ARE MONITORED AND LOGGED.</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-primary">◉</span>
                    <span>SCP FOUNDATION FINANCIAL DIVISION — PROTECTING ASSETS, CONTAINING ANOMALIES</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
