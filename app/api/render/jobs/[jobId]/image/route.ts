import { NextRequest, NextResponse } from "next/server"
import { getQuoteSession, getRenderJob } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { readPrivateImage } from "@/lib/render-storage"
import { resolvePublicTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"

export async function GET(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const tenant = await resolvePublicTenant(request)
  if (!tenant) return new NextResponse("Not found", { status: 404 })
  const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
  if (!claims || !await getQuoteSession(tenant.tenant_id, claims.sessionId)) return new NextResponse("Not found", { status: 404 })
  const { jobId } = await params
  const job = await getRenderJob({ tenantId: tenant.tenant_id, sessionId: claims.sessionId, jobId })
  if (!job) return new NextResponse("Not found", { status: 404 })
  const url = request.nextUrl.searchParams.get("kind") === "source" ? job.source_blob_url : job.result_blob_url
  if (!url) return new NextResponse("Not found", { status: 404 })
  const image = await readPrivateImage(url)
  return new NextResponse(image.bytes, {
    headers: { "Content-Type": image.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  })
}
