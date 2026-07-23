import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { QuoteExperience } from "@/components/quote/quote-experience"
import { resolveHostnameTenant, tenantCompanyConfig } from "@/lib/tenant-context"
import { readWidgetToken } from "@/lib/widget-auth"

export const dynamic = "force-dynamic"

export default async function EmbedPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const token = readWidgetToken((await searchParams).token)
  if (!token) notFound()
  const requestHeaders = await headers()
  const hostname = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || ""
  const tenant = await resolveHostnameTenant(hostname)
  if (!tenant || tenant.tenant_id !== token.tenantId || !["active", "grace"].includes(tenant.access_state)) notFound()
  const config = await tenantCompanyConfig(tenant)
  if (!config.widgetAllowedOrigins.includes(token.parentOrigin)) notFound()
  return <QuoteExperience productionMode embedMode initialConfig={config} />
}
