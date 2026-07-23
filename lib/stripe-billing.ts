import "server-only"

import Stripe from "stripe"
import { getTenant, updateTenantStripeCustomer } from "@/lib/platform-db"

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured.")
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

async function ensureCustomer(tenantId: string) {
  const tenant = await getTenant(tenantId)
  if (!tenant) throw new Error("Contractor account not found.")
  if (tenant.stripe_customer_id) return tenant.stripe_customer_id

  const customer = await stripeClient().customers.create({
    email: tenant.lead_email,
    name: tenant.company_name,
    metadata: { tenantId },
  })
  await updateTenantStripeCustomer(tenantId, customer.id)
  return customer.id
}

export async function createSubscriptionCheckout(input: {
  tenantId: string
  returnUrl: string
  launch?: { domain: string; siteVersionId: string; approvedBy: string }
}) {
  if (!process.env.STRIPE_SUBSCRIPTION_PRICE_ID) {
    throw new Error("STRIPE_SUBSCRIPTION_PRICE_ID is not configured.")
  }
  const customer = await ensureCustomer(input.tenantId)
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: process.env.STRIPE_SUBSCRIPTION_PRICE_ID, quantity: 1 },
  ]
  if (process.env.STRIPE_SETUP_PRICE_ID) {
    lineItems.push({ price: process.env.STRIPE_SETUP_PRICE_ID, quantity: 1 })
  }
  const introCoupon = process.env.STRIPE_INTRO_COUPON_ID
  const launchMetadata: Record<string, string> = {}
  if (input.launch) {
    launchMetadata.launchDomain = input.launch.domain
    launchMetadata.launchSiteVersionId = input.launch.siteVersionId
    launchMetadata.launchApprovedBy = input.launch.approvedBy
  }
  const session = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: input.tenantId,
    line_items: lineItems,
    ...(introCoupon
      ? { discounts: [{ coupon: introCoupon }] }
      : { allow_promotion_codes: true }),
    success_url: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}subscription=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}subscription=cancelled`,
    metadata: { tenantId: input.tenantId, ...launchMetadata },
    subscription_data: { metadata: { tenantId: input.tenantId, ...launchMetadata } },
  })
  if (!session.url) throw new Error("Stripe did not return a Checkout URL.")
  return session.url
}

export async function createBillingPortal(input: { tenantId: string; returnUrl: string }) {
  const customer = await ensureCustomer(input.tenantId)
  return stripeClient().billingPortal.sessions.create({ customer, return_url: input.returnUrl })
}

export async function retrieveSubscription(subscriptionId: string) {
  return stripeClient().subscriptions.retrieve(subscriptionId)
}
