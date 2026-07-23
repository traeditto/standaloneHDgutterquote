import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { deleteTenantLead, recordAuditEvent } from "@/lib/platform-db"
import { requestId, sameOrigin } from "@/lib/request-security"
import { resolveContractorPrincipal } from "@/lib/tenant-context"

export const runtime = "nodejs"

const leadIdSchema = z.string().uuid()

export async function DELETE(request: NextRequest, context: { params: Promise<{ leadId: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site deletion requests are not allowed." }, { status: 403 })
  const principal = await resolveContractorPrincipal(request)
  if (!principal) return NextResponse.json({ error: "Sign in to delete lead data." }, { status: 401 })
  if (!principal.owner) return NextResponse.json({ error: "Only an organization owner or administrator can delete lead data." }, { status: 403 })
  const parsed = leadIdSchema.safeParse((await context.params).leadId)
  if (!parsed.success) return NextResponse.json({ error: "Invalid lead identifier." }, { status: 400 })
  const deleted = await deleteTenantLead(principal.tenant.tenant_id, parsed.data)
  if (!deleted) return NextResponse.json({ error: "Lead not found." }, { status: 404 })
  const id = requestId(request)
  await recordAuditEvent({ tenantId: principal.tenant.tenant_id, actorType: "contractor", actorId: principal.actorId, action: "lead.deleted", targetType: "lead", targetId: parsed.data, requestId: id })
  return NextResponse.json({ ok: true, requestId: id }, { headers: { "Cache-Control": "no-store" } })
}
