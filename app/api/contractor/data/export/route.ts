import { NextRequest, NextResponse } from "next/server"
import { exportTenantData, recordAuditEvent } from "@/lib/platform-db"
import { checkRateLimit, rateLimitResponse, requestId } from "@/lib/request-security"
import { resolveContractorPrincipal } from "@/lib/tenant-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const principal = await resolveContractorPrincipal(request)
  if (!principal) return NextResponse.json({ error: "Sign in to export account data." }, { status: 401 })
  if (!principal.owner) return NextResponse.json({ error: "Only an organization owner or administrator can export account data." }, { status: 403 })
  const limit = await checkRateLimit({ request, scope: "contractor-export", identifier: principal.tenant.tenant_id, limit: 3, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter)
  const id = requestId(request)
  const data = await exportTenantData(principal.tenant.tenant_id)
  await recordAuditEvent({ tenantId: principal.tenant.tenant_id, actorType: "contractor", actorId: principal.actorId, action: "data.exported", targetType: "tenant", targetId: principal.tenant.tenant_id, requestId: id })
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="gutterquote-${principal.tenant.tenant_id}-export.json"`, "X-Request-Id": id } })
}
