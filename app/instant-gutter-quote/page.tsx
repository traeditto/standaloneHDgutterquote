import type { Metadata } from "next"
import { SeoIntentPage } from "@/components/marketing/seo-intent-page"

export const metadata: Metadata = {
  title: "Instant Gutter Quote for Contractor Websites | HD Precision",
  description: "Add a fast, branded instant gutter estimate to your website and capture qualified homeowner leads around the clock.",
}

export default function InstantGutterQuotePage() {
  return <SeoIntentPage
    eyebrow="INSTANT GUTTER QUOTES"
    title="Let homeowners price gutter options while intent is high."
    description="Homeowners enter a verified address, review estimated gutter-run measurements, compare your systems, and request an inspection without waiting for a callback."
    proofLine="A fast planning estimate backed by your products, pricing rules, and service area."
    sections={[
      {
        eyebrow: "AVAILABLE AFTER HOURS",
        title: "Your estimator keeps working when your office is closed.",
        copy: "Give late-night and weekend visitors a useful next step immediately, then route their contact and quote context to your team.",
        bullets: ["Mobile-first homeowner flow", "Address and service-area validation", "Instant configured price ranges", "Automatic lead notification"],
      },
      {
        eyebrow: "QUALIFIED CONTEXT",
        title: "Receive more than a name and phone number.",
        copy: "Every completed journey can include the property, estimated gutter footage, downspout assumptions, chosen system, selected color, and price range.",
        bullets: ["Property-specific quote session", "Product and color preference", "Address-start and completed-quote tracking", "Contractor dashboard history"],
      },
      {
        eyebrow: "CLEAR EXPECTATIONS",
        title: "Position the number as a planning range.",
        copy: "The experience repeatedly explains that final measurements, drainage design, fascia condition, access, and installation scope require contractor verification.",
        bullets: ["No hidden claim of a binding price", "Inspection call-to-action", "Contractor-controlled disclaimer", "Transparent range methodology"],
      },
    ]}
    faq={[
      ["How fast is the homeowner flow?", "Most homeowners can reach configured product pricing in about a minute after selecting a verified address."],
      ["What happens if the property is outside my service area?", "The quote flow checks your published state and county coverage before creating the estimate."],
      ["Does it replace an on-site inspection?", "No. It gives homeowners a planning range and helps your team prioritize follow-up. Final measurements and scope remain with the contractor."],
      ["Can homeowners see gutter colors on their home?", "Yes. The managed product supports controlled AI visualization from available Street View imagery or an uploaded exterior photo."],
    ]}
  />
}
