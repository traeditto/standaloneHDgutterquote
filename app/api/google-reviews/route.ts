import { NextRequest, NextResponse } from "next/server"
import { getGoogleReviewSummary, validGooglePlaceId } from "@/lib/google-places"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant, resolvePublicTenant, tenantCompanyConfig } from "@/lib/tenant-context"

export const runtime = "nodejs"

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Google reviews are temporarily unavailable."
  if (/API key|permission|billing|configured/i.test(message)) return "Google reviews are temporarily unavailable."
  return message.slice(0, 220)
}

export async function GET(request: NextRequest) {
  const tenant = await resolvePublicTenant(request) ?? await resolveContractorTenant(request)
  if (!tenant) return NextResponse.json({ error: "Quote site not found." }, { status: 404 })

  const rate = await checkRateLimit({ request, scope: "google-reviews-public", identifier: tenant.tenant_id, limit: 120, windowSeconds: 3600 })
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter)

  const config = await tenantCompanyConfig(tenant)
  if (!config.showGoogleReviews || !validGooglePlaceId(config.googlePlaceId)) {
    return NextResponse.json({ enabled: false })
  }

  try {
    return NextResponse.json({ enabled: true, summary: await getGoogleReviewSummary(config.googlePlaceId) })
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 502 })
  }
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 })
  const tenant = await resolveContractorTenant(request)
  if (!tenant) return NextResponse.json({ error: "Sign in to connect Google reviews." }, { status: 401 })

  const rate = await checkRateLimit({ request, scope: "google-reviews-preview", identifier: tenant.tenant_id, limit: 20, windowSeconds: 3600 })
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter)

  const body = await request.json().catch(() => ({})) as { placeId?: unknown }
  const placeId = typeof body.placeId === "string" ? body.placeId.trim() : ""
  if (!validGooglePlaceId(placeId)) return NextResponse.json({ error: "Enter a valid Google Place ID." }, { status: 400 })

  try {
    return NextResponse.json({ enabled: true, summary: await getGoogleReviewSummary(placeId) })
  } catch (error) {
    return NextResponse.json({ error: safeError(error) }, { status: 502 })
  }
}
