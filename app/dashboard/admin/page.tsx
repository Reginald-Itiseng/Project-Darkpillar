"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import * as apiStorage from "@/lib/api-storage"
import { Shield, Copy, AlertTriangle } from "lucide-react"

export default function AdminPage() {
  const [user, setUser] = useState<{ username: string; clearanceLevel: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [inviteMaxUses, setInviteMaxUses] = useState(1)
  const [inviteExpiresDays, setInviteExpiresDays] = useState(14)
  const [createdInvite, setCreatedInvite] = useState<apiStorage.AdminInvite | null>(null)
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [adminMessage, setAdminMessage] = useState("")

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await apiStorage.verifySession()
        if (userData) {
          apiStorage.setCurrentUser(userData)
          setUser({ username: userData.username, clearanceLevel: userData.clearanceLevel })
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadUser()
  }, [])

  const isAdmin = (user?.clearanceLevel || 0) >= 4

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdminMessage("")
    setIsCreatingInvite(true)

    try {
      const invite = await apiStorage.createInviteCode(inviteMaxUses, inviteExpiresDays)
      setCreatedInvite(invite)
      setAdminMessage("INVITE CODE GENERATED")
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message.toUpperCase() : "FAILED TO CREATE INVITE")
    } finally {
      setIsCreatingInvite(false)
    }
  }

  const handleCopyInvite = async () => {
    if (!createdInvite) return

    try {
      await navigator.clipboard.writeText(createdInvite.code)
      setAdminMessage("INVITE CODE COPIED")
    } catch {
      setAdminMessage("COPY FAILED - MANUAL COPY REQUIRED")
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 overflow-auto">
          <div className="mb-6 p-6 bg-card border border-border rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-warning" />
              <div>
                <h1 className="font-mono text-2xl text-foreground">ADMIN CONTROL CENTER</h1>
                <p className="font-mono text-sm text-muted-foreground">MANAGE REGISTRATION INVITE CODES</p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="bg-card border border-border rounded-lg p-8 font-mono text-sm text-muted-foreground">
              LOADING ADMIN CLEARANCE...
            </div>
          ) : !isAdmin ? (
            <div className="bg-card border border-destructive/40 rounded-lg p-8">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h2 className="font-mono text-sm text-destructive">ACCESS DENIED</h2>
              </div>
              <p className="font-mono text-sm text-muted-foreground">
                ADMINISTRATOR CLEARANCE LEVEL 4 REQUIRED TO ACCESS THIS SECTION.
              </p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-mono text-sm text-foreground">REGISTRATION INVITE CONTROLS</h2>
                <span className="font-mono text-xs text-warning">INVITE-ONLY REGISTRATION ENABLED</span>
              </div>

              <div className="p-4">
                <form onSubmit={handleCreateInvite} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                  <div>
                    <label className="font-mono text-xs text-muted-foreground block mb-2">MAX USES</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={inviteMaxUses}
                      onChange={(e) => setInviteMaxUses(Number(e.target.value) || 1)}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="font-mono text-xs text-muted-foreground block mb-2">EXPIRES (DAYS)</label>
                    <input
                      type="number"
                      min={1}
                      max={365}
                      value={inviteExpiresDays}
                      onChange={(e) => setInviteExpiresDays(Number(e.target.value) || 14)}
                      className="w-full bg-secondary border border-border rounded px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="md:col-span-2 flex items-end">
                    <button
                      type="submit"
                      disabled={isCreatingInvite}
                      className="w-full px-4 py-2 bg-warning text-warning-foreground font-mono text-sm rounded hover:bg-warning/90 transition-colors disabled:opacity-50"
                    >
                      {isCreatingInvite ? "GENERATING..." : "GENERATE INVITE CODE"}
                    </button>
                  </div>
                </form>

                {createdInvite && (
                  <div className="p-4 bg-secondary/50 border border-border rounded">
                    <div className="font-mono text-xs text-muted-foreground mb-2">LATEST INVITE CODE</div>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                      <div>
                        <div className="font-mono text-lg text-primary">{createdInvite.code}</div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          MAX USES: {createdInvite.maxUses} | EXPIRY:{" "}
                          {createdInvite.expiresAt ? new Date(createdInvite.expiresAt).toLocaleString() : "NONE"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyInvite}
                        className="flex items-center justify-center gap-2 px-3 py-2 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary rounded font-mono text-xs transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        COPY
                      </button>
                    </div>
                  </div>
                )}

                {adminMessage && <div className="mt-3 font-mono text-xs text-warning">{adminMessage}</div>}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
