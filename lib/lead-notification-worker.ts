import "server-only"

import { sendLeadEmail } from "@/lib/lead-email"
import {
  claimLeadNotification,
  completeLeadNotification,
  failLeadNotification,
  recordAuditEvent,
} from "@/lib/platform-db"

export async function processLeadNotification(notificationId: string) {
  const notification = await claimLeadNotification(notificationId)
  if (!notification) return { processed: false }

  try {
    const result = await sendLeadEmail({
      to: notification.recipient,
      companyName: notification.company_name,
      address: notification.address,
      state: notification.state,
      county: notification.county,
      name: notification.name,
      email: notification.email,
      phone: notification.phone,
      estimate: String(notification.quote?.estimateRange ?? ""),
      idempotencyKey: `gutterquote-lead-${notification.id}`,
      eventType: notification.event_type,
    })
    await completeLeadNotification(notification.id, result.providerMessageId)
    await recordAuditEvent({
      tenantId: notification.tenant_id,
      actorType: "system",
      action: "lead.notification_sent",
      targetType: "lead",
      targetId: notification.lead_id,
      metadata: { notificationId: notification.id, attempts: notification.attempts },
    })
    return { processed: true, sent: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lead email delivery failed."
    const failed = await failLeadNotification(notification.id, notification.attempts, message)
    if (failed?.status === "failed") {
      await recordAuditEvent({
        tenantId: notification.tenant_id,
        actorType: "system",
        action: "lead.notification_failed",
        targetType: "lead",
        targetId: notification.lead_id,
        metadata: { notificationId: notification.id, attempts: notification.attempts },
      })
    }
    return { processed: true, sent: false }
  }
}
