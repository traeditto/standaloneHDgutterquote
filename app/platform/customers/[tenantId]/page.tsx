import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { getPlatformTenantDetail, getTenant } from "@/lib/platform-db"
import { isPlatformStaff } from "@/lib/platform-staff-auth"
import { PlatformAccount } from "@/components/platform/platform-account"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "Not available"
  return new Date(value).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })
}

export default async function PlatformCustomerPage({ params }: { params: Promise<{ tenantId: string }> }) {
  if (!(await isPlatformStaff())) {
    if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect(`/sign-in?redirect_url=${encodeURIComponent("/platform")}`)
    redirect("/platform")
  }

  const { tenantId: encodedTenantId } = await params
  const tenantId = decodeURIComponent(encodedTenantId)
  const tenant = await getTenant(tenantId)
  if (!tenant) notFound()
  const detail = await getPlatformTenantDetail(tenantId)

  return <main className="platform-shell">
    <header className="platform-header platform-header--customer">
      <div><Link className="platform-back-link" href="/platform"><ArrowLeft size={14} /> All customers</Link><small>HD PRECISION · CUSTOMER ADMIN</small><h1>{tenant.company_name}</h1><p>{tenant.contact_name || "No contact name"} · {tenant.lead_email}</p></div>
      <nav>{tenant.deployment_url && <a href={tenant.deployment_url} target="_blank" rel="noreferrer">Open website <ExternalLink size={13} /></a>}<PlatformAccount clerkEnabled={Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY)} /></nav>
    </header>

    <section className="platform-customer-summary">
      <article><span>Account</span><strong>{tenant.plan_code === "launch" ? "Paid launch" : "Free demo"}</strong><small>Created {formatDate(tenant.created_at)}<br />Workspace {tenant.tenant_id}</small></article>
      <article><span>Subscription</span><strong className={`subscription-state subscription-state--${tenant.access_state}`}>{tenant.subscription_status.replaceAll("_", " ")}</strong><small>Website access: {tenant.access_state}<br />Period end: {formatDate(tenant.subscription_period_end)}</small></article>
      <article><span>Lead activity</span><strong>{detail.leadCount}</strong><small>{detail.completedLeadCount} completed · {detail.abandonedLeadCount} incomplete</small></article>
      <article><span>Rendering</span><strong>{detail.renderCount}</strong><small>{detail.successfulRenderCount} completed · {detail.failedRenderCount} failed<br />{tenant.render_credits} credits remaining</small></article>
    </section>

    <section className="platform-customer-grid">
      <article className="platform-detail-card">
        <header><h2>Customer and billing</h2><span className={`platform-pill platform-pill--${tenant.subscription_status}`}>{tenant.subscription_status.replaceAll("_", " ")}</span></header>
        <dl>
          <div><dt>Contact</dt><dd>{tenant.contact_name || "Not provided"}</dd></div>
          <div><dt>Lead email</dt><dd><a href={`mailto:${tenant.lead_email}`}>{tenant.lead_email}</a></dd></div>
          <div><dt>Phone</dt><dd>{tenant.phone || "Not provided"}</dd></div>
          <div><dt>Stripe customer</dt><dd>{tenant.stripe_customer_id ? <a href={`https://dashboard.stripe.com/customers/${encodeURIComponent(tenant.stripe_customer_id)}`} target="_blank" rel="noreferrer">{tenant.stripe_customer_id} <ExternalLink size={11} /></a> : "Not connected"}</dd></div>
          <div><dt>Stripe subscription</dt><dd>{tenant.stripe_subscription_id || "Not created"}</dd></div>
          <div><dt>Grace period ends</dt><dd>{formatDate(tenant.grace_ends_at)}</dd></div>
          <div><dt>Clerk organization</dt><dd>{tenant.clerk_org_id || "Not connected"}</dd></div>
          <div><dt>Last account update</dt><dd>{formatDate(tenant.updated_at)}</dd></div>
        </dl>
      </article>

      <article className="platform-detail-card">
        <header><h2>Website and domain</h2><span className={`platform-pill platform-pill--${tenant.deployment_url ? "active" : "inactive"}`}>{tenant.deployment_url ? "published" : "not published"}</span></header>
        <dl>
          <div><dt>Managed domain</dt><dd>{tenant.managed_domain ? <a href={`https://${tenant.managed_domain}`} target="_blank" rel="noreferrer">{tenant.managed_domain} <ExternalLink size={11} /></a> : "Not selected"}</dd></div>
          <div><dt>Deployment</dt><dd>{tenant.deployment_url ? <a href={tenant.deployment_url} target="_blank" rel="noreferrer">Open deployment <ExternalLink size={11} /></a> : "Not deployed"}</dd></div>
          <div><dt>Project name</dt><dd>{tenant.vercel_project_name || "Shared platform"}</dd></div>
          <div><dt>Template last saved</dt><dd>{formatDate(tenant.draft_updated_at)}</dd></div>
          <div><dt>Quote sessions</dt><dd>{detail.quoteSessionCount}</dd></div>
          <div><dt>Lead email failures</dt><dd className={detail.failedNotificationCount ? "platform-danger-text" : ""}>{detail.failedNotificationCount}</dd></div>
          <div><dt>Free demo render</dt><dd>{tenant.demo_render_used_at ? `Used ${formatDate(tenant.demo_render_used_at)}` : "Available"}</dd></div>
          <div><dt>Completed-lead retention</dt><dd>{tenant.completed_lead_retention_months} months</dd></div>
        </dl>
      </article>
    </section>

    <section className="platform-admin-grid platform-admin-grid--detail">
      <section className="platform-table-card">
        <header><div><h2>Domains</h2><p>Verified routing records connected to this customer.</p></div><span>{detail.domains.length}</span></header>
        <div className="lead-table-wrap"><table><thead><tr><th>Hostname</th><th>Status</th><th>Role</th><th>Verified</th></tr></thead><tbody>
          {detail.domains.map((domain) => <tr key={domain.hostname}><td><b>{domain.hostname}</b></td><td><span className={`platform-pill platform-pill--${domain.status === "verified" ? "active" : domain.status}`}>{domain.status}</span></td><td>{domain.is_primary ? "Primary" : "Alias"}</td><td>{formatDate(domain.verified_at)}</td></tr>)}
          {detail.domains.length === 0 && <tr><td colSpan={4} className="empty-leads">No domain records.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="platform-table-card">
        <header><div><h2>Approved site versions</h2><p>Configuration approvals and publication history.</p></div><span>{detail.versions.length}</span></header>
        <div className="lead-table-wrap"><table><thead><tr><th>Version</th><th>Status</th><th>Approved</th><th>Result</th></tr></thead><tbody>
          {detail.versions.map((version) => <tr key={version.id}><td><b>Version {version.version}</b><small>by {version.approved_by}</small></td><td><span className={`platform-pill platform-pill--${version.status === "live" ? "active" : version.status}`}>{version.status}</span></td><td>{formatDate(version.approved_at)}</td><td>{version.deployment_url ? <a href={version.deployment_url} target="_blank" rel="noreferrer">Open <ExternalLink size={11} /></a> : version.failure_reason || "—"}</td></tr>)}
          {detail.versions.length === 0 && <tr><td colSpan={4} className="empty-leads">No approved versions yet.</td></tr>}
        </tbody></table></div>
      </section>
    </section>

    <section className="platform-detail-card platform-audit-card">
      <header><h2>Recent customer audit trail</h2><span>{detail.audit.length} events</span></header>
      <div className="platform-activity-list platform-activity-list--wide">
        {detail.audit.map((event) => <article key={event.id}><span className={`platform-activity-dot platform-activity-dot--${event.actor_type}`} /><div><b>{event.action.replaceAll(".", " ")}</b><p>{event.actor_type}{event.target_type ? ` · ${event.target_type}` : ""}</p><small>{formatDate(event.created_at)}</small></div></article>)}
        {detail.audit.length === 0 && <p className="platform-empty-activity">No customer audit events yet.</p>}
      </div>
    </section>

    <footer className="platform-admin-footer">Use Stripe for billing changes. Subscription webhooks automatically update site access and preserve the platform audit trail.</footer>
  </main>
}
