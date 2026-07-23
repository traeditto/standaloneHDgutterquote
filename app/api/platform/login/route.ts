import { NextRequest, NextResponse } from "next/server"
import { createPlatformAdminSession, PLATFORM_ADMIN_COOKIE, verifyPlatformCredentials } from "@/lib/platform-admin-auth"
import { recordAuditEvent } from "@/lib/platform-db"
import { checkRateLimit, rateLimitResponse, requestId, sameOrigin } from "@/lib/request-security"

export async function POST(request: NextRequest) {
  try {
    if (process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return NextResponse.json({ error: "Platform staff must sign in with Clerk and MFA." }, { status: 410 })
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site sign-in requests are not allowed." }, { status: 403 })
    const limit = await checkRateLimit({ request, scope: "platform-login", limit: 5, windowSeconds: 900 })
    if (!limit.allowed) return rateLimitResponse(limit.retryAfter)
    const body = await request.json() as { email?: string; password?: string }
    if (
      !body.email ||
      !body.password ||
      body.email.length > 254 ||
      body.password.length > 256 ||
      !verifyPlatformCredentials(body.email, body.password)
    ) {
      return NextResponse.json({ error: "The credentials are invalid." }, { status: 401 })
    }
    const response = NextResponse.json({ ok: true })
    const adminEmail = body.email.trim().toLowerCase()
    response.cookies.set(PLATFORM_ADMIN_COOKIE, createPlatformAdminSession(adminEmail), {
      httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12,
    })
    await recordAuditEvent({ actorType: "platform", actorId: adminEmail, action: "platform.sign_in", targetType: "admin_session", requestId: requestId(request) }).catch(() => undefined)
    return response
  } catch {
    return NextResponse.json({ error: "Admin sign-in is temporarily unavailable." }, { status: 503 })
  }
}
