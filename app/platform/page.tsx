import Link from "next/link"
import { redirect } from "next/navigation"
import { Activity, Building2, CircleDollarSign, ExternalLink, Globe2, Mail, MailWarning, Paintbrush, Phone, UserRoundX, Users } from "lucide-react"
import { getPlatformOverview, listIncompleteSignups, listPlatformAudit, listTenants, type PlatformOverview } from "@/lib/platform-db"
import { isPlatformStaff } from "@/lib/platform-staff-auth"
import { PlatformAccount } from "@/components/platform/platform-account"

export const dynamic = "force-dynamic"

const EMPTY_OVERVIEW: PlatformOverview = {
  contractors: 0,
  activeSubscriptions: 0,
  billingAttention: 0,
  liveWebsites: 0,
  leadsLast30Days: 0,
  completedQuotesLast30Days: 0,
  rendersLast30Days: 0,
  failedRendersLast30Days: 0,
  activeRenderJobs: 0,
  failedLeadNotifications: 0,
  availableRenderCredits: 0,
}

function shortDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function shortDateTime(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
}

export default async function PlatformPage() {
  const signedIn = await isPlatformStaff()
  if (!signedIn) {
    if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect("/sign-in?redirect_url=/platform")
    const { PlatformLogin } = await import("@/components/platform/platform-login")
    return <PlatformLogin />
  }

  let tenants: Awaited<ReturnType<typeof listTenants>> = []
  let overview = EMPTY_OVERVIEW
  let audit: Awaited<ReturnType<typeof listPlatformAudit>> = []
  let incompleteSignups: Awaited<ReturnType<typeof listIncompleteSignups>> = []
  let databaseNotice = ""
  try {
    ;[tenants, overview, audit, incompleteSignups] = await Promise.all([
      listTenants(),
      getPlatformOverview(),
      listPlatformAudit(16),
      listIncompleteSignups(),
    ])
  } catch {
    databaseNotice = "The platform database is unavailable. Customer and billing records could not be loaded."
  }

  const operationalWarnings = overview.activeRenderJobs + overview.failedRendersLast30Days + overview.failedLeadNotifications

  return <main className="platform-shell">
    <header className="platform-header">
      <div><small>HD PRECISION · ADMIN</small><h1>Business control center</h1><p>Customers, billing, websites, leads, rendering, and platform health.</p></div>
      <nav><Link href="/for-contractors" target="_blank">View sales site <ExternalLink size={13} /></Link><PlatformAccount clerkEnabled={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)} /></nav>
    </header>

    {databaseNotice && <section className="billing-warning billing-warning--danger"><div><b>Database connection needs attention</b><p>{databaseNotice}</p></div></section>}

    <section className="platform-summary platform-summary--admin">
      <article><span><Users size={15} /> Customers</span><strong>{overview.contractors}</strong><small>{overview.activeSubscriptions} paid subscription{overview.activeSubscriptions === 1 ? "" : "s"}</small></article>
      <article><span><Globe2 size={15} /> Live websites</span><strong>{overview.liveWebsites}</strong><small>Active or in payment grace</small></article>
      <article className={overview.billingAttention ? "is-warning" : ""}><span><CircleDollarSign size={15} /> Billing attention</span><strong>{overview.billingAttention}</strong><small>Past due, unpaid, or suspended</small></article>
      <article><span><Building2 size={15} /> Leads · 30 days</span><strong>{overview.leadsLast30Days}</strong><small>{overview.completedQuotesLast30Days} completed quotes</small></article>
      <article><span><Paintbrush size={15} /> Renders · 30 days</span><strong>{overview.rendersLast30Days}</strong><small>{overview.failedRendersLast30Days} failed · {overview.availableRenderCredits} credits available</small></article>
      <article className={operationalWarnings ? "is-warning" : ""}><span><Activity size={15} /> Operations</span><strong>{operationalWarnings}</strong><small>{overview.activeRenderJobs} active jobs · {overview.failedLeadNotifications} email failures</small></article>
    </section>

    <section className="platform-table-card platform-table-card--incomplete">
      <header>
        <div><h2><UserRoundX size={18} /> Incomplete registrations & demos</h2><p>Contractors who created an account but have not completed a paid launch. Use their last step to follow up with the right message.</p></div>
        <span>{incompleteSignups.length} to follow up</span>
      </header>
      <div className="lead-table-wrap"><table><thead><tr><th>Contractor</th><th>Progress</th><th>Demo activity</th><th>Timing</th><th>Contact</th><th>Account</th></tr></thead><tbody>
        {incompleteSignups.map((signup) => <tr key={signup.tenant_id}>
          <td><b>{signup.company_name}</b><small>{signup.contact_name || "No contact name"}<br />{signup.lead_email}<br />{signup.phone || "No phone provided"}</small></td>
          <td><span className={`platform-progress-pill platform-progress-pill--${signup.setup_stage.toLowerCase().replaceAll(" ", "-")}`}>{signup.setup_stage}</span><small>{signup.plan_code === "launch" ? "Selected launch plan" : "Started free demo"}{signup.latest_version_status ? <><br />Site version: {signup.latest_version_status}</> : null}</small></td>
          <td><b>{signup.test_sessions} test address{signup.test_sessions === 1 ? "" : "es"}</b><small>{signup.demo_render_used_at ? "Free render used" : "Free render not used"}</small></td>
          <td><b>Joined {shortDate(signup.created_at)}</b><small>Last activity<br />{shortDateTime(signup.last_activity_at)}</small></td>
          <td><div className="platform-contact-actions"><a href={`mailto:${signup.lead_email}`}><Mail size={12} /> Email</a>{signup.phone && <a href={`tel:${signup.phone}`}><Phone size={12} /> Call</a>}</div></td>
          <td><Link className="platform-detail-link" href={`/platform/customers/${encodeURIComponent(signup.tenant_id)}`}>View account</Link></td>
        </tr>)}
        {incompleteSignups.length === 0 && <tr><td colSpan={6} className="empty-leads">No incomplete contractor signups right now.</td></tr>}
      </tbody></table></div>
    </section>

    <section className="platform-admin-grid">
      <section className="platform-table-card platform-table-card--customers">
        <header><div><h2>Customers</h2><p>Every demo, paid subscription, website, and account requiring attention.</p></div><span>{tenants.length} total</span></header>
        <div className="lead-table-wrap"><table><thead><tr><th>Company</th><th>Plan</th><th>Billing</th><th>Usage</th><th>Website</th><th>Action</th></tr></thead><tbody>
          {tenants.map((tenant) => <tr key={tenant.tenant_id}>
            <td><b>{tenant.company_name}</b><small>{tenant.contact_name || "No contact name"}<br />{tenant.lead_email}<br />Joined {shortDate(tenant.created_at)}</small></td>
            <td><span className={`platform-pill platform-pill--${tenant.plan_code === "launch" ? "active" : "inactive"}`}>{tenant.plan_code === "launch" ? "Paid launch" : "Free demo"}</span><small>{tenant.deployment_url ? "Published" : tenant.draft_updated_at ? "Template started" : "No template"}</small></td>
            <td><span className={`platform-pill platform-pill--${tenant.subscription_status}`}>{tenant.subscription_status.replaceAll("_", " ")}</span><small>Access: {tenant.access_state}{tenant.subscription_period_end ? <><br />Renews {shortDate(tenant.subscription_period_end)}</> : null}</small></td>
            <td><b>{tenant.render_credits} render credits</b><small>{tenant.demo_render_used_at ? "Demo render used" : "Demo render available"}</small></td>
            <td>{tenant.managed_domain ? <a href={`https://${tenant.managed_domain}`} target="_blank" rel="noreferrer">{tenant.managed_domain} <ExternalLink size={11} /></a> : tenant.deployment_url ? <a href={tenant.deployment_url} target="_blank" rel="noreferrer">Open deployment <ExternalLink size={11} /></a> : <span className="muted">Not published</span>}</td>
            <td><Link className="platform-detail-link" href={`/platform/customers/${encodeURIComponent(tenant.tenant_id)}`}>View customer</Link></td>
          </tr>)}
          {tenants.length === 0 && <tr><td colSpan={6} className="empty-leads">No customer accounts yet.</td></tr>}
        </tbody></table></div>
      </section>

      <aside className="platform-operations-card">
        <header><MailWarning size={18} /><div><h2>Recent activity</h2><p>Security, billing, publishing, and usage events.</p></div></header>
        <div className="platform-activity-list">
          {audit.map((event) => <article key={event.id}><span className={`platform-activity-dot platform-activity-dot--${event.actor_type}`} /><div><b>{event.action.replaceAll(".", " ")}</b><p>{event.company_name || event.tenant_id || "Platform"}{event.target_type ? ` · ${event.target_type}` : ""}</p><small>{new Date(event.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</small></div></article>)}
          {audit.length === 0 && <p className="platform-empty-activity">No audit activity has been recorded yet.</p>}
        </div>
      </aside>
    </section>

    <footer className="platform-admin-footer">Admin access is private and session-protected. Billing changes remain in Stripe; website access follows verified webhook state.</footer>
  </main>
}
