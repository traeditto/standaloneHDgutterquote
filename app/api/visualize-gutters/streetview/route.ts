import { NextRequest, NextResponse } from "next/server"
import { verifyAddressToken } from "@/lib/address-verification"
import { getQuoteSession } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { fetchStreetViewMetadata } from "@/lib/roof-imagery"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { resolvePublicTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site Street View requests are not allowed." }, { status: 403 })
  const body = await request.json().catch(() => ({})) as { sessionId?: string; addressToken?: string }
  const sessionId = body.sessionId?.trim() || ""
  const tenant = await resolvePublicTenant(request)
  if (!tenant) return NextResponse.json({ error: "This quote site is not registered." }, { status: 404 })
  const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
  if (!claims || claims.sessionId !== sessionId || !await getQuoteSession(tenant.tenant_id, sessionId)) {
    return NextResponse.json({ error: "The quote session is invalid or expired." }, { status: 401 })
  }
  const verified = verifyAddressToken(body.addressToken || "", tenant.tenant_id, sessionId)
  if (!verified) return NextResponse.json({ error: "The verified property is invalid or expired." }, { status: 400 })
  const rate = await checkRateLimit({ request, scope: "streetview-metadata", identifier: `${tenant.tenant_id}:${sessionId}`, limit: 12, windowSeconds: 3600 })
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter)
  try {
    return NextResponse.json(await fetchStreetViewMetadata(verified.address))
  } catch (error) {
    return NextResponse.json({ available: false, error: error instanceof Error ? error.message : "Street View is unavailable." }, { status: 503 })
  }
}
