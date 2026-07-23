import { NextRequest, NextResponse } from "next/server"
import {
  type CompanyConfig,
  matchConfiguredServiceCounty,
  type ServiceAreas,
  STATE_NAMES,
} from "@/lib/company-config"
import { createAddressToken } from "@/lib/address-verification"
import { resolveGoogleAddress } from "@/lib/google-places"
import { bindQuoteSessionAddress, getQuoteSession } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant, resolvePublicTenant, tenantCompanyConfig } from "@/lib/tenant-context"

export const runtime = "nodejs"

type ResolveBody = {
  placeId?: string
  sessionToken?: string
  quoteSessionId?: string
  testMode?: boolean
  testServiceAreas?: ServiceAreas
}

function previewConfig(body: ResolveBody, fallback: CompanyConfig): CompanyConfig {
  if (!body.testMode || !body.testServiceAreas) return fallback
  const serviceAreas = Object.fromEntries(
    Object.entries(body.testServiceAreas)
      .filter(([state, counties]) => Boolean(STATE_NAMES[state]) && Array.isArray(counties))
      .map(([state, counties]) => [state, counties.filter((county) => typeof county === "string").slice(0, 200)]),
  )
  return { ...fallback, serviceAreas }
}

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ code: "ORIGIN_MISMATCH", error: "Cross-site address requests are not allowed." }, { status: 403 })
    const body = await request.json() as ResolveBody
    const tenant = body.testMode ? await resolveContractorTenant(request) : await resolvePublicTenant(request)
    if (!tenant) return NextResponse.json({ error: body.testMode ? "Sign in to use private test mode." : "This quote site is not registered." }, { status: body.testMode ? 401 : 404 })
    if (!body.testMode && !["active", "grace"].includes(tenant.access_state)) {
      return NextResponse.json({ error: "This quote service is temporarily unavailable." }, { status: 402 })
    }
    const rate = await checkRateLimit({ request, scope: "address-resolve", identifier: tenant.tenant_id, limit: 120, windowSeconds: 60 })
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter)

    const placeId = body.placeId?.trim() || ""
    const sessionToken = body.sessionToken?.trim() || ""
    const quoteSessionId = body.quoteSessionId?.trim() || ""
    if (
      !placeId || placeId.length > 300 ||
      !/^[a-zA-Z0-9_-]{8,100}$/.test(sessionToken) ||
      !/^[a-f0-9-]{36}$/i.test(quoteSessionId)
    ) return NextResponse.json({ error: "Select a valid property address from the Google suggestions." }, { status: 400 })

    const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
    if (!claims || claims.sessionId !== quoteSessionId || !await getQuoteSession(tenant.tenant_id, quoteSessionId)) {
      return NextResponse.json({ code: "INVALID_QUOTE_SESSION", error: "Your quote session expired. Refresh the page and try again." }, { status: 401 })
    }

    const resolved = await resolveGoogleAddress(placeId, sessionToken)
    const config = previewConfig(body, await tenantCompanyConfig(tenant))
    const county = matchConfiguredServiceCounty(config, resolved.state, resolved.county)
    if (!county) {
      return NextResponse.json({
        error: `This property is in ${resolved.county}, ${STATE_NAMES[resolved.state] ?? resolved.state}, outside this contractor's configured service area.`,
      }, { status: 422 })
    }

    const verifiedAddress = { ...resolved, county }
    if (!await bindQuoteSessionAddress({ tenantId: tenant.tenant_id, sessionId: quoteSessionId, placeId: resolved.placeId })) {
      return NextResponse.json({ code: "ADDRESS_SESSION_MISMATCH", error: "This quote session is already connected to a different property." }, { status: 409 })
    }
    return NextResponse.json({
      ...verifiedAddress,
      token: createAddressToken(verifiedAddress, tenant.tenant_id, quoteSessionId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The property address could not be verified."
    return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 502 })
  }
}
