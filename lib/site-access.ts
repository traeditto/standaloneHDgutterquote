import "server-only"

import { getTenantAccess } from "@/lib/platform-db"

export async function getSiteAccess(tenantId: string) {
  const access = await getTenantAccess(tenantId)
  if (!access) return { allowed: false, state: "unregistered" as const, graceEndsAt: null }
  return {
    allowed: access.accessState === "active" || access.accessState === "grace",
    state: access.accessState,
    graceEndsAt: access.graceEndsAt,
  }
}

