import { NextResponse } from "next/server"
import { getTenantAccess, listTenants } from "@/lib/platform-db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization")
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }

  const tenants = await listTenants()
  const actions: Array<{ tenantId: string; action: string; ok: boolean }> = []
  for (const tenant of tenants) {
    const access = await getTenantAccess(tenant.tenant_id)
    if (access?.accessState === "suspended") actions.push({ tenantId: tenant.tenant_id, action: "tenant_access_blocked", ok: true })
  }
  return NextResponse.json({ checked: tenants.length, actions })
}
