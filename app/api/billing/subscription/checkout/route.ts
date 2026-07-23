import { NextRequest, NextResponse } from "next/server"
import type { CompanyConfig } from "@/lib/company-config"
import { updateTenantProfile } from "@/lib/platform-db"
import { sameOrigin } from "@/lib/request-security"
import { createSubscriptionCheckout } from "@/lib/stripe-billing"
import { resolveContractorTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site checkout requests are not allowed." }, { status: 403 })
    const tenant = await resolveContractorTenant(request)
    if (!tenant) return NextResponse.json({ error: "Sign in to your contractor workspace before checkout." }, { status: 401 })
    const body = await request.json() as { config?: CompanyConfig }
    if (!body.config?.companyName || !(body.config.leadEmail || body.config.email)) return NextResponse.json({ error: "Complete the company configuration first." }, { status: 400 })
    await updateTenantProfile({ tenantId: tenant.tenant_id, companyName: body.config.companyName, leadEmail: body.config.leadEmail || body.config.email, planCode: "launch" })
    const origin = new URL(request.url).origin
    const url = await createSubscriptionCheckout({ tenantId: tenant.tenant_id, returnUrl: `${origin}/setup` })
    return NextResponse.json({ url, tenantId: tenant.tenant_id })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Subscription checkout could not be created." }, { status: 503 })
  }
}
