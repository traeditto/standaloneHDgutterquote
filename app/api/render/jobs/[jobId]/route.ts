import { after, NextRequest, NextResponse } from "next/server"
import { getQuoteSession, getRenderJob } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { resolvePublicTenant } from "@/lib/tenant-context"
import { processRenderJob } from "@/lib/render-worker"

export const runtime = "nodejs"

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const tenant = await resolvePublicTenant(request)
  if (!tenant) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
  if (!claims || !await getQuoteSession(tenant.tenant_id, claims.sessionId)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const { jobId } = await params
  const job = await getRenderJob({ tenantId: tenant.tenant_id, sessionId: claims.sessionId, jobId })
  if (!job) return NextResponse.json({ error: "Not found." }, { status: 404 })
  if (job.status === "queued") after(() => processRenderJob(job.id))
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    remainingQuoteRenders: Math.max(0, 4 - (await getQuoteSession(tenant.tenant_id, claims.sessionId))!.render_attempts),
    ...(job.status === "succeeded" ? {
      imageUrl: `/api/render/jobs/${encodeURIComponent(job.id)}/image?kind=result`,
      sourceImageUrl: `/api/render/jobs/${encodeURIComponent(job.id)}/image?kind=source`,
    } : {}),
    ...(job.status === "failed" ? { code: job.error_code || "RENDER_FAILED", error: job.error_message || "The gutter preview could not be created." } : {}),
  }, { headers: { "Cache-Control": "no-store" } })
}
