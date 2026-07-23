import { randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { CONTRACTOR_COOKIE, createContractorSession } from "@/lib/contractor-auth"
import { createSignupTenant, hashPassword, registerTenantDomain } from "@/lib/platform-db"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"

export const runtime = "nodejs"

type SignupRequest = {
  companyName?: string
  contactName?: string
  email?: string
  phone?: string
  password?: string
  plan?: "demo" | "launch"
  acceptedTerms?: boolean
}

function projectSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72)
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site signup requests are not allowed." }, { status: 403 })
    const limit = await checkRateLimit({ request, scope: "signup", limit: 5, windowSeconds: 3600 })
    if (!limit.allowed) return rateLimitResponse(limit.retryAfter)
    const body = await request.json() as SignupRequest
    const companyName = body.companyName?.trim() ?? ""
    const contactName = body.contactName?.trim() ?? ""
    const email = body.email?.trim().toLowerCase() ?? ""
    const phone = body.phone?.trim() ?? ""
    const planCode = body.plan === "launch" ? "launch" : "demo"

    if (companyName.length < 2 || companyName.length > 120) {
      return NextResponse.json({ error: "Enter your gutter company name." }, { status: 400 })
    }
    if (contactName.length < 2 || contactName.length > 120) {
      return NextResponse.json({ error: "Enter the name of the person building this site." }, { status: 400 })
    }
    if (!validEmail(email) || email.length > 254) {
      return NextResponse.json({ error: "Enter a valid business email." }, { status: 400 })
    }
    if (phone.length < 7 || phone.length > 40) {
      return NextResponse.json({ error: "Enter a valid business phone number." }, { status: 400 })
    }
    if (!body.password || body.password.length < 12 || body.password.length > 200) {
      return NextResponse.json({ error: "Create a password with at least 12 characters." }, { status: 400 })
    }
    if (body.acceptedTerms !== true) {
      return NextResponse.json({ error: "Accept the demo terms and privacy notice to continue." }, { status: 400 })
    }

    const baseSlug = projectSlug(companyName) || "gutter-company"
    const passwordHash = await hashPassword(body.password)
    let tenant = null

    for (let attempt = 0; attempt < 5 && !tenant; attempt += 1) {
      const suffix = attempt === 0 ? "" : `-${randomUUID().slice(0, 6)}`
      tenant = await createSignupTenant({
        tenantId: `${baseSlug.slice(0, 72 - suffix.length)}${suffix}`,
        companyName,
        leadEmail: email,
        contactName,
        phone,
        passwordHash,
        planCode,
      })
    }

    if (!tenant) {
      return NextResponse.json({ error: "We could not reserve a workspace name. Please try again." }, { status: 409 })
    }
    if (process.env.TENANT_ROOT_DOMAIN) await registerTenantDomain({ tenantId: tenant.tenant_id, hostname: `${tenant.tenant_id}.${process.env.TENANT_ROOT_DOMAIN}`, verified: true, primary: true })

    const response = NextResponse.json({ ok: true, tenantId: tenant.tenant_id, plan: tenant.plan_code })
    response.cookies.set(CONTRACTOR_COOKIE, createContractorSession(tenant.tenant_id), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signup is temporarily unavailable." }, { status: 503 })
  }
}
