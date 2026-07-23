import type { Metadata } from "next"
import { SeoIntentPage } from "@/components/marketing/seo-intent-page"

export const metadata: Metadata = {
  title: "Gutter Quote Software for Contractors | HD Instant Gutter Quote",
  description: "Give homeowners an instant, branded gutter estimate while your team controls products, service areas, pricing, leads, and follow-up.",
}

export default function GutterQuoteSoftwarePage() {
  return <SeoIntentPage
    eyebrow="GUTTER QUOTE SOFTWARE"
    title="A branded online estimator built for gutter contractors."
    description="Turn homeowner traffic into qualified estimate requests with address validation, measured gutter-run estimates, configurable products, and contractor-controlled pricing."
    proofLine="Configure and test the complete experience before approving your launch."
    sections={[
      {
        eyebrow: "YOUR BRAND AND PRICING",
        title: "Sell the gutter systems your company actually installs.",
        copy: "Configure service areas, per-foot price bands, story adjustments, downspout pricing, colors, guard options, and homeowner messaging from one contractor workspace.",
        bullets: ["Your logo, colors, phone, and domain", "County and state service-area controls", "Product-specific pricing ranges", "Lead delivery and quote history"],
      },
      {
        eyebrow: "A BETTER FIRST CONVERSATION",
        title: "Give homeowners useful context before the inspection.",
        copy: "The instant estimate is a transparent planning range—not a binding contract. Your team receives the property, product preference, contact details, and quote context needed for a productive follow-up.",
        bullets: ["Verified property address", "Estimated linear footage and downspouts", "Selected product and finish", "Clear inspection and verification disclaimer"],
      },
      {
        eyebrow: "ONE MANAGED PRODUCT",
        title: "Use a standalone quote site or embed it on your current website.",
        copy: "Each contractor gets a secure tenant workspace and branded homeowner experience on the shared managed platform. Updates ship once while tenant data and configuration remain isolated.",
        bullets: ["Custom-domain support", "Responsive website widget", "Contractor sign-in and dashboard", "Subscription, credits, and account controls"],
      },
    ]}
    faq={[
      ["Does it calculate a final contract price?", "No. It creates a contractor-configured planning range. The contractor confirms measurements, drainage requirements, condition, access, and final scope during the inspection."],
      ["Can I use my own gutter products and pricing?", "Yes. Contractors configure the systems, colors, price-per-foot ranges, per-story adjustments, downspout assumptions, and service areas they offer."],
      ["Can it work with my existing website?", "Yes. Use a dedicated quote domain or install the responsive widget on an approved website origin."],
      ["Can I test before paying?", "Yes. Build the workspace, test real addresses, and use one free visualization before approval and checkout."],
    ]}
  />
}
