"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated, getUser } from "@/lib/storage"

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthed, setIsAuthed] = useState(false)

  useEffect(() => {
    const checkAuth = () => {
      const authed = isAuthenticated()
      const user = getUser()

      if (!authed || !user) {
        router.push("/")
        return
      }

      setIsAuthed(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center font-mono">
          <div className="text-primary text-lg mb-2">VERIFYING CLEARANCE...</div>
          <div className="flex items-center justify-center gap-1">
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse delay-100" />
            <span className="w-2 h-2 bg-primary rounded-full animate-pulse delay-200" />
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthed) {
    return null
  }

  return <>{children}</>
}
