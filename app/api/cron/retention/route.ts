import { NextRequest, NextResponse } from "next/server"
import { deletePrivateImages } from "@/lib/render-storage"
import { deleteExpiredRenderJobs, recordAuditEvent, runRetentionCleanup } from "@/lib/platform-db"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
  const result = await runRetentionCleanup()
  await deletePrivateImages(result.jobs.flatMap((job) => [job.source_blob_url, job.result_blob_url]))
  const renderJobsDeleted = await deleteExpiredRenderJobs(result.jobs.map((job) => job.id))
  await recordAuditEvent({ actorType: "system", action: "retention.cleanup", metadata: { abandonedDeleted: result.abandoned, completedDeleted: result.completed, sessionsExpired: result.expiredSessions, renderJobsDeleted } })
  return NextResponse.json({ ok: true, abandonedDeleted: result.abandoned, completedDeleted: result.completed, sessionsExpired: result.expiredSessions, renderJobsDeleted })
}
