import "server-only"

import type { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { DEFAULT_CONFIG, IS_DEPLOYED_COMPANY_SITE, normalizeCompanyConfig, type CompanyConfig } from "@/lib/company-config"
import { CONTRACTOR_COOKIE, readContractorSession } from "@/lib/contractor-auth"
import { getPublishedTenantConfig, getTenant, getTenantByClerkOrganization, getTenantByHostname, type TenantRecord } from "@/lib/platform-db"

export function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
}

function privilegedOrganizationSessionAllowed(identity: { orgRole?: string | null; sessionClaims?: unknown }) {
  const role = String(identity.orgRole || "")
  const privileged = role === "org:admin" || role === "org:owner" || role === "admin" || role === "owner"
  if (!privileged || process.env.NODE_ENV !== "production") return true
  const fva = (identity.sessionClaims as { fva?: [number, number] } | null)?.fva
  return Boolean(Array.isArray(fva) && Number(fva[1]) >= 0)
}

function platformHosts() {
  return new Set([
    "localhost",
    "127.0.0.1",
    ...String(process.env.PLATFORM_HOSTS || process.env.VERCEL_PROJECT_PRODUCTION_URL || "")
      .split(",")
      .map(normalizeHostname)
      .filter(Boolean),
  ])
}

export async function resolveHostnameTenant(hostnameValue: string) {
  const hostname = normalizeHostname(hostnameValue)
  if (!hostname || platformHosts().has(hostname)) return null
  const mapped = await getTenantByHostname(hostname).catch(() => null)
  if (mapped) return mapped
  if (IS_DEPLOYED_COMPANY_SITE) return getTenant(DEFAULT_CONFIG.tenantId).catch(() => null)
  return null
}

export async function resolvePublicTenant(request: NextRequest) {
  const hostname = request.headers.get("x-forwarded-host") || request.headers.get("host") || ""
  return resolveHostnameTenant(hostname)
}

export async function resolveContractorTenant(request: NextRequest): Promise<TenantRecord | null> {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { auth } = await import("@clerk/nextjs/server")
      const identity = await auth()
      if (identity.orgId && privilegedOrganizationSessionAllowed(identity)) {
        const tenant = await getTenantByClerkOrganization(identity.orgId)
        if (tenant) return tenant
      }
    } catch { /* legacy migration fallback below */ }
  }
  try {
    const tenantId = readContractorSession(request.cookies.get(CONTRACTOR_COOKIE)?.value)
    return tenantId ? await getTenant(tenantId) : null
  } catch { return null }
}

export async function resolveContractorPrincipal(request: NextRequest): Promise<{ tenant: TenantRecord; actorId: string; owner: boolean } | null> {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { auth } = await import("@clerk/nextjs/server")
      const identity = await auth()
      if (identity.orgId && identity.userId && privilegedOrganizationSessionAllowed(identity)) {
        const tenant = await getTenantByClerkOrganization(identity.orgId)
        if (!tenant) return null
        const role = String(identity.orgRole || "")
        return { tenant, actorId: identity.userId, owner: role === "org:admin" || role === "org:owner" || role === "admin" || role === "owner" }
      }
    } catch { return null }
  }
  try {
    const tenantId = readContractorSession(request.cookies.get(CONTRACTOR_COOKIE)?.value)
    const tenant = tenantId ? await getTenant(tenantId) : null
    return tenant ? { tenant, actorId: `legacy:${tenant.tenant_id}`, owner: true } : null
  } catch { return null }
}

export async function resolveCurrentContractorTenant(): Promise<TenantRecord | null> {
  if (process.env.CLERK_SECRET_KEY) {
    try {
      const { auth } = await import("@clerk/nextjs/server")
      const identity = await auth()
      if (identity.orgId && privilegedOrganizationSessionAllowed(identity)) {
        const tenant = await getTenantByClerkOrganization(identity.orgId)
        if (tenant) return tenant
      }
    } catch { /* legacy migration fallback below */ }
  }
  try {
    const cookieStore = await cookies()
    const tenantId = readContractorSession(cookieStore.get(CONTRACTOR_COOKIE)?.value)
    return tenantId ? await getTenant(tenantId) : null
  } catch { return null }
}

export async function tenantCompanyConfig(tenant: TenantRecord): Promise<CompanyConfig> {
  const published = await getPublishedTenantConfig(tenant.tenant_id)
  const value = published && typeof published === "object" ? published as Partial<CompanyConfig> : {}
  return normalizeCompanyConfig({ ...value, tenantId: tenant.tenant_id, companyName: tenant.company_name, leadEmail: tenant.lead_email }, DEFAULT_CONFIG)
}
