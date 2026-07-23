import { after, NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyAddressToken } from "@/lib/address-verification"
import { processLeadNotification } from "@/lib/lead-notification-worker"
import { completeQuoteSession, enqueueLeadNotification, getQuoteSession, recordAuditEvent, upsertLead } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { checkRateLimit, rateLimitResponse, requestId, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant, resolvePublicTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"

const leadSchema = z.object({
  sessionId: z.string().uuid(),
  addressToken: z.string().min(20).max(2_000),
  completed: z.boolean().optional().default(false),
  contactProvided: z.boolean().optional().default(false),
  testMode: z.boolean().optional().default(false),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().min(7).max(40).optional(),
  quote: z.record(z.string(), z.unknown()).optional(),
}).strict()

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    if (!sameOrigin(request)) return NextResponse.json({ code: "ORIGIN_MISMATCH", error: "Cross-site lead submissions are not allowed." }, { status: 403 })
    const parsed = leadSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success || JSON.stringify(parsed.data?.quote ?? {}).length > 20_000) {
      return NextResponse.json({ code: "INVALID_REQUEST", error: "One or more quote fields are invalid." }, { status: 400 })
    }
    const body = parsed.data
    if ((body.completed || body.contactProvided) && (!body.name || !body.email || !body.phone)) {
      return NextResponse.json({ error: "Name, email, and phone are required to continue." }, { status: 400 })
    }

    const tenant = body.testMode ? await resolveContractorTenant(request) : await resolvePublicTenant(request)
    if (!tenant) return NextResponse.json({ error: body.testMode ? "Sign in to use private test mode." : "This quote site is not registered." }, { status: body.testMode ? 401 : 404 })
    if (!body.testMode && !["active", "grace"].includes(tenant.access_state)) return NextResponse.json({ error: "This quote service is temporarily unavailable." }, { status: 402 })
    const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
    if (!claims || claims.sessionId !== body.sessionId || !await getQuoteSession(tenant.tenant_id, body.sessionId)) {
      return NextResponse.json({ code: "INVALID_QUOTE_SESSION", error: "Your quote session expired. Refresh the page and try again." }, { status: 401 })
    }
    const verifiedAddress = verifyAddressToken(body.addressToken, tenant.tenant_id, body.sessionId)
    if (!verifiedAddress) return NextResponse.json({ error: "The Google address verification expired. Select the property address again." }, { status: 400 })
    const limit = await checkRateLimit({ request, scope: "lead-save", identifier: `${tenant.tenant_id}:${body.sessionId}`, limit: 12, windowSeconds: 3600 })
    if (!limit.allowed) return rateLimitResponse(limit.retryAfter)

    if (body.testMode) return NextResponse.json({ id: `test-${body.sessionId}`, status: body.completed ? "completed" : "started", testMode: true, email: { sent: false } })
    const lead = await upsertLead({
      tenantId: tenant.tenant_id, sessionId: body.sessionId, address: verifiedAddress.address, state: verifiedAddress.state,
      county: verifiedAddress.county, status: body.completed ? "completed" : "started", name: body.name, email: body.email,
      phone: body.phone, quote: body.quote,
    })
    let email: { sent: boolean; queued?: boolean } = { sent: false }
    if (body.completed || body.contactProvided) {
      const eventType = body.completed ? "quote.completed" as const : "lead.contact_provided" as const
      const notification = await enqueueLeadNotification(tenant.tenant_id, lead.id, eventType)
      email = { sent: notification.status === "sent", queued: notification.status !== "sent" }
      if (notification.status === "queued") after(() => processLeadNotification(notification.id))
    }
    if (body.completed) {
      await completeQuoteSession(tenant.tenant_id, body.sessionId)
      await recordAuditEvent({ tenantId: tenant.tenant_id, actorType: "homeowner", action: "quote.completed", targetType: "lead", targetId: String(lead.id), requestId: id })
    }
    return NextResponse.json({ id: lead.id, status: lead.status, email })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The lead could not be saved.", requestId: id }, { status: 503 })
  }
}
