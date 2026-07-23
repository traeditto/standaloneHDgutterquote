import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"

export const metadata: Metadata = {
  title: "Privacy Policy | HD Instant Gutter Quote",
  description: "How HD Instant Gutter Quote collects, uses, secures, and retains information.",
}

export default function PrivacyPage() {
  return <LegalPage eyebrow="PRIVACY NOTICE" title="Privacy Policy" intro="This Policy explains how HD Precision processes contractor account information, homeowner quote information, website activity, and service records.">
    <section><h2>Information we collect</h2><p>We collect contractor account and business information, configuration and billing identifiers, service-area and pricing data, support communications, security and audit records, and usage information. During homeowner quotes we may process an address, property imagery, quote selections, name, email, phone number, and resulting estimate.</p></section>
    <section><h2>How information is used</h2><p>We use information to create accounts, provide private previews and production quote sites, verify addresses, generate estimates and visualizations, deliver leads, process payments, register managed domains, secure and monitor the service, prevent abuse, support users, meet legal obligations, and improve reliability.</p></section>
    <section><h2>Contractor and HD Precision roles</h2><p>The contractor determines how homeowner leads are used for its sales and service activities and is responsible for its own privacy notice and legal basis for follow-up. HD Precision processes homeowner information to provide the hosted quote service and may also process limited information for security, billing, fraud prevention, and legal compliance.</p></section>
    <section><h2>Service providers</h2><p>Information may be processed by providers supporting hosting and domains, databases and private storage, authentication, maps and imagery, artificial intelligence, payments, email delivery, abuse prevention, analytics, and monitoring. Providers receive only the information reasonably necessary for their function and operate under their own contractual and legal obligations.</p></section>
    <section><h2>Retention</h2><p>Source and generated render images are scheduled for deletion after 24 hours. Abandoned quotes are retained for up to 90 days. Completed leads are retained for up to 24 months by default, subject to a shorter contractor setting or a valid deletion request. Security, billing, audit, and legal records may be retained longer where reasonably necessary.</p></section>
    <section><h2>Security</h2><p>We use access controls, tenant isolation, encryption in transit, encryption for stored lead contact fields, private object storage, signed sessions and webhooks, rate limiting, audit logs, and retention controls. No system can guarantee absolute security.</p></section>
    <section><h2>Choices and requests</h2><p>Contractor owners can export account data and delete individual leads through the dashboard. Homeowners may contact the contractor that received their quote or HD Precision to request access, correction, or deletion, subject to identity verification and legal exceptions.</p></section>
    <section><h2>Cookies and analytics</h2><p>Essential cookies maintain authenticated contractor and quote sessions and protect the service. Analytics or advertising tags may be used on the contractor-marketing site when configured. Tenant quote sites may include contractor-selected advertising integrations disclosed by that contractor.</p></section>
    <section><h2>Children and geographic scope</h2><p>The service is intended for adults requesting gutter services and is not directed to children under 13. The service is operated in the United States; information may be processed in the United States and other locations used by service providers.</p></section>
  </LegalPage>
}
