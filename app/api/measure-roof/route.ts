import { NextRequest, NextResponse } from "next/server"
import { verifyAddressToken } from "@/lib/address-verification"
import { getQuoteSession } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant, resolvePublicTenant } from "@/lib/tenant-context"
import { measureRoofFromAddress, measureRoofFromLatLon } from "@/lib/roof-measure-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type MeasureBody = { sessionId?: string; addressToken?: string; lat?: number; lon?: number }

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site measurement requests are not allowed." }, { status: 403 })
  let body: MeasureBody
  try { body = await request.json() as MeasureBody } catch { return NextResponse.json({ error: "Invalid request body." }, { status: 400 }) }
  const sessionId = body.sessionId?.trim() || ""
  const addressToken = body.addressToken?.trim() || ""
  if (!/^[a-f0-9-]{36}$/i.test(sessionId) || addressToken.length < 20 || addressToken.length > 2_000) {
    return NextResponse.json({ error: "A verified property address is required." }, { status: 400 })
  }

  try {
    const publicTenant = await resolvePublicTenant(request)
    const tenant = publicTenant ?? await resolveContractorTenant(request)
    if (!tenant) return NextResponse.json({ error: "This quote site is not registered." }, { status: 404 })
    if (publicTenant && !["active", "grace"].includes(tenant.access_state)) return NextResponse.json({ error: "This quote service is temporarily unavailable." }, { status: 402 })
    const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
    if (!claims || claims.sessionId !== sessionId || !await getQuoteSession(tenant.tenant_id, sessionId)) {
      return NextResponse.json({ error: "Your quote session expired. Refresh the page and try again." }, { status: 401 })
    }
    const rate = await checkRateLimit({ request, scope: "gutter-measure", identifier: `${tenant.tenant_id}:${sessionId}`, limit: 5, windowSeconds: 3600 })
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter)
    const verified = verifyAddressToken(addressToken, tenant.tenant_id, sessionId)
    if (!verified) return NextResponse.json({ error: "The verified property address is invalid or expired." }, { status: 400 })

    const coordinatesProvided = Number.isFinite(body.lat) && Number.isFinite(body.lon)
    const result = coordinatesProvided
      ? await measureRoofFromLatLon(Number(body.lat), Number(body.lon), verified.address, { state: verified.state, county: verified.county })
      : await measureRoofFromAddress(verified.address, { state: verified.state, county: verified.county })
    if (result.status === "out-of-area") return NextResponse.json({ reason: "out-of-area", county: result.county ?? null, matchedAddress: result.matchedAddress ?? null }, { status: 422 })
    if (result.status === "not-found") return NextResponse.json({ error: "No reliable building record was found for this property." }, { status: 404 })
    return NextResponse.json({ ...result.measurement, matchedAddress: result.matchedAddress })
  } catch {
    return NextResponse.json({ error: "The property measurement service is temporarily unavailable." }, { status: 502 })
  }
}
