import { NextRequest, NextResponse } from "next/server"
import { CONTRACTOR_COOKIE, createContractorSession } from "@/lib/contractor-auth"
import { getLatestTenantByEmail, verifyPassword } from "@/lib/platform-db"
import { checkRateLimit, clientIp, privacyHash, rateLimitResponse, sameOrigin } from "@/lib/request-security"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site sign-in requests are not allowed." }, { status: 403 })
    const body = await request.json() as { email?: string; password?: string }
    const email = body.email?.trim().toLowerCase() ?? ""
    const limit = await checkRateLimit({ request, scope: "contractor-login", identifier: privacyHash(`${clientIp(request)}:${email || "unknown"}`), limit: 10, windowSeconds: 900 })
    if (!limit.allowed) return rateLimitResponse(limit.retryAfter)
    const tenant = email ? await getLatestTenantByEmail(email) : null
    if (!tenant || !body.password || !(await verifyPassword(body.password, tenant.password_hash))) {
      return NextResponse.json({ error: "The email or password is incorrect." }, { status: 401 })
    }

    const response = NextResponse.json({ ok: true })
    response.cookies.set(CONTRACTOR_COOKIE, createContractorSession(tenant.tenant_id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sign-in is temporarily unavailable." }, { status: 503 })
  }
}
