"use client"

import { UserButton } from "@clerk/nextjs"

export function PlatformAccount({ clerkEnabled }: { clerkEnabled: boolean }) {
  if (clerkEnabled) return <UserButton showName />
  return <form action="/api/platform/logout" method="post"><button>Sign out</button></form>
}
