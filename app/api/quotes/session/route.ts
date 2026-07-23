import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createQuoteSession } from "@/lib/platform-db"
import { createQuoteSessionToken, QUOTE_SESSION_COOKIE } from "@/lib/quote-session-auth"
import { checkRateLimit, clientIp, privacyHash, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant, resolvePublicTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"

const bodySchema = z.object({ testMode: z.boolean().optional().default(false), embedded: z.boolean().optional().default(false) }).strict()

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ code: "ORIGIN_MISMATCH", error: "Cross-site quote sessions are not allowed." }, { status: 403 })
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ code: "INVALID_REQUEST", error: "The quote-session request was invalid." }, { status: 400 })

  const tenant = parsed.data.testMode ? await resolveContractorTenant(request) : await resolvePublicTenant(request)
  if (!tenant) return NextResponse.json({ code: "UNKNOWN_TENANT", error: "This quote site is not registered or available." }, { status: 404 })
  if (!parsed.data.testMode && !["active", "grace"].includes(tenant.access_state)) {
    return NextResponse.json({ code: "SITE_UNAVAILABLE", error: "This quote service is temporarily unavailable." }, { status: 402 })
  }

  const limit = await checkRateLimit({ request, scope: "quote-session", limit: 20, windowSeconds: 3600 })
  if (!limit.allowed) return rateLimitResponse(limit.retryAfter)

  const ip = clientIp(request)
  const session = await createQuoteSession({
    tenantId: tenant.tenant_id,
    ipHash: privacyHash(ip),
    userAgentHash: privacyHash(request.headers.get("user-agent") || "unknown"),
  })
  const expiresAt = new Date(session.expires_at).getTime()
  const response = NextResponse.json({ sessionId: session.id, expiresAt, renderLimit: 4 })
  response.cookies.set(QUOTE_SESSION_COOKIE, createQuoteSessionToken({ tenantId: tenant.tenant_id, sessionId: session.id, expiresAt }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: parsed.data.embedded ? "none" : "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
    ...(parsed.data.embedded ? { partitioned: true } : {}),
  })
  return response
}
