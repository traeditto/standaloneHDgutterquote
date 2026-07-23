import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Managed Domain Terms | HD Instant Gutter Quote",
  description: "Terms for managed contractor domain registration and renewal.",
}

export default function DomainTermsPage() {
  return <LegalPage eyebrow="MANAGED DOMAIN AGREEMENT" title="Managed Domain Terms" intro="These additional terms apply when HD Precision purchases, connects, renews, or transfers a domain for a contractor’s quote website.">
    <section><h2>Domain selection</h2><p>You authorize HD Precision to check availability and, after successful launch payment, register the approved standard .com domain. Registration is limited to domains whose initial and renewal price do not exceed $15 unless HD Precision agrees otherwise in writing.</p></section>
    <section><h2>Registrant and management</h2><p>The domain may initially be registered and managed through HD Precision’s Vercel account using HD Precision’s administrative contact information so automated hosting, DNS, certificates, and renewal can operate. You receive exclusive use of the domain for your active quote website, subject to these Terms and applicable registrar and registry rules.</p></section>
    <section><h2>Your representations</h2><p>You represent that the requested domain and its use do not infringe another party’s trademark, trade name, privacy, publicity, or other rights. You are responsible for resolving disputes concerning your selected name and for providing accurate business information.</p></section>
    <section><h2>Renewal</h2><p>Managed domains are set to auto-renew while the related paid service remains active and the registrar account has a valid payment method. Renewal is not guaranteed if payment fails, a registry changes its rules or price, the domain is disputed, or the service has been canceled or suspended.</p></section>
    <section><h2>Cancellation and transfer</h2><p>After cancellation, you may request transfer of an eligible domain to an account you control, provided the account is paid and registrar transfer restrictions have expired. You are responsible for accepting the transfer and future renewal charges. If you do not complete a requested transfer or reactivate service before expiration, the domain may expire and become available to others.</p></section>
    <section><h2>No guarantee</h2><p>Searching for or approving a domain does not reserve it. Availability and price can change before the registrar confirms the purchase. If registration fails, HD Precision will ask you to select another eligible name rather than represent that the unavailable domain was acquired.</p></section>
  </LegalPage>
}
