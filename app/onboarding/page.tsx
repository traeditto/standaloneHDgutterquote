import { randomUUID } from "node:crypto"
import { CreateOrganization } from "@clerk/nextjs"
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server"
import Link from "next/link"
import { redirect } from "next/navigation"
import { LEGAL_TERMS_VERSION } from "@/lib/legal"
import { createSignupTenant, getTenantByClerkOrganization, hashPassword, linkTenantClerkOrganization, recordAuditEvent, recordTermsAcceptance, registerTenantDomain } from "@/lib/platform-db"

export const dynamic = "force-dynamic"

function projectSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "gutter-company"
}

async function finishOrganizationOnboarding(formData: FormData) {
  "use server"
  if (formData.get("acceptedTerms") !== "on") throw new Error("Accept the Terms of Service and Privacy Policy to continue.")
  const identity = await auth()
  if (!identity.userId) redirect("/sign-in")
  if (!identity.orgId) redirect("/onboarding")
  const existing = await getTenantByClerkOrganization(identity.orgId)
  if (existing) redirect("/setup")

  const [user, clerk] = await Promise.all([currentUser(), clerkClient()])
  const organization = await clerk.organizations.getOrganization({ organizationId: identity.orgId })
  const email = user?.primaryEmailAddress?.emailAddress || user?.emailAddresses[0]?.emailAddress
  if (!email) throw new Error("A verified business email is required.")
  const companyName = organization.name.trim().slice(0, 120)
  const contactName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim().slice(0, 120) || "Organization owner"
  const base = projectSlug(companyName)
  const migrationOnlyPassword = await hashPassword(randomUUID() + randomUUID())
  let tenant = null
  for (let attempt = 0; attempt < 5 && !tenant; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${randomUUID().slice(0, 6)}`
    tenant = await createSignupTenant({
      tenantId: `${base.slice(0, 72 - suffix.length)}${suffix}`,
      companyName,
      leadEmail: email.toLowerCase(),
      contactName,
      phone: "",
      passwordHash: migrationOnlyPassword,
      planCode: "demo",
    })
  }
  if (!tenant) throw new Error("Could not reserve a contractor workspace.")
  await linkTenantClerkOrganization(tenant.tenant_id, identity.orgId)
  await recordTermsAcceptance({ tenantId: tenant.tenant_id, version: LEGAL_TERMS_VERSION, actorId: identity.userId })
  if (process.env.TENANT_ROOT_DOMAIN) await registerTenantDomain({ tenantId: tenant.tenant_id, hostname: `${tenant.tenant_id}.${process.env.TENANT_ROOT_DOMAIN}`, verified: true, primary: !tenant.managed_domain })
  await clerk.organizations.updateOrganizationMetadata(identity.orgId, { privateMetadata: { tenantId: tenant.tenant_id } })
  await recordAuditEvent({ tenantId: tenant.tenant_id, actorType: "contractor", actorId: identity.userId, action: "identity.organization_onboarded", targetType: "tenant", targetId: tenant.tenant_id })
  redirect("/setup?welcome=1")
}

export default async function OnboardingPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) redirect("/signup")
  const identity = await auth()
  if (!identity.userId) redirect("/sign-in")
  if (identity.orgId) {
    const tenant = await getTenantByClerkOrganization(identity.orgId)
    if (tenant) redirect("/setup")
    return <main className="contractor-shell contractor-login-shell"><form action={finishOrganizationOnboarding} className="contractor-login"><h1>Connect your gutter company</h1><p>We’ll create your private HD Instant Gutter Quote workspace. You can build and preview it before paying.</p><label className="legal-consent"><input name="acceptedTerms" type="checkbox" required /><span>I agree to the <Link href="/terms" target="_blank">Terms of Service</Link> and acknowledge the <Link href="/privacy" target="_blank">Privacy Policy</Link> and <Link href="/domain-terms" target="_blank">Managed Domain Terms</Link>.</span></label><button type="submit">Create my free demo</button></form></main>
  }
  return <main className="contractor-shell contractor-login-shell"><CreateOrganization routing="hash" afterCreateOrganizationUrl="/onboarding" /></main>
}
