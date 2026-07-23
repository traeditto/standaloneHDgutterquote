import Link from "next/link"
import { redirect } from "next/navigation"
import { DEFAULT_CONFIG, IS_DEPLOYED_COMPANY_SITE, STATE_NAMES } from "@/lib/company-config"
import { listLeads } from "@/lib/platform-db"
import { resolveCurrentContractorTenant, tenantCompanyConfig } from "@/lib/tenant-context"
import { ContractorLogin } from "@/components/contractor/contractor-login"
import { BuyCreditsButton } from "@/components/contractor/buy-credits-button"
import { ManageBillingButton } from "@/components/contractor/manage-billing-button"
import { ContractorPortalHeader } from "@/components/contractor/portal-header"
import { WidgetInstallCard } from "@/components/contractor/widget-install-card"

export const dynamic = "force-dynamic"

export default async function ContractorPage() {
  const authenticatedTenant = await resolveCurrentContractorTenant()
  if (!authenticatedTenant) {
    if (!IS_DEPLOYED_COMPANY_SITE) redirect(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "/sign-in" : "/signup?mode=login")
    return <ContractorLogin companyName={DEFAULT_CONFIG.companyName} />
  }
  const tenantId = authenticatedTenant.tenant_id
  if (IS_DEPLOYED_COMPANY_SITE && tenantId !== DEFAULT_CONFIG.tenantId) return <ContractorLogin companyName={DEFAULT_CONFIG.companyName} />

  try {
    const [tenant, leads] = [authenticatedTenant, await listLeads(tenantId)]
    const publishedConfig = await tenantCompanyConfig(tenant)
    const completed = leads.filter((lead) => lead.status === "completed").length
    const contactProvided = leads.filter((lead) => lead.status !== "completed" && lead.name).length
    const addressOnly = leads.filter((lead) => lead.status !== "completed" && !lead.name).length
    const incomplete = contactProvided + addressOnly
    const graceEnd = tenant.grace_ends_at ? new Date(tenant.grace_ends_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : null
    return <main className="contractor-shell">
      <ContractorPortalHeader companyName={tenant.company_name} active="dashboard" websiteUrl={tenant.deployment_url} />
      {tenant.access_state === "inactive" && <section className="billing-warning"><div><b>Private demo workspace</b><p>Your template is saved, but no production website has been published. Finish the preview and approve the $499 setup plus $199/month for three months, then $249/month, when you are ready.</p></div><Link href="/setup">Continue building</Link></section>}
      {tenant.access_state === "active" && !tenant.deployment_url && <section className="billing-warning"><div><b>Payment active · publication waiting</b><p>Return to your approved template to attach the managed domain and publish the website.</p></div><Link href="/setup">Publish approved site</Link></section>}
      {tenant.access_state === "grace" && <section className="billing-warning"><div><b>Payment needs attention</b><p>Your website remains active during the grace period{graceEnd ? ` through ${graceEnd}` : ""}. Update payment details to avoid suspension.</p></div><ManageBillingButton /></section>}
      {tenant.access_state === "suspended" && <section className="billing-warning billing-warning--danger"><div><b>Website suspended</b><p>Quote collection and rendering are disabled until the subscription is reactivated.</p></div><ManageBillingButton /></section>}
      <section className="contractor-stats">
        <article><span>Subscription</span><strong className={`subscription-state subscription-state--${tenant.access_state}`}>{tenant.access_state}</strong>{tenant.stripe_customer_id ? <ManageBillingButton /> : <small>{tenant.plan_code === "launch" ? "$199/month for 3 months, then $249/month" : "Free demo"}</small>}</article>
        {tenant.access_state === "inactive"
          ? <article><span>Free demo render</span><strong>{tenant.demo_render_used_at ? 0 : 1}</strong><small>{tenant.demo_render_used_at ? "Used in your private preview" : "Try it in your private preview"}</small></article>
          : <article><span>Render credits</span><strong>{tenant.render_credits}</strong>{["active", "grace"].includes(tenant.access_state) ? <BuyCreditsButton /> : <small>Available after reactivation</small>}</article>}
        <article><span>Completed quotes</span><strong>{completed}</strong><small>Customer reached the estimate</small></article>
        <article><span>Contact provided</span><strong>{contactProvided}</strong><small>Still choosing gutter options</small></article>
        <article><span>Address-only prospects</span><strong>{addressOnly}</strong><small>Stopped before contact details</small></article>
      </section>
      <section className="contractor-actions">
        <article><span>WEBSITE TEMPLATE</span><h2>Control what homeowners see.</h2><p>Edit installed prices, gutter systems, manufacturers, product colors, service counties, branding, and lead delivery. Draft changes save to your account; publishing creates a new approved version of the live site.</p><Link href="/setup">Edit current website</Link></article>
        <article><span>FOLLOW-UP OPPORTUNITIES</span><h2>{incomplete} incomplete quote{incomplete === 1 ? "" : "s"}.</h2><p>Review verified properties that stopped before the final estimate, including address-only starts and prospects who provided contact details.</p><Link href="/contractor/abandoned">View abandoned addresses</Link></article>
        <article><span>CUSTOMER EXPERIENCE</span><h2>Preview before publishing.</h2><p>Test the complete homeowner journey with your current draft. Preview tests do not create production leads, send emails, or consume rendering credits.</p><Link href="/preview" target="_blank">Open private preview</Link></article>
        <article><span>DATA CONTROLS</span><h2>Download your account data.</h2><p>Organization owners and administrators can export lead, domain, configuration, credit, and audit records.</p><a href="/api/contractor/data/export">Export account data</a></article>
        <WidgetInstallCard quoteUrl={tenant.deployment_url} allowedOrigins={publishedConfig.widgetAllowedOrigins} />
      </section>
      <section className="lead-table-card"><header><div><h2>Quote starts and leads</h2><p>Verified addresses are recorded only after the customer sees the disclosure and continues. Address-only records identify customers who stopped before the contact form.</p></div><span>{leads.length} records</span></header>
        <div className="lead-table-wrap"><table><thead><tr><th>Status</th><th>Property</th><th>Customer</th><th>Quote</th><th>Email delivery</th><th>Updated</th></tr></thead><tbody>
          {leads.map((lead) => {
            const quote = lead.quote as { estimateRange?: string; system?: string } | null
            const journey = lead.status === "completed" ? "completed" : lead.name ? "contacted" : "started"
            const journeyLabel = journey === "completed" ? "Completed" : journey === "contacted" ? "Contact provided" : "Address only"
            return <tr key={lead.id}><td><span className={`lead-status lead-status--${journey}`}>{journeyLabel}</span></td>
              <td><b>{lead.address}</b><small>{lead.county}, {STATE_NAMES[lead.state] ?? lead.state}</small><a className="property-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`} target="_blank" rel="noreferrer">Open property map</a></td>
              <td>{lead.name ? <><b>{lead.name}</b><small>{lead.email}<br />{lead.phone}</small></> : <span className="muted">Stopped before contact form</span>}</td>
              <td>{quote ? <><b>{quote.estimateRange}</b><small>{quote.system}</small></> : <span className="muted">In progress</span>}</td>
              <td>{lead.notification_status ? <><b>{lead.notification_status === "sent" ? "Sent" : lead.notification_status === "failed" ? "Needs attention" : "Sending"}</b><small>{lead.notification_recipient}</small></> : <span className="muted">Not emailed</span>}</td>
              <td>{new Date(lead.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td></tr>
          })}
          {leads.length === 0 && <tr><td colSpan={6} className="empty-leads">No quote activity yet.</td></tr>}
        </tbody></table></div>
      </section>
      <footer className="contractor-footer">Automatic lead delivery: {tenant.lead_email} · Change this address in your website template. Use lead data only in accordance with your privacy notice and applicable marketing laws.</footer>
    </main>
  } catch (error) {
    return <main className="contractor-shell contractor-login-shell"><div className="contractor-login"><h1>Dashboard setup required</h1><p>{error instanceof Error ? error.message : "The contractor dashboard is unavailable."}</p></div></main>
  }
}
