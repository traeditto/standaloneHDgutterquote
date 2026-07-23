import "server-only"

import { cookies } from "next/headers"
import { PLATFORM_ADMIN_COOKIE, readPlatformAdminSession } from "@/lib/platform-admin-auth"

export async function isPlatformStaff() {
  if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    try {
      const { auth, currentUser } = await import("@clerk/nextjs/server")
      const [identity, user] = await Promise.all([auth(), currentUser()])
      if (!identity.userId || user?.privateMetadata?.platformRole !== "admin") return false
      const fva = (identity.sessionClaims as { fva?: [number, number] } | null)?.fva
      return process.env.NODE_ENV !== "production" || Boolean(Array.isArray(fva) && Number(fva[1]) >= 0)
    } catch { return false }
  }
  try { return readPlatformAdminSession((await cookies()).get(PLATFORM_ADMIN_COOKIE)?.value) } catch { return false }
}
