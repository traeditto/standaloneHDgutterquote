import Link from "next/link"
import { redirect } from "next/navigation"
import { ContractorLogin } from "@/components/contractor/contractor-login"
import { ContractorPortalHeader } from "@/components/contractor/portal-header"
import { DEFAULT_CONFIG, IS_DEPLOYED_COMPANY_SITE, STATE_NAMES } from "@/lib/company-config"
import { listAbandonedLeads } from "@/lib/platform-db"
import { resolveCurrentContractorTenant } from "@/lib/tenant-context"

export const dynamic = "force-dynamic"

function inactivityLabel(updatedAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 60_000))
  if (minutes < 30) return "Recent activity"
  if (minutes < 60) return `${minutes} min inactive`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr inactive`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? "" : "s"} inactive`
}

export default async function AbandonedQuoteAddressesPage() {
  const authenticatedTenant = await resolveCurrentContractorTenant()
  if (!authenticatedTenant) {
    if (!IS_DEPLOYED_COMPANY_SITE) redirect(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? "/sign-in" : "/signup?mode=login")
    return <ContractorLogin companyName={DEFAULT_CONFIG.companyName} />
  }
  const tenantId = authenticatedTenant.tenant_id
  if (IS_DEPLOYED_COMPANY_SITE && tenantId !== DEFAULT_CONFIG.tenantId) {
    return <ContractorLogin companyName={DEFAULT_CONFIG.companyName} />
  }

  try {
    const [tenant, abandonedLeads] = [authenticatedTenant, await listAbandonedLeads(tenantId)]
    const addressOnly = abandonedLeads.filter((lead) => !lead.name).length
    const contactProvided = abandonedLeads.length - addressOnly

    return <main className="contractor-shell">
      <ContractorPortalHeader companyName={tenant.company_name} active="abandoned" websiteUrl={tenant.deployment_url} />

      <section className="contractor-page-heading">
        <div><small>INCOMPLETE QUOTE ACTIVITY</small><h2>Abandoned quote addresses</h2><p>These properties started a verified quote but did not reach the final estimate. Recent activity is identified so your team can avoid interrupting someone who may still be completing the quote.</p></div>
        <LinkButton />
      </section>

      <section className="abandoned-summary">
        <article><span>Incomplete quotes</span><strong>{abandonedLeads.length}</strong><small>Verified address starts without a completed estimate</small></article>
        <article><span>Address only</span><strong>{addressOnly}</strong><small>Stopped before providing name, email, and phone</small></article>
        <article><span>Contact provided</span><strong>{contactProvided}</strong><small>Contact details available, but the quote was not completed</small></article>
      </section>

      <section className="lead-table-card">
        <header><div><h2>Properties to review</h2><p>Newest activity appears first. Open the property map to review the location before following up.</p></div><span>{abandonedLeads.length} records</span></header>
        <div className="lead-table-wrap"><table><thead><tr><th>Stage</th><th>Property</th><th>Contact</th><th>Activity</th><th>Started</th></tr></thead><tbody>
          {abandonedLeads.map((lead) => <tr key={lead.id}>
            <td><span className={`lead-status lead-status--${lead.name ? "contacted" : "started"}`}>{lead.name ? "Contact provided" : "Address only"}</span></td>
            <td><b>{lead.address}</b><small>{lead.county}, {STATE_NAMES[lead.state] ?? lead.state}</small><a className="property-map-link" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.address)}`} target="_blank" rel="noreferrer">Open property map</a></td>
            <td>{lead.name ? <><b>{lead.name}</b><small>{lead.email}<br />{lead.phone}</small></> : <span className="muted">No contact details provided</span>}</td>
            <td><b>{inactivityLabel(lead.updated_at)}</b><small>Last activity {new Date(lead.updated_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</small></td>
            <td>{new Date(lead.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</td>
          </tr>)}
          {abandonedLeads.length === 0 && <tr><td colSpan={5} className="empty-leads">No abandoned quote addresses yet.</td></tr>}
        </tbody></table></div>
      </section>

      <footer className="contractor-footer">Use address and contact data only under your published privacy notice and applicable marketing, solicitation, and do-not-contact laws.</footer>
    </main>
  } catch (error) {
    return <main className="contractor-shell contractor-login-shell"><div className="contractor-login"><h1>Address activity unavailable</h1><p>{error instanceof Error ? error.message : "The abandoned quote list is unavailable."}</p></div></main>
  }
}

function LinkButton() {
  return <Link className="contractor-primary-action" href="/setup">Edit website template</Link>
}
