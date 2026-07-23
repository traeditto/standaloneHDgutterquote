import "server-only"

import {
  claimSiteVersionProvisioning,
  getSiteVersionForTenant,
  getTenant,
  recordAuditEvent,
  registerTenantDomain,
  saveTenantVercelProject,
  updateSiteVersion,
} from "@/lib/platform-db"
import { normalizeManagedDomain } from "@/lib/domain-name"
import { getManagedDomainQuote, purchaseManagedDomain, VercelDomainError } from "@/lib/vercel-domains"

export type ProvisionedDomain = {
  name: string
  verified: boolean
  verification?: Array<{ type?: string; domain?: string; value?: string; reason?: string }>
  purchased?: boolean
  purchasePrice?: number | null
  renewalPrice?: number | null
  orderId?: string | null
}

type VercelErrorPayload = { error?: { message?: string } }

function withTeam(path: string) {
  const url = new URL(path, "https://api.vercel.com")
  if (process.env.VERCEL_TEAM_ID) url.searchParams.set("teamId", process.env.VERCEL_TEAM_ID)
  return url.toString()
}

async function vercelRequest<T>(path: string, init: RequestInit = {}) {
  if (!process.env.VERCEL_TOKEN) throw new VercelDomainError("The managed hosting connection is not configured.", 503)
  const response = await fetch(withTeam(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  })
  const result = await response.json().catch(() => ({})) as T & VercelErrorPayload
  if (!response.ok) {
    throw new VercelDomainError(result.error?.message || `Vercel request failed with status ${response.status}.`, response.status)
  }
  return result
}

async function attachDomain(projectId: string, domain: string) {
  try {
    return await vercelRequest<ProvisionedDomain>(`/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(domain)}`)
  } catch (error) {
    if (error instanceof VercelDomainError && error.status !== 404) throw error
    return vercelRequest<ProvisionedDomain>(`/v10/projects/${encodeURIComponent(projectId)}/domains`, {
      method: "POST",
      body: JSON.stringify({ name: domain }),
    })
  }
}

export async function provisionManagedTenantDomain(input: {
  tenantId: string
  siteVersionId: string
  domain: string
  actorId: string
  requestId?: string
  allowOwnedDomain?: boolean
}) {
  const domain = normalizeManagedDomain(input.domain)
  const tenant = await getTenant(input.tenantId)
  if (!tenant) throw new VercelDomainError("Contractor account not found.", 404)
  if (!["active", "grace"].includes(tenant.access_state)) {
    throw new VercelDomainError("The contractor subscription is not active.", 402)
  }

  const version = await getSiteVersionForTenant(input.tenantId, input.siteVersionId)
  if (!version) throw new VercelDomainError("The approved website version was not found.", 404)
  if (version.status === "live" && version.deployment_url === `https://${domain}` && tenant.managed_domain === domain) {
    return {
      approval: version,
      domain: { name: domain, verified: true, purchased: false } satisfies ProvisionedDomain,
      readyState: "READY" as const,
      alreadyPublished: true,
    }
  }

  const claimed = await claimSiteVersionProvisioning(input.tenantId, input.siteVersionId)
  if (!claimed) {
    const current = await getSiteVersionForTenant(input.tenantId, input.siteVersionId)
    if (current?.status === "live" && current.deployment_url === `https://${domain}`) {
      return {
        approval: current,
        domain: { name: domain, verified: true, purchased: false } satisfies ProvisionedDomain,
        readyState: "READY" as const,
        alreadyPublished: true,
      }
    }
    if (current?.status === "provisioning") {
      return {
        approval: current,
        domain: { name: domain, verified: false, purchased: false } satisfies ProvisionedDomain,
        readyState: "PROVISIONING" as const,
        alreadyPublished: false,
      }
    }
    throw new VercelDomainError("This website version cannot be provisioned.", 409)
  }

  try {
    const projectId = process.env.VERCEL_PLATFORM_PROJECT_ID || process.env.VERCEL_PROJECT_ID
    if (!projectId || !process.env.VERCEL_TOKEN) {
      throw new VercelDomainError("The shared HD Instant Gutter Quote platform is not configured.", 503)
    }

    const allowedOwnedDomain = tenant.managed_domain === domain || input.allowOwnedDomain ? domain : tenant.managed_domain
    const quote = await getManagedDomainQuote(domain, { allowedOwnedDomain })
    if (!quote.eligible) throw new VercelDomainError(quote.message, 409)
    const purchase = await purchaseManagedDomain(quote)
    const attached = await attachDomain(projectId, domain)
    const verified = Boolean(attached.verified || purchase.purchased)
    const projectName = process.env.VERCEL_PLATFORM_PROJECT_NAME || "gutterquote-platform"

    await registerTenantDomain({ tenantId: input.tenantId, hostname: domain, verified, primary: true })
    await saveTenantVercelProject({
      tenantId: input.tenantId,
      projectId,
      projectName,
      deploymentUrl: `https://${domain}`,
      managedDomain: domain,
    })
    const publishedVersion = await updateSiteVersion({
      id: input.siteVersionId,
      status: verified ? "live" : "provisioning",
      vercelProject: projectName,
      deploymentUrl: `https://${domain}`,
    })
    await recordAuditEvent({
      tenantId: input.tenantId,
      actorType: "system",
      actorId: input.actorId,
      action: "configuration.published",
      targetType: "site_version",
      targetId: input.siteVersionId,
      metadata: { version: version.version, domain, verified, purchased: purchase.purchased },
      requestId: input.requestId,
    })

    return {
      approval: publishedVersion,
      domain: {
        ...attached,
        name: domain,
        verified,
        purchased: purchase.purchased,
        purchasePrice: quote.purchasePrice,
        renewalPrice: quote.renewalPrice,
        orderId: purchase.orderId,
      } satisfies ProvisionedDomain,
      readyState: verified ? "READY" as const : "VERIFYING" as const,
      alreadyPublished: false,
    }
  } catch (error) {
    await updateSiteVersion({
      id: input.siteVersionId,
      status: "failed",
      failureReason: error instanceof Error ? error.message : "Managed-domain provisioning failed.",
    }).catch(() => undefined)
    throw error
  }
}
