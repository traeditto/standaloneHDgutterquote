import { clerkMiddleware } from "@clerk/nextjs/server"
import { NextFetchEvent, NextRequest, NextResponse } from "next/server"
import { readWidgetToken } from "@/lib/widget-auth"

const withClerk = clerkMiddleware()

const CLERK_SOURCES = "https://*.clerk.accounts.dev https://*.clerk.com https://clerk.hdinstantgutterquote.com https://accounts.hdinstantgutterquote.com"
const CONTENT_POLICY = `default-src 'self'; base-uri 'self'; form-action 'self' https://checkout.stripe.com; object-src 'none'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://challenges.cloudflare.com ${CLERK_SOURCES}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://maps.gstatic.com https://*.clerk.com https://img.clerk.com; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://challenges.cloudflare.com ${CLERK_SOURCES}; frame-src https://challenges.cloudflare.com ${CLERK_SOURCES} https://checkout.stripe.com; upgrade-insecure-requests`

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === "/embed") {
    const claims = readWidgetToken(request.nextUrl.searchParams.get("token"))
    if (!claims) return new NextResponse("Widget authorization expired or is invalid.", { status: 403, headers: { "Content-Security-Policy": `${CONTENT_POLICY}; frame-ancestors 'none'` } })
    const response = NextResponse.next()
    response.headers.set("Content-Security-Policy", `${CONTENT_POLICY}; frame-ancestors ${claims.parentOrigin}`)
    response.headers.delete("X-Frame-Options")
    return response
  }
  const clerkResponse = process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
    ? await withClerk(request, event)
    : null
  const response = clerkResponse ?? NextResponse.next()
  response.headers.set("Content-Security-Policy", `${CONTENT_POLICY}; frame-ancestors 'self'`)
  response.headers.set("X-Frame-Options", "SAMEORIGIN")
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
