import { NextRequest, NextResponse } from "next/server"
import { processLeadNotification } from "@/lib/lead-notification-worker"
import { listDueLeadNotificationIds, recordAuditEvent, requeueStaleLeadNotifications } from "@/lib/platform-db"

export const runtime = "nodejs"
export const maxDuration = 60

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  const staleRequeued = await requeueStaleLeadNotifications()
  const queued = await listDueLeadNotificationIds(Number(process.env.LEAD_EMAIL_CRON_BATCH_SIZE || 25))
  await Promise.allSettled(queued.map(processLeadNotification))
  await recordAuditEvent({
    actorType: "system",
    action: "lead.notification_sweep",
    metadata: { queued: queued.length, staleRequeued },
  })
  return NextResponse.json({ ok: true, queued: queued.length, staleRequeued })
}
