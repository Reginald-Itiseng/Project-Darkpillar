import type React from "react"
import { AuthGuard } from "@/components/auth-guard"
import { InactivityLock } from "@/components/inactivity-lock"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <InactivityLock>{children}</InactivityLock>
    </AuthGuard>
  )
}
