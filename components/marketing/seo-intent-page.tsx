import Link from "next/link"
import { ArrowRight, Check, House, Sparkles } from "lucide-react"

type SeoSection = { eyebrow: string; title: string; copy: string; bullets: string[] }
type SeoFaq = [string, string]

export function SeoIntentPage({
  eyebrow,
  title,
  description,
  proofLine,
  sections,
  faq,
  comparisonIntent = false,
}: {
  eyebrow: string
  title: string
  description: string
  proofLine: string
  sections: SeoSection[]
  faq: SeoFaq[]
  comparisonIntent?: boolean
}) {
  const faqSchema = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([name, text]) => ({ "@type": "Question", name, acceptedAnswer: { "@type": "Answer", text } })) }
  return <main className="sales-site contractor-landing growth-page seo-intent-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, "\\u003c") }} />
    <header className="sales-nav growth-nav"><Link href="/for-contractors" className="sales-brand"><span><House size={19} /><Sparkles size={11} /></span><b>HD Instant</b> Gutter Quote <small className="sales-brand-owner">by HD Precision</small></Link><nav><Link href="/for-contractors#how-it-works">How it works</Link><Link href="/for-contractors#roi">ROI</Link><Link href="/for-contractors#pricing">Pricing</Link></nav><div className="sales-nav__actions"><Link href="/sign-in">Sign in</Link><Link href="/sign-up" className="sales-button sales-button--small">Build Free <ArrowRight size={13} /></Link></div></header>
    <section className="seo-intent-hero"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p><div className="sales-hero__actions"><Link href="/sign-up" className="sales-button">Build My Free Quote Site <ArrowRight size={15} /></Link><Link href="/for-contractors#how-it-works" className="sales-button sales-button--ghost">See How It Works</Link></div><small>{proofLine}</small></div><aside><span>START WITH THE PRODUCT</span><h2>Build first.<br />Decide second.</h2><ul><li><Check size={14} /> No sales call</li><li><Check size={14} /> No credit card</li><li><Check size={14} /> Test real addresses</li><li><Check size={14} /> One free visualization</li></ul><Link href="/sign-up">Create my free account <ArrowRight size={14} /></Link></aside></section>
    {comparisonIntent && <section className="seo-price-snapshot"><div><span>MANAGED LAUNCH</span><strong>$149<small>/month for 3 months</small></strong><p>$299 setup · $199/month after</p></div><div><span>BUILD AND TEST</span><strong>$0<small>before approval</small></strong><p>No credit card to configure and preview the contractor experience.</p></div><p>Rendering credit packs are separate from the base subscription so high-use contractors pay for the AI previews they use.</p></section>}
    <section className="seo-intent-content">{sections.map((section) => <article key={section.title}><div><span>{section.eyebrow}</span><h2>{section.title}</h2><p>{section.copy}</p></div><ul>{section.bullets.map((bullet) => <li key={bullet}><Check size={15} />{bullet}</li>)}</ul></article>)}</section>
    <section className="seo-intent-faq"><div className="growth-heading"><span>COMMON QUESTIONS</span><h2>Make the comparison with clear information.</h2></div><div className="growth-faq-list">{faq.map(([question, answer]) => <details key={question}><summary>{question}<span>+</span></summary><p>{answer}</p></details>)}</div></section>
    <section className="growth-final-cta"><div><span>NO SALES CALL REQUIRED</span><h2>See your own gutter company inside the product.</h2><p>Build your branded quote site, test addresses you know, and preview the homeowner journey before paying.</p></div><Link href="/sign-up" className="sales-button">Build My Free Quote Site <ArrowRight size={16} /></Link></section>
    <footer className="sales-footer growth-footer"><div><Link href="/for-contractors" className="sales-brand"><span><House size={19} /><Sparkles size={11} /></span><b>HD Instant</b> Gutter Quote</Link><p>Turn your gutter website into a 24/7 estimator.</p></div><div><b>Software</b><Link href="/gutter-quote-software">Gutter quote software</Link><Link href="/instant-gutter-quote">Instant gutter quote</Link><Link href="/gutter-estimate-software">Estimate software</Link></div><div><b>Start</b><Link href="/sign-up">Build free</Link><Link href="/sign-in">Sign in</Link></div><div><b>Support</b><a href="tel:+19044789272">(904) 478-9272</a></div><small>© 2026 HD Precision. Online estimates are planning ranges subject to contractor verification.</small></footer>
  </main>
}
