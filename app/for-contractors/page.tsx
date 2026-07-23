import type { CSSProperties } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarCheck,
  Calculator,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  Droplets,
  Globe2,
  House,
  MailCheck,
  MapPin,
  MoonStar,
  Palette,
  Ruler,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserRoundCheck,
  X,
  Zap,
} from "lucide-react"
import { RoiCalculator } from "@/components/marketing/roi-calculator"

export const metadata: Metadata = {
  title: "Book More Gutter Estimates 24/7 | HD Instant Gutter Quote",
  description: "Turn gutter website traffic into qualified, price-ready appointments with a white-labeled instant estimate experience that works around the clock.",
  alternates: { canonical: "/for-contractors" },
  openGraph: {
    title: "Turn Website Visitors Into Booked Gutter Estimates—24/7",
    description: "Give homeowners answers now, capture better opportunities, and keep your gutter sales pipeline moving after hours.",
    type: "website",
  },
}

const outcomes = [
  [Clock3, "Capture the lead before a competitor does", "Give homeowners a useful next step the moment they are ready—even after your office closes.", "24/7 lead capture"],
  [CalendarCheck, "Turn curiosity into booked appointments", "Move visitors from “what might this cost?” to a clear estimate and a committed next step.", "Appointment-ready leads"],
  [BadgeCheck, "Sell with your brand, not ours", "Your logo, colors, products, warranties, pricing, domain, and service area stay front and center.", "Fully white labeled"],
  [Settings2, "Protect your margins on every quote", "You control pricing by product, home height, gutter guard, downspout, finish, and service area.", "Contractor-controlled pricing"],
  [Palette, "Make the upgrade easier to picture", "Show homeowners how selected gutter colors can look on their home before the sales visit.", "Visual buying confidence"],
  [MailCheck, "Give salespeople a warmer conversation", "Send the address, property context, selected system, estimate range, and contact details to your team.", "Qualified lead handoff"],
] as const

const journey = [
  [MapPin, "Address entered", "The homeowner starts with the property—not a long contact form."],
  [Ruler, "AI measures home", "Available property data produces a planning gutter-run estimate."],
  [Sparkles, "Gutters render", "The home becomes a visual buying experience when imagery is available."],
  [Palette, "Color changes", "They explore finishes and options without waiting for a salesperson."],
  [Calculator, "Instant estimate", "Your configured pricing turns selections into a clear planning range."],
  [CalendarCheck, "Appointment booked", "Your team receives a price-aware opportunity with useful context."],
] as const

const comparisonRows = [
  ["Answers after hours", "Instant, guided experience", "Waits for office follow-up", "Usually a form or calculator"],
  ["Property-specific context", "Address, home, run estimate, products", "Collected manually on-site", "Often generic assumptions"],
  ["Visual buying confidence", "Color preview when imagery is available", "Samples during appointment", "Rarely integrated"],
  ["Contractor brand control", "Full white-label experience", "Your brand, but labor-heavy", "Vendor branding or limited control"],
  ["Lead quality", "Price-aware with product selections", "Depends on phone conversation", "Basic contact details"],
  ["Launch and upkeep", "Managed platform and guided activation", "More staff time and follow-up", "DIY setup and disconnected tools"],
] as const

const afterHours = [
  ["8:47 PM", "A homeowner notices failing gutters", "They open your website from the couch instead of leaving a voicemail."],
  ["8:48 PM", "Your website starts the sale", "The address is confirmed and the property moves into the guided estimate."],
  ["8:49 PM", "They build confidence", "They compare products, see a planning range, and preview a finish."],
  ["8:51 PM", "Your next opportunity is ready", "The lead and project context reach your team for the next business day."],
] as const

const trustPoints = [
  [BadgeCheck, "White labeled", "Your company owns the customer experience"],
  [Code2, "No-code setup", "Configure products and pricing yourself"],
  [Smartphone, "Mobile ready", "Built for homeowners on any screen"],
  [ShieldCheck, "Managed platform", "Hosting, security, and updates included"],
  [Globe2, "Standalone + widget", "Launch on a domain or existing website"],
] as const

const faqs = [
  ["Will the estimate replace my on-site inspection?", "No. Homeowners receive a planning estimate based on available property information and your configured pricing. Final scope and pricing remain subject to field verification."],
  ["Can I control what homeowners see and what they pay?", "Yes. You configure the service area, gutter systems, guards, downspouts, colors, warranties, and pricing rules used in the homeowner experience."],
  ["Does it look like my company or HD Precision?", "The launched experience is white labeled with your company name, logo, colors, contact details, products, domain, and warranties."],
  ["Do I need a developer to install it?", "No. You can launch a managed standalone quote site and receive widget install code for an existing website. The platform handles hosting and ongoing product updates."],
  ["Can I see my version before paying?", "Yes. Build and test the private homeowner experience first. No credit card or setup payment is required until you approve it for production launch."],
] as const

function StatusCell({ children, positive = false }: { children: string; positive?: boolean }) {
  return <span className={positive ? "is-positive" : "is-limited"}>{positive ? <CheckCircle2 size={15} /> : <X size={15} />}{children}</span>
}

export default function ForContractorsPage() {
  return (
    <main className="sales-site contractor-landing growth-page">
      <header className="sales-nav growth-nav">
        <Link href="/for-contractors" className="sales-brand" aria-label="HD Instant Gutter Quote home">
          <span><Droplets size={19} /><Sparkles size={11} /></span><b>HD Instant</b> Gutter Quote <small className="sales-brand-owner">by HD Precision</small>
        </Link>
        <nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#roi">ROI</a><a href="#compare">Compare</a><a href="#pricing">Pricing</a></nav>
        <div className="sales-nav__actions"><Link href="/sign-in">Sign in</Link><Link href="/sign-up" className="sales-button sales-button--small">See It On My Website <ArrowRight size={14} /></Link></div>
      </header>

      <section className="growth-hero" aria-labelledby="hero-title">
        <div className="growth-hero__glow" />
        <div className="growth-hero__copy">
          <div className="sales-kicker"><span><Zap size={13} /></span> 24/7 quoting and appointment capture</div>
          <h1 id="hero-title">Turn Website Visitors Into <em>Booked Gutter Estimates</em>—24/7.</h1>
          <p>Give homeowners the answers they want now—property-aware pricing, product options, and a visual preview—then hand your team a better-qualified sales opportunity.</p>
          <div className="sales-hero__actions"><Link href="/sign-up" className="sales-button">See It On My Website <ArrowRight size={16} /></Link><a href="#how-it-works" className="sales-button sales-button--ghost">Watch Live Demo <ArrowRight size={15} /></a></div>
          <div className="growth-trust-line"><span><Check size={13} /> Build your version free</span><span><Check size={13} /> No credit card</span><span><Check size={13} /> Approve before launch</span></div>
        </div>
        <div className="growth-product-preview" aria-label="Example homeowner gutter estimate">
          <div className="growth-browser-bar"><i /><i /><i /><span>estimate.yourguttercompany.com</span><small>LIVE</small></div>
          <div className="growth-product-preview__body">
            <div className="growth-preview-status" aria-hidden="true"><span className="is-active">1</span><i /><span className="is-active">2</span><i /><span className="is-active">3</span><i /><span className="is-active">✓</span></div>
            <small>YOUR INSTANT GUTTER ESTIMATE</small><h2>Your project is ready for the next step.</h2>
            <div className="growth-demo-address"><MapPin size={16} /><span>123 Main Street, Jacksonville, FL</span><CheckCircle2 size={15} /></div>
            <div className="growth-demo-result"><span><Calculator size={18} /></span><div><b>Planning estimate</b><strong>$2,840–$3,420</strong><small>184 linear ft · 6&quot; seamless aluminum · field verification required</small></div></div>
            <div className="growth-demo-booking"><span><CalendarCheck size={18} /></span><div><b>Estimate appointment requested</b><small>Tomorrow · Morning window</small></div><em>NEW LEAD</em></div>
          </div>
        </div>
      </section>

      <section className="growth-trust-rail" aria-label="Platform implementation and trust">
        {trustPoints.map(([Icon, title, copy]) => <article key={title}><span><Icon size={17} /></span><div><b>{title}</b><small>{copy}</small></div></article>)}
      </section>

      <section className="growth-switch" id="features" aria-labelledby="outcomes-title">
        <div className="growth-heading"><span>MORE VALUE FROM THE TRAFFIC YOU ALREADY HAVE</span><h2 id="outcomes-title">Stop losing ready-to-buy homeowners to “we’ll call you tomorrow.”</h2><p>HD Instant Gutter Quote turns your website into a guided sales experience that educates, qualifies, and moves the homeowner toward an appointment before interest cools.</p></div>
        <div className="growth-advantage-grid">{outcomes.map(([Icon, title, copy, proof]) => <article key={title}><span><Icon size={20} /></span><small>{proof}</small><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>

      <section className="growth-journey" id="how-it-works" aria-labelledby="journey-title">
        <div className="growth-heading growth-heading--light"><span>WATCH THE SALE HAPPEN</span><h2 id="journey-title">From an address to a booked appointment in one guided flow.</h2><p>No phone tag. No blank “contact us” form. Each step gives the homeowner more confidence and gives your sales team more context.</p></div>
        <ol className="growth-timeline">
          {journey.map(([Icon, title, copy], index) => <li key={title} style={{ "--journey-delay": `${index * .7}s` } as CSSProperties}><span><Icon size={18} /></span><div><small>0{index + 1}</small><h3>{title}</h3><p>{copy}</p></div></li>)}
        </ol>
        <div className="growth-journey-result"><span><MailCheck size={20} /></span><div><b>The homeowner gets clarity. Your team gets a reason to call.</b><p>Every completed journey arrives with the property, selections, estimate context, and contact details attached.</p></div><Link href="/sign-up">Build My Live Demo <ArrowRight size={15} /></Link></div>
      </section>

      <section className="growth-after-hours" aria-labelledby="after-hours-title">
        <div className="growth-after-hours__copy">
          <span><MoonStar size={15} /> WHAT HAPPENS WHILE YOU SLEEP</span>
          <h2 id="after-hours-title">Your office closes. Your best lead of the day does not.</h2>
          <p>Homeowners shop when the leak is on their mind—not when your calendar is convenient. Give them a useful answer tonight and let your team wake up to a warmer opportunity tomorrow.</p>
          <Link href="/sign-up" className="sales-button sales-button--outline">Start Closing More Jobs <ArrowRight size={15} /></Link>
        </div>
        <div className="growth-night-feed" aria-label="Example after-hours homeowner journey">
          <header><span><i /> LIVE WEBSITE ACTIVITY</span><small>After hours</small></header>
          <ol>{afterHours.map(([time, title, copy], index) => <li key={time}><time>{time}</time><span className={index === afterHours.length - 1 ? "is-complete" : ""}>{index === afterHours.length - 1 ? <Check size={13} /> : index + 1}</span><div><b>{title}</b><p>{copy}</p></div></li>)}</ol>
          <footer><CalendarCheck size={18} /><div><b>New price-aware opportunity</b><small>Ready for tomorrow&apos;s follow-up</small></div><em>BOOKED</em></footer>
        </div>
      </section>

      <section className="growth-roi" id="roi" aria-labelledby="roi-title">
        <div className="growth-heading growth-heading--light"><span>TURN CONVERSION LIFT INTO REAL NUMBERS</span><h2 id="roi-title">See what a few more booked estimates could be worth.</h2><p>Use your traffic, close rate, and average ticket to model the potential business impact of helping more website visitors take the next step.</p></div>
        <RoiCalculator />
      </section>

      <section className="growth-comparison" id="compare" aria-labelledby="comparison-title">
        <div className="growth-heading"><span>WHY IT WINS</span><h2 id="comparison-title">A complete homeowner sales journey beats another contact form.</h2><p>Traditional quoting depends on office hours and staff follow-up. Generic tools provide a number. HD Instant Gutter Quote connects the estimate, visual experience, brand, lead context, and managed launch.</p></div>
        <div className="growth-comparison-callout">
          <div><small>HD INSTANT GUTTER QUOTE</small><h3>Moves the homeowner toward a decision.</h3><p>Property context, your pricing, visual confidence, and appointment intent live in one branded journey.</p></div>
          <div><small>THE OLD WAY</small><h3>Makes the homeowner wait—or keep shopping.</h3><p>Voicemails, generic forms, manual takeoffs, disconnected visualization tools, and repeated data entry add friction.</p></div>
        </div>
        <div className="growth-compare-table">
          <table>
            <caption>Comparison of HD Instant Gutter Quote, traditional phone and form quoting, and generic quote tools.</caption>
            <thead><tr><th scope="col">Sales experience</th><th scope="col">HD Instant Gutter Quote</th><th scope="col">Phone calls and forms</th><th scope="col">Generic quote tools</th></tr></thead>
            <tbody>{comparisonRows.map(([label, hd, traditional, generic]) => <tr key={label}><th scope="row">{label}</th><td data-label="HD Instant Gutter Quote"><StatusCell positive>{hd}</StatusCell></td><td data-label="Phone calls and forms"><StatusCell>{traditional}</StatusCell></td><td data-label="Generic quote tools"><StatusCell>{generic}</StatusCell></td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section className="growth-proof" aria-labelledby="trust-title">
        <div className="growth-heading"><span>ENTERPRISE FEEL. CONTRACTOR-SIMPLE.</span><h2 id="trust-title">Launch like software. Operate like a service.</h2><p>You get the polished customer experience of a premium platform without hiring developers, stitching together tools, or surrendering control of your brand.</p></div>
        <div className="growth-proof-grid">
          <article><strong>100%</strong><h3>Your brand</h3><p>Your logo, colors, pricing, products, warranties, and domain shape the complete experience.</p></article>
          <article><strong>No-code</strong><h3>Your control</h3><p>Update the contractor configuration without starting a development project.</p></article>
          <article><strong>Any screen</strong><h3>Homeowner ready</h3><p>A responsive buying journey designed for phones, tablets, and desktops.</p></article>
          <article className="growth-proof-grid__case"><small>RISK-REVERSING IMPLEMENTATION</small><blockquote>Build your private version, test real addresses, and approve the complete experience before you pay to launch.</blockquote><p><b>No credit card to build.</b> Managed activation when you are ready.</p></article>
        </div>
      </section>

      <section className="growth-pricing" id="pricing" aria-labelledby="pricing-title">
        <div className="growth-heading">
          <span>BUILD BEFORE YOU BUY</span>
          <h2 id="pricing-title">See your company inside the product before spending a dollar.</h2>
          <p>Configure your brand, pricing, products, and service area. Test the complete homeowner journey. Pay only when you approve it for production launch.</p>
        </div>
        <div className="growth-price-layout">
          <article className="growth-price-card">
            <small>PRIVATE BUILD</small>
            <h3><span>$</span>0</h3>
            <p>Prove the experience with your real business before making a launch decision.</p>
            <ul>
              <li><Check size={15} /> Your brand, products, pricing, and service area</li>
              <li><Check size={15} /> Complete private homeowner journey</li>
              <li><Check size={15} /> Real address testing</li>
              <li><Check size={15} /> One demo visualization</li>
              <li><Check size={15} /> No credit card</li>
            </ul>
            <Link href="/sign-up" className="sales-button sales-button--outline">See It On My Website <ArrowRight size={15} /></Link>
          </article>
          <article className="growth-price-card growth-price-card--paid">
            <small>MANAGED LAUNCH</small>
            <h3><span>$</span>149 <em>/month</em></h3>
            <p><b>First three months</b> · then $199/month</p>
            <div className="growth-setup-fee">
              <strong>$299 one-time setup</strong>
              <span>Production activation, domain connection, standalone site, widget delivery, lead routing, dashboard access, and launch verification.</span>
            </div>
            <ul>
              <li><Check size={15} /> White-labeled standalone quote site</li>
              <li><Check size={15} /> Website widget and install code</li>
              <li><Check size={15} /> Lead email delivery and contractor portal</li>
              <li><Check size={15} /> Managed domain and platform updates</li>
              <li><Check size={15} /> Hosting, security, and ongoing product updates</li>
              <li><Check size={15} /> Additional visualization credit packs available</li>
            </ul>
            <Link href="/sign-up" className="sales-button">Launch My 24/7 Estimator <ArrowRight size={15} /></Link>
          </article>
        </div>
        <div className="growth-savings">
          <span><BadgeCheck size={20} /></span>
          <p><b>A lower-risk path to launch.</b> First-year platform fees total $2,537 before optional visualization packs, and payment begins only after you approve the private homeowner experience.</p>
        </div>
      </section>

      <section className="growth-faq" aria-labelledby="faq-title">
        <div className="growth-heading"><span>STRAIGHT ANSWERS</span><h2 id="faq-title">What contractors ask before they launch.</h2><p>Clear expectations build better partnerships. Here is what the platform does—and where your professional field verification still matters.</p></div>
        <div className="growth-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div>
      </section>

      <section className="growth-final-cta"><div><span>YOUR NEXT WEBSITE VISITOR COULD BE YOUR NEXT SOLD JOB</span><h2>Let your website start the sales conversation.</h2><p>Build the private version with your brand, products, and pricing. See exactly what homeowners will experience before you decide to launch.</p></div><Link href="/sign-up" className="sales-button">Start Closing More Jobs <ArrowRight size={16} /></Link></section>
      <footer className="sales-footer growth-footer"><div><Link href="/for-contractors" className="sales-brand"><span><Droplets size={19} /></span><b>HD Instant</b> Gutter Quote</Link><p>Turn website visitors into price-ready gutter opportunities.</p></div><div><b>Product</b><a href="#how-it-works">How it works</a><a href="#compare">Compare</a><a href="#pricing">Pricing</a></div><div><b>Account</b><Link href="/sign-up">Build my demo</Link><Link href="/sign-in">Sign in</Link></div><div><b>Legal & support</b><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/domain-terms">Managed domains</Link><a href="tel:+19044789272">(904) 478-9272</a></div><small>© 2026 HD Precision. Online gutter estimates are planning ranges subject to field verification.</small></footer>
    </main>
  )
}
