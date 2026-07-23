import { NextRequest, NextResponse } from "next/server"
import { CONTRACTOR_COOKIE, createContractorSession } from "@/lib/contractor-auth"
import { DEFAULT_CONFIG } from "@/lib/company-config"
import { getTenant, verifyPassword } from "@/lib/platform-db"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site sign-in requests are not allowed." }, { status: 403 })
    const limit = await checkRateLimit({ request, scope: "legacy-contractor-login", limit: 10, windowSeconds: 900 })
    if (!limit.allowed) return rateLimitResponse(limit.retryAfter)
    const body = await request.json() as { password?: string }
    const tenant = await getTenant(DEFAULT_CONFIG.tenantId)
    if (!tenant || !body.password || !(await verifyPassword(body.password, tenant.password_hash))) {
      return NextResponse.json({ error: "The password is incorrect." }, { status: 401 })
    }
    const response = NextResponse.json({ ok: true })
    response.cookies.set(CONTRACTOR_COOKIE, createContractorSession(tenant.tenant_id), {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign-in is unavailable." }, { status: 503 })
  }
}
