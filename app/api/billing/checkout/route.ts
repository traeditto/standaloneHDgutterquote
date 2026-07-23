import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { resolveContractorTenant } from "@/lib/tenant-context"
import { sameOrigin } from "@/lib/request-security"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  try {
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site billing requests are not allowed." }, { status: 403 })
    const tenant = await resolveContractorTenant(request)
    if (!tenant) {
      return NextResponse.json({ error: "Sign in to purchase credits." }, { status: 401 })
    }
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_RENDER_PRICE_ID) {
      return NextResponse.json({ error: "Stripe render-credit billing is not configured." }, { status: 503 })
    }
    const tenantId = tenant.tenant_id
    if (!["active", "grace"].includes(tenant.access_state)) {
      return NextResponse.json({ error: "Activate the managed website subscription before purchasing production render credits." }, { status: 402 })
    }
    const credits = Math.max(1, Number(process.env.RENDER_CREDITS_PER_PACK || 100))
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const origin = new URL(request.url).origin
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: process.env.STRIPE_RENDER_PRICE_ID, quantity: 1 }],
      ...(tenant.stripe_customer_id ? { customer: tenant.stripe_customer_id } : { customer_email: tenant.lead_email }),
      success_url: `${origin}/contractor?credits=purchased`,
      cancel_url: `${origin}/contractor?credits=cancelled`,
      metadata: { tenantId, renderCredits: String(credits) },
    })
    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkout could not be created." }, { status: 503 })
  }
}
