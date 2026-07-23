import { NextResponse } from "next/server"
import Stripe from "stripe"
import {
  addRenderCredits,
  applySubscriptionState,
  beginStripeEvent,
  completeStripeEvent,
  getTenant,
  getTenantByStripeCustomerId,
  recordAuditEvent,
  releaseStripeEvent,
  type StripeSubscriptionStatus,
} from "@/lib/platform-db"
import { retrieveSubscription } from "@/lib/stripe-billing"
import { provisionManagedTenantDomain } from "@/lib/domain-provisioning"

export const runtime = "nodejs"

function customerId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null) {
  return typeof value === "string" ? value : value?.id ?? null
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const legacy = subscription as Stripe.Subscription & { current_period_end?: number }
  const timestamp = legacy.current_period_end ?? subscription.items.data[0]?.current_period_end
  return timestamp ? new Date(timestamp * 1000) : null
}

async function resolveTenantId(input: { metadata?: Stripe.Metadata | null; customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null }) {
  const metadataTenant = input.metadata?.tenantId
  if (metadataTenant) return metadataTenant
  const id = customerId(input.customer ?? null)
  if (!id) return null
  return (await getTenantByStripeCustomerId(id))?.tenant_id ?? null
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const tenantId = await resolveTenantId({ metadata: subscription.metadata, customer: subscription.customer })
  if (!tenantId) throw new Error(`No tenant is mapped to Stripe subscription ${subscription.id}.`)
  const tenant = await applySubscriptionState({
    tenantId,
    subscriptionId: subscription.id,
    customerId: customerId(subscription.customer),
    status: subscription.status as StripeSubscriptionStatus,
    periodEnd: subscriptionPeriodEnd(subscription),
  })
  await recordAuditEvent({ tenantId, actorType: "system", actorId: subscription.id, action: "billing.subscription_updated", targetType: "subscription", targetId: subscription.id, metadata: { status: subscription.status } })
  const launchDomain = subscription.metadata.launchDomain
  const launchSiteVersionId = subscription.metadata.launchSiteVersionId
  if (tenant.access_state === "active" && launchDomain && launchSiteVersionId) {
    await provisionManagedTenantDomain({
      tenantId,
      siteVersionId: launchSiteVersionId,
      domain: launchDomain,
      actorId: subscription.metadata.launchApprovedBy || subscription.id,
      requestId: subscription.id,
      allowOwnedDomain: true,
    })
  }
  return tenant
}

async function syncInvoice(invoice: Stripe.Invoice, status: "active" | "past_due") {
  const tenantId = await resolveTenantId({ customer: invoice.customer })
  if (!tenantId) return
  const subscriptionRef = invoice.parent?.subscription_details?.subscription
  const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id
  if (subscriptionId) {
    const subscription = await retrieveSubscription(subscriptionId)
    if (status === "active") return syncSubscription(subscription)
    const tenant = await applySubscriptionState({
      tenantId,
      subscriptionId,
      customerId: customerId(invoice.customer),
      status: "past_due",
      periodEnd: subscriptionPeriodEnd(subscription),
    })
    return tenant
  }
}

export async function POST(request: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 })
  }
  const signature = request.headers.get("stripe-signature")
  if (!signature) return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 })

  let event: Stripe.Event
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    event = stripe.webhooks.constructEvent(await request.text(), signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid Stripe signature." }, { status: 400 })
  }

  const claimed = await beginStripeEvent(event.id, event.type)
  if (!claimed) return NextResponse.json({ received: true, duplicate: true })

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object
      if (session.mode === "payment") {
        const tenantId = session.metadata?.tenantId
        const credits = Number(session.metadata?.renderCredits)
        if (session.payment_status === "paid" && tenantId && Number.isSafeInteger(credits) && credits > 0) {
          await addRenderCredits(tenantId, credits, "stripe_credit_pack", `stripe:${event.id}`)
          await recordAuditEvent({ tenantId, actorType: "system", actorId: event.id, action: "billing.credits_added", targetType: "tenant", targetId: tenantId, metadata: { credits } })
        }
      } else if (session.mode === "subscription") {
        const tenantId = session.client_reference_id || session.metadata?.tenantId
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id
        if (tenantId && subscriptionId) {
          const subscription = await retrieveSubscription(subscriptionId)
          await syncSubscription(subscription)
        }
      }
    } else if (["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
      await syncSubscription(event.data.object as Stripe.Subscription)
    } else if (event.type === "invoice.paid") {
      await syncInvoice(event.data.object, "active")
    } else if (event.type === "invoice.payment_failed") {
      await syncInvoice(event.data.object, "past_due")
    }

    await completeStripeEvent(event.id)
    return NextResponse.json({ received: true })
  } catch (error) {
    await releaseStripeEvent(event.id).catch(() => undefined)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Webhook processing failed." }, { status: 500 })
  }
}
