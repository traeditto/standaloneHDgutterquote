import { NextRequest, NextResponse } from "next/server"
import { failRenderJob, listQueuedRenderJobIds, listStaleRenderJobIds, recordAuditEvent } from "@/lib/platform-db"
import { processRenderJob } from "@/lib/render-worker"

export const runtime = "nodejs"
export const maxDuration = 120

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  }
  const stale = await listStaleRenderJobIds()
  for (const jobId of stale) {
    await failRenderJob({ jobId, errorCode: "WORKER_TIMEOUT", errorMessage: "The render worker did not finish within its execution lease.", refundCredit: true })
  }
  const queued = await listQueuedRenderJobIds(Number(process.env.RENDER_CRON_BATCH_SIZE || 10))
  await Promise.allSettled(queued.map(processRenderJob))
  await recordAuditEvent({ actorType: "system", action: "render.worker_sweep", metadata: { queued: queued.length, staleFailed: stale.length } })
  return NextResponse.json({ ok: true, queued: queued.length, staleFailed: stale.length })
}
