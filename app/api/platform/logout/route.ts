import { NextResponse } from "next/server"
import { PLATFORM_ADMIN_COOKIE } from "@/lib/platform-admin-auth"
import { recordAuditEvent } from "@/lib/platform-db"
import { requestId, sameOrigin } from "@/lib/request-security"

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site sign-out requests are not allowed." }, { status: 403 })
  await recordAuditEvent({ actorType: "platform", actorId: "password-admin", action: "platform.sign_out", targetType: "admin_session", requestId: requestId(request) }).catch(() => undefined)
  const response = NextResponse.redirect(new URL("/platform", request.url), 303)
  response.cookies.set(PLATFORM_ADMIN_COOKIE, "", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 })
  return response
}
