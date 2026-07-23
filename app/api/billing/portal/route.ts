import { NextRequest, NextResponse } from "next/server"
import { createBillingPortal } from "@/lib/stripe-billing"
import { resolveContractorTenant } from "@/lib/tenant-context"
import { sameOrigin } from "@/lib/request-security"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site billing requests are not allowed." }, { status: 403 })
    const tenant = await resolveContractorTenant(request)
    if (!tenant) {
      return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 })
    }
    const origin = new URL(request.url).origin
    const portal = await createBillingPortal({ tenantId: tenant.tenant_id, returnUrl: `${origin}/contractor` })
    return NextResponse.json({ url: portal.url })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The billing portal is unavailable." }, { status: 503 })
  }
}
