import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { QuoteExperience } from "@/components/quote/quote-experience"
import { DEFAULT_CONFIG, IS_DEPLOYED_COMPANY_SITE, type CompanyConfig } from "@/lib/company-config"
import { CONTRACTOR_COOKIE, readContractorSession } from "@/lib/contractor-auth"
import { getTenant } from "@/lib/platform-db"
import { isPlatformStaff } from "@/lib/platform-staff-auth"
import { resolveCurrentContractorTenant } from "@/lib/tenant-context"

export const dynamic = "force-dynamic"

export default async function PreviewPage() {
  const cookieStore = await cookies()
  const signedIn = await isPlatformStaff()
  let demoTenant: string | null = null
  try {
    demoTenant = readContractorSession(cookieStore.get(CONTRACTOR_COOKIE)?.value)
  } catch { /* redirect below */ }
  const identityTenant = await resolveCurrentContractorTenant()
  if (identityTenant) demoTenant = identityTenant.tenant_id
  if (!signedIn && !demoTenant) redirect(IS_DEPLOYED_COMPANY_SITE ? "/contractor" : "/signup")
  if (demoTenant) {
    if (IS_DEPLOYED_COMPANY_SITE && demoTenant !== DEFAULT_CONFIG.tenantId) redirect("/contractor")
    const tenant = identityTenant?.tenant_id === demoTenant ? identityTenant : await getTenant(demoTenant).catch(() => null)
    if (!tenant) redirect(IS_DEPLOYED_COMPANY_SITE ? "/contractor" : "/signup")
    return <QuoteExperience
      previewMode
      demoRenderAvailable={tenant.access_state === "inactive" && !tenant.demo_render_used_at}
      initialConfig={tenant.draft_config as CompanyConfig | null}
    />
  }
  return <QuoteExperience previewMode />
}
