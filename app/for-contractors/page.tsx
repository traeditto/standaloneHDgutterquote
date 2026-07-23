import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Droplets,
  Eye,
  Globe2,
  House,
  MailCheck,
  MapPin,
  Palette,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Zap,
} from "lucide-react"
import { RoiCalculator } from "@/components/marketing/roi-calculator"

export const metadata: Metadata = {
  title: "Instant Gutter Quote Websites for Contractors | HD Precision",
  description: "Build a branded instant gutter quote site, test real addresses, control products and per-foot pricing, and launch only after you approve it.",
  alternates: { canonical: "/for-contractors" },
  openGraph: {
    title: "Turn Your Gutter Website Into a 24/7 Estimator",
    description: "Branded gutter estimates, product choices, visualization, lead delivery, and a managed contractor portal.",
    type: "website",
  },
}

const advantages = [
  [Clock3, "Build before you buy", "Configure your brand, service area, products, and pricing before checkout."],
  [Settings2, "Control every price", "Set per-linear-foot gutter and guard pricing by building height, plus downspout pricing."],
  [BadgeCheck, "White labeled", "Your company name, logo, colors, contact information, products, and warranties."],
  [MapPin, "Property-aware", "Verify the address, confirm the home, and estimate the gutter run from available property data."],
  [Palette, "Gutter visualization", "Let homeowners preview a selected finish on their own home when imagery is available."],
  [Code2, "Website widget included", "Launch a standalone campaign page and add the quote experience to an existing website."],
  [BarChart3, "Funnel visibility", "See address starts, contact-complete prospects, finished quotes, and rendering usage."],
  [ShieldCheck, "Managed platform", "One secure platform handles domains, billing, updates, retention, and tenant isolation."],
] as const

const journey = [
  [House, "Homeowner visits", "Your website offers a useful answer instead of another generic contact form."],
  [MapPin, "Property is confirmed", "The address and service area are verified before measurement begins."],
  [Droplets, "Gutter run is estimated", "Available footprint and property data create a planning linear-foot estimate."],
  [UserRoundCheck, "Contact is captured", "The homeowner provides contact details before contractor pricing is revealed."],
  [Settings2, "Products are compared", "They compare gutter sizes, guards, warranties, finishes, and installed pricing."],
  [Sparkles, "The finish is visualized", "A Street View image or uploaded photo becomes a gutter color preview."],
  [CheckCircle2, "Quote is completed", "The contractor receives the property, product, pricing, and contact context."],
  [MailCheck, "Your team follows up", "The opportunity is emailed and stored in the contractor dashboard."],
] as const

export default function ForContractorsPage() {
  return (
    <main className="sales-site contractor-landing growth-page">
      <header className="sales-nav growth-nav">
        <Link href="/for-contractors" className="sales-brand" aria-label="HD Instant Gutter Quote home">
          <span><Droplets size={19} /><Sparkles size={11} /></span><b>HD Instant</b> Gutter Quote <small className="sales-brand-owner">by HD Precision</small>
        </Link>
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#features">Features</a><a href="#roi">ROI</a><a href="#pricing">Pricing</a></nav>
        <div className="sales-nav__actions"><Link href="/sign-in">Sign in</Link><Link href="/sign-up" className="sales-button sales-button--small">Build Free <ArrowRight size={14} /></Link></div>
      </header>

      <section className="growth-hero">
        <div className="growth-hero__glow" />
        <div className="growth-hero__copy">
          <div className="sales-kicker"><span><Zap size={13} /></span> Instant gutter estimates without the onboarding drag</div>
          <h1>Turn Your Gutter Website Into a <em>24/7 Estimator</em></h1>
          <p>Give homeowners property-specific gutter pricing, system choices, finish options, and a visual preview—then send the complete opportunity to your team.</p>
          <div className="sales-hero__actions"><Link href="/sign-up" className="sales-button">Build My Free Quote Site <ArrowRight size={16} /></Link><a href="#how-it-works" className="sales-button sales-button--ghost">See the homeowner journey</a></div>
          <div className="growth-trust-line"><span><Check size={13} /> No sales call</span><span><Check size={13} /> No credit card</span><span><Check size={13} /> Preview before launch</span></div>
        </div>
        <div className="growth-product-preview">
          <div className="growth-browser-bar"><i /><i /><i /><span>quote.yourguttercompany.com</span></div>
          <div className="growth-product-preview__body">
            <small>INSTANT GUTTER QUOTE</small><h2>What will new gutters cost for your home?</h2>
            <div className="growth-demo-address"><MapPin size={16} /><span>123 Main Street</span><ArrowRight size={15} /></div>
            <div className="growth-demo-result"><span><Droplets size={18} /></span><div><b>Estimated gutter run</b><strong>184 linear ft</strong><small>Planning estimate · field verification required</small></div></div>
          </div>
        </div>
      </section>

      <section className="growth-switch" id="features">
        <div className="growth-heading"><span>BUILT FOR GUTTER CONTRACTORS</span><h2>A sellable quote product, not another calculator.</h2><p>The homeowner experience, contractor workspace, billing, domains, lead delivery, rendering controls, and platform operations live together.</p></div>
        <div className="growth-advantage-grid">{advantages.map(([Icon, title, copy]) => <article key={title}><span><Icon size={20} /></span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="growth-journey" id="how-it-works">
        <div className="growth-heading growth-heading--light"><span>HOMEOWNER JOURNEY</span><h2>Every step earns the next click.</h2><p>Start with the property, deliver useful pricing context, then give the contractor a better-qualified follow-up opportunity.</p></div>
        <div className="growth-timeline">{journey.map(([Icon, title, copy], index) => <article key={title}><span><Icon size={18} /></span><div><small>0{index + 1}</small><h3>{title}</h3><p>{copy}</p></div></article>)}</div>
      </section>

      <section className="growth-roi" id="roi">
        <div className="growth-heading growth-heading--light"><span>CONVERSION OPPORTUNITY</span><h2>Model the value with your own numbers.</h2><p>This calculator is directional and makes no revenue guarantee.</p></div>
        <RoiCalculator />
      </section>

      <section className="growth-pricing" id="pricing">
        <div className="growth-heading">
          <span>LOW-FRICTION PRICING</span>
          <h2>Build it free. Pay when it has earned your confidence.</h2>
          <p>No sales call, credit card, or setup fee is required to create and test your private gutter quote site.</p>
        </div>
        <div className="growth-price-layout">
          <article className="growth-price-card">
            <small>FREE BUILD</small>
            <h3><span>$</span>0</h3>
            <p>Build your branded gutter experience, test real addresses, and use one visualization.</p>
            <ul>
              <li><Check size={15} /> Self-service account and gutter template</li>
              <li><Check size={15} /> Your products, colors, pricing, and service area</li>
              <li><Check size={15} /> Complete private homeowner preview</li>
              <li><Check size={15} /> One demo visualization</li>
              <li><Check size={15} /> No credit card</li>
            </ul>
            <Link href="/sign-up" className="sales-button sales-button--outline">Build My Free Quote Site <ArrowRight size={15} /></Link>
          </article>
          <article className="growth-price-card growth-price-card--paid">
            <small>LAUNCH</small>
            <h3><span>$</span>149 <em>/month</em></h3>
            <p><b>First three months</b> · then $199/month</p>
            <div className="growth-setup-fee">
              <strong>$299 one-time setup</strong>
              <span>Production activation, domain connection, standalone site, widget delivery, lead routing, dashboard access, and launch verification.</span>
            </div>
            <ul>
              <li><Check size={15} /> White-labeled standalone gutter quote site</li>
              <li><Check size={15} /> Website widget and install code</li>
              <li><Check size={15} /> Lead email delivery and contractor portal</li>
              <li><Check size={15} /> Managed domain and platform updates</li>
              <li><Check size={15} /> Hosting, security, and ongoing product updates</li>
              <li><Check size={15} /> Additional visualization credit packs available</li>
            </ul>
            <Link href="/sign-up" className="sales-button">See Mine Before I Pay <ArrowRight size={15} /></Link>
          </article>
        </div>
        <div className="growth-savings">
          <span><BadgeCheck size={20} /></span>
          <p><b>Build before you buy.</b> Your first-year platform fees total $2,537 before optional visualization packs, and payment begins only after you approve the private homeowner experience.</p>
        </div>
      </section>

      <section className="growth-final-cta"><div><span>NO PAYMENT TO BUILD</span><h2>Put your gutter company inside the product.</h2><p>Configure real systems and pricing, test familiar properties, and approve the full homeowner journey before launch.</p></div><Link href="/sign-up" className="sales-button">Start Free <ArrowRight size={16} /></Link></section>
      <footer className="sales-footer growth-footer"><div><Link href="/for-contractors" className="sales-brand"><span><Droplets size={19} /></span><b>HD Instant</b> Gutter Quote</Link><p>Turn website visitors into price-ready gutter leads.</p></div><div><b>Product</b><Link href="/instant-gutter-quote">Instant gutter quote</Link><Link href="/gutter-quote-software">Gutter quote software</Link></div><div><b>Account</b><Link href="/sign-up">Build free</Link><Link href="/sign-in">Sign in</Link></div><div><b>Legal & support</b><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/domain-terms">Managed domains</Link><a href="tel:+19044789272">(904) 478-9272</a></div><small>© 2026 HD Precision. Online gutter estimates are planning ranges subject to field verification.</small></footer>
    </main>
  )
}
