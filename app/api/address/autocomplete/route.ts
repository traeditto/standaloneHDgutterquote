import { NextRequest, NextResponse } from "next/server"
import { autocompleteGoogleAddresses } from "@/lib/google-places"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant, resolvePublicTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"

type AutocompleteBody = { input?: string; sessionToken?: string }

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site address requests are not allowed." }, { status: 403 })
    const publicTenant = await resolvePublicTenant(request)
    const tenant = publicTenant ?? await resolveContractorTenant(request)
    if (!tenant) return NextResponse.json({ error: "This quote site is not registered." }, { status: 404 })
    if (publicTenant && !["active", "grace"].includes(tenant.access_state)) {
      return NextResponse.json({ error: "This quote service is temporarily unavailable." }, { status: 402 })
    }
    const rate = await checkRateLimit({ request, scope: "address-autocomplete", identifier: tenant.tenant_id, limit: 180, windowSeconds: 60 })
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter)

    const body = await request.json() as AutocompleteBody
    const input = body.input?.trim() || ""
    const sessionToken = body.sessionToken?.trim() || ""
    if (input.length < 3) return NextResponse.json({ suggestions: [] })
    if (input.length > 180 || !/^[a-zA-Z0-9_-]{8,100}$/.test(sessionToken)) {
      return NextResponse.json({ error: "Enter a valid property address." }, { status: 400 })
    }
    return NextResponse.json({ suggestions: await autocompleteGoogleAddresses(input, sessionToken) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Address suggestions are temporarily unavailable."
    return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 502 })
  }
}
