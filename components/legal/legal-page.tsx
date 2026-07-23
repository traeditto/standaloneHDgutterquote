import Link from "next/link"
import { LEGAL_TERMS_VERSION, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_HREF } from "@/lib/legal"

export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string
  title: string
  intro: string
  children: React.ReactNode
}) {
  return <main className="legal-page">
    <header className="legal-nav">
      <Link href="/for-contractors"><b>HD Instant</b> Gutter Quote <small>by HD Precision</small></Link>
      <nav><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/domain-terms">Domains</Link></nav>
    </header>
    <article>
      <small>{eyebrow}</small>
      <h1>{title}</h1>
      <p className="legal-intro">{intro}</p>
      <p className="legal-updated">Effective and last updated: {LEGAL_TERMS_VERSION}</p>
      {children}
      <section>
        <h2>Contact</h2>
        <p>Questions may be directed to HD Precision at <a href={SUPPORT_PHONE_HREF}>{SUPPORT_PHONE_DISPLAY}</a>.</p>
      </section>
    </article>
    <footer><span>© 2026 HD Precision</span><Link href="/for-contractors">Return to product site</Link></footer>
  </main>
}
