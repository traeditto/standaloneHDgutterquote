import { NextRequest, NextResponse } from "next/server"
import { verifyWebhook } from "@clerk/nextjs/webhooks"
import { beginClerkEvent, completeClerkEvent, linkTenantClerkOrganization, recordAuditEvent, releaseClerkEvent } from "@/lib/platform-db"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) return NextResponse.json({ error: "Clerk webhook is not configured." }, { status: 503 })
  let event: Awaited<ReturnType<typeof verifyWebhook>>
  try { event = await verifyWebhook(request) } catch { return NextResponse.json({ error: "Invalid Clerk webhook signature." }, { status: 400 }) }
  const eventId = request.headers.get("svix-id")
  if (!eventId) return NextResponse.json({ error: "Clerk webhook event ID is missing." }, { status: 400 })
  if (!await beginClerkEvent(eventId, event.type)) return NextResponse.json({ received: true, duplicate: true })
  try {
    if (event.type === "organization.created" || event.type === "organization.updated") {
      const organization = event.data as { id: string; private_metadata?: Record<string, unknown> }
      const tenantId = typeof organization.private_metadata?.tenantId === "string" ? organization.private_metadata.tenantId : null
      if (tenantId) {
        const tenant = await linkTenantClerkOrganization(tenantId, organization.id)
        if (!tenant) throw new Error("The Clerk organization references an unknown HD Instant Gutter Quote tenant.")
        await recordAuditEvent({ tenantId, actorType: "system", actorId: organization.id, action: "identity.organization_linked", targetType: "tenant", targetId: tenantId })
      }
    } else if (event.type.startsWith("organizationMembership.")) {
      const membership = event.data as { id: string; organization?: { id?: string }; public_user_data?: { user_id?: string } }
      await recordAuditEvent({ actorType: "system", actorId: membership.public_user_data?.user_id, action: `identity.${event.type}`, targetType: "organization", targetId: membership.organization?.id, metadata: { membershipId: membership.id } })
    }
    await completeClerkEvent(eventId)
    return NextResponse.json({ received: true })
  } catch (error) {
    await releaseClerkEvent(eventId).catch(() => undefined)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Clerk webhook processing failed." }, { status: 500 })
  }
}
