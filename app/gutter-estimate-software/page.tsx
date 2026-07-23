import type { Metadata } from "next"
import { SeoIntentPage } from "@/components/marketing/seo-intent-page"

export const metadata: Metadata = {
  title: "Gutter Estimate Software for Lead Generation | HD Precision",
  description: "Contractor-controlled gutter estimate software that converts website visitors into property-specific leads with transparent planning ranges.",
}

export default function GutterEstimateSoftwarePage() {
  return <SeoIntentPage
    eyebrow="GUTTER ESTIMATE SOFTWARE"
    title="Estimate faster without giving up control of the final scope."
    description="Automate the early planning range while keeping product eligibility, pricing, territory, final measurements, and contracting decisions in your hands."
    proofLine="Built for lead qualification and homeowner education—not blind binding bids."
    sections={[
      {
        eyebrow: "CONFIGURABLE ESTIMATING",
        title: "Translate your pricing model into a consistent digital experience.",
        copy: "Set low and high price-per-foot values, product options, story multipliers, downspout assumptions, and service-area rules in the setup studio.",
        bullets: ["Low/high range pricing", "Story and complexity adjustments", "Downspout quantity and unit pricing", "Gutter-only, guard-only, and combined systems"],
      },
      {
        eyebrow: "PROPERTY SIGNALS",
        title: "Start the conversation with a measured property estimate.",
        copy: "The platform uses available mapping and property signals to estimate the gutter run, then keeps the exact calculation context attached to the lead.",
        bullets: ["Verified address", "Building outline estimate", "Linear feet and downspout assumptions", "Measurement provenance retained"],
      },
      {
        eyebrow: "COMMERCIAL OPERATIONS",
        title: "Run it as a sellable managed product.",
        copy: "Contractor authentication, tenant isolation, subscriptions, custom domains, lead retention, exports, secure rendering, and operational controls are part of the platform.",
        bullets: ["Organization-based contractor access", "Stripe subscription lifecycle", "Private rendering queue and credit ledger", "Audit, export, and deletion controls"],
      },
    ]}
    faq={[
      ["Is this estimating software multi-tenant?", "Yes. Contractors share one managed application while hostnames, organization access, configuration, quote sessions, leads, credits, and data policies remain tenant-scoped."],
      ["Can every contractor have different pricing?", "Yes. Each published tenant version contains that contractor's products, price ranges, territory, branding, contact information, and allowed widget origins."],
      ["How are leads delivered?", "Contact-provided and completed quotes are stored in the dashboard and delivered through a tenant-scoped email outbox with retries and idempotency."],
      ["What is required for production?", "Production uses Clerk, PostgreSQL, Stripe, Redis, Turnstile, private object storage, Google APIs, Gemini, Resend, and Vercel domain management."],
    ]}
  />
}
