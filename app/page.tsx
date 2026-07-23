import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { QuoteExperience } from "@/components/quote/quote-experience"
import { SiteSuspended } from "@/components/site-suspended"
import { DEFAULT_CONFIG, IS_DEPLOYED_COMPANY_SITE } from "@/lib/company-config"
import { resolveHostnameTenant, tenantCompanyConfig } from "@/lib/tenant-context"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const headerStore = await headers()
  const hostname = headerStore.get("x-forwarded-host") || headerStore.get("host") || ""
  const tenant = await resolveHostnameTenant(hostname)
  if (!tenant) {
    if (IS_DEPLOYED_COMPANY_SITE) return <SiteSuspended companyName={DEFAULT_CONFIG.companyName} />
    redirect("/for-contractors")
  }
  const config = await tenantCompanyConfig(tenant)
  if (!["active", "grace"].includes(tenant.access_state)) return <SiteSuspended companyName={config.companyName} />
  return <QuoteExperience productionMode initialConfig={config} />
}
