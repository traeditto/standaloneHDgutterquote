import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { GutterSetupBuilder } from "@/components/setup/gutter-setup-builder"
import { DEFAULT_CONFIG, IS_DEPLOYED_COMPANY_SITE, type CompanyConfig } from "@/lib/company-config"
import { CONTRACTOR_COOKIE, readContractorSession } from "@/lib/contractor-auth"
import { getTenant } from "@/lib/platform-db"
import { isPlatformStaff } from "@/lib/platform-staff-auth"
import { resolveCurrentContractorTenant } from "@/lib/tenant-context"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  const cookieStore = await cookies()
  const signedIn = await isPlatformStaff()
  let tenantId: string | null = null
  try {
    tenantId = readContractorSession(cookieStore.get(CONTRACTOR_COOKIE)?.value)
  } catch { /* redirect to public signup when sessions are not configured */ }

  const identityTenant = await resolveCurrentContractorTenant()
  if (identityTenant) tenantId = identityTenant.tenant_id

  if (signedIn && !IS_DEPLOYED_COMPANY_SITE) return <GutterSetupBuilder />
  if (!tenantId) redirect(IS_DEPLOYED_COMPANY_SITE ? "/contractor" : "/signup")
  if (IS_DEPLOYED_COMPANY_SITE && tenantId !== DEFAULT_CONFIG.tenantId) redirect("/contractor")

  const tenant = identityTenant?.tenant_id === tenantId ? identityTenant : await getTenant(tenantId).catch(() => null)
  if (!tenant) redirect(IS_DEPLOYED_COMPANY_SITE ? "/contractor" : "/signup")
  return <GutterSetupBuilder initialConfig={tenant.draft_config as CompanyConfig | null} account={{
    tenantId: tenant.tenant_id,
    companyName: tenant.company_name,
    contactName: tenant.contact_name ?? "",
    leadEmail: tenant.lead_email,
    phone: tenant.phone ?? "",
    planCode: tenant.plan_code,
    accessState: tenant.access_state,
    deploymentUrl: tenant.deployment_url,
    managedDomain: tenant.managed_domain,
  }} />
}
