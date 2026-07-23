import "server-only"

import Stripe from "stripe"
import { launchCatalogMatches } from "@/lib/billing-pricing"
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
  const monthlyPriceId = process.env.STRIPE_SUBSCRIPTION_PRICE_ID
  const setupPriceId = process.env.STRIPE_SETUP_PRICE_ID
  const introCouponId = process.env.STRIPE_INTRO_COUPON_ID
  if (!monthlyPriceId || !setupPriceId || !introCouponId) {
    throw new Error("The $299 setup, $149 introductory, and $199 monthly Stripe pricing is not fully configured.")
  }
  const stripe = stripeClient()
  const [monthlyPrice, setupPrice, introCoupon] = await Promise.all([
    stripe.prices.retrieve(monthlyPriceId),
    stripe.prices.retrieve(setupPriceId),
    stripe.coupons.retrieve(introCouponId),
  ])
  if (!launchCatalogMatches({
    monthlyAmount: monthlyPrice.unit_amount,
    monthlyCurrency: monthlyPrice.currency,
    monthlyInterval: monthlyPrice.recurring?.interval,
    setupAmount: setupPrice.unit_amount,
    setupCurrency: setupPrice.currency,
    setupRecurring: Boolean(setupPrice.recurring),
    couponDeleted: "deleted" in introCoupon,
    couponAmountOff: "deleted" in introCoupon ? null : introCoupon.amount_off,
    couponCurrency: "deleted" in introCoupon ? null : introCoupon.currency,
    couponDuration: "deleted" in introCoupon ? undefined : introCoupon.duration,
    couponDurationMonths: "deleted" in introCoupon ? null : introCoupon.duration_in_months,
  })) {
    throw new Error("Stripe launch pricing does not match $299 setup, $149/month for three months, then $199/month.")
  }
  const customer = await ensureCustomer(input.tenantId)
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: monthlyPriceId, quantity: 1 },
    { price: setupPriceId, quantity: 1 },
  ]
  const launchMetadata: Record<string, string> = {}
  if (input.launch) {
    launchMetadata.launchDomain = input.launch.domain
    launchMetadata.launchSiteVersionId = input.launch.siteVersionId
    launchMetadata.launchApprovedBy = input.launch.approvedBy
  }
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    client_reference_id: input.tenantId,
    line_items: lineItems,
    discounts: [{ coupon: introCouponId }],
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
