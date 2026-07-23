import { NextRequest, NextResponse } from "next/server"
import type { CompanyConfig } from "@/lib/company-config"
import { createSubscriptionCheckout } from "@/lib/stripe-billing"
import { managedDomainError, normalizeManagedDomain } from "@/lib/domain-name"
import {
  approveSiteConfiguration,
  saveTenantDraft,
  updateTenantProfile,
} from "@/lib/platform-db"
import { provisionManagedTenantDomain } from "@/lib/domain-provisioning"
import { requestId, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant } from "@/lib/tenant-context"
import {
  assertManagedDomainPurchaseConfigured,
  getManagedDomainQuote,
  VercelDomainError,
} from "@/lib/vercel-domains"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DeployRequest = {
  config?: CompanyConfig
  domain?: string
  approvedBy?: string
  approvalConfirmed?: boolean
}

function isCompanyConfig(value: unknown): value is CompanyConfig {
  if (!value || typeof value !== "object") return false
  const config = value as Partial<CompanyConfig>
  return Boolean(config.companyName && config.phone !== undefined &&
    (config.googlePlaceId === undefined || (typeof config.googlePlaceId === "string" && config.googlePlaceId.length <= 512)) &&
    (config.showGoogleReviews === undefined || typeof config.showGoogleReviews === "boolean") &&
    config.serviceAreas && typeof config.serviceAreas === "object" &&
    Object.values(config.serviceAreas).some((counties) => Array.isArray(counties) && counties.length > 0) &&
    Array.isArray(config.gutterProducts) && config.gutterProducts.length > 0 &&
    config.gutterProducts.every((product) => product.id && product.name && product.pricePerFoot &&
      [1, 2, 3].every((tier) => Number.isFinite(product.pricePerFoot[tier as 1 | 2 | 3]))))
}

export async function POST(request: NextRequest) {
  const id = requestId(request)
  try {
    if (!sameOrigin(request)) return NextResponse.json({ code: "ORIGIN_MISMATCH", error: "Cross-site publication requests are not allowed." }, { status: 403 })
    const tenant = await resolveContractorTenant(request)
    if (!tenant) return NextResponse.json({ error: "Sign in to your contractor workspace before publishing." }, { status: 401 })
    const body = await request.json() as DeployRequest
    if (!isCompanyConfig(body.config)) return NextResponse.json({ error: "Complete the company configuration before publishing." }, { status: 400 })
    if (!body.approvedBy?.trim() || body.approvalConfirmed !== true) {
      return NextResponse.json({ error: "The contractor must test and approve this configuration before publishing." }, { status: 400 })
    }
    const domain = normalizeManagedDomain(body.domain || "")
    const domainError = managedDomainError(domain)
    if (domainError) return NextResponse.json({ error: domainError }, { status: 400 })
    const approvedConfig: CompanyConfig = { ...body.config, tenantId: tenant.tenant_id, leadEmail: body.config.leadEmail || body.config.email }
    if (Buffer.byteLength(JSON.stringify(approvedConfig), "utf8") > 900_000) return NextResponse.json({ error: "The approved configuration is too large. Use a smaller logo and try again." }, { status: 413 })

    await updateTenantProfile({ tenantId: tenant.tenant_id, companyName: approvedConfig.companyName, leadEmail: approvedConfig.leadEmail, planCode: "launch" })
    await saveTenantDraft({ tenantId: tenant.tenant_id, config: approvedConfig })
    const frozenVersion = await approveSiteConfiguration({ tenantId: tenant.tenant_id, config: approvedConfig, approvedBy: body.approvedBy.trim() })
    if (!["active", "grace"].includes(tenant.access_state)) {
      const quote = await getManagedDomainQuote(domain, { allowedOwnedDomain: tenant.managed_domain })
      if (!quote.eligible) throw new VercelDomainError(quote.message, 409)
      if (!quote.owned) assertManagedDomainPurchaseConfigured()
      const checkoutUrl = await createSubscriptionCheckout({
        tenantId: tenant.tenant_id,
        returnUrl: `${new URL(request.url).origin}/setup`,
        launch: {
          domain,
          siteVersionId: frozenVersion.id,
          approvedBy: body.approvedBy.trim(),
        },
      })
      return NextResponse.json({
        error: "Activate the contractor subscription before publishing production.",
        requiresSubscription: true,
        checkoutUrl,
        approval: { version: frozenVersion.version, approvedAt: frozenVersion.approved_at, approvedBy: body.approvedBy.trim() },
      }, { status: 402 })
    }

    const projectId = process.env.VERCEL_PLATFORM_PROJECT_ID || process.env.VERCEL_PROJECT_ID
    if (!projectId || !process.env.VERCEL_TOKEN) return NextResponse.json({ error: "The shared HD Instant Gutter Quote platform project is not configured." }, { status: 503 })
    const provisioned = await provisionManagedTenantDomain({
      tenantId: tenant.tenant_id,
      siteVersionId: frozenVersion.id,
      domain,
      actorId: body.approvedBy.trim(),
      requestId: id,
    })
    return NextResponse.json({
      approval: { version: frozenVersion.version, approvedAt: frozenVersion.approved_at, approvedBy: body.approvedBy.trim() },
      project: { id: projectId, name: process.env.VERCEL_PLATFORM_PROJECT_NAME || "gutterquote-platform", created: false, shared: true },
      deployment: { id: "shared-platform", url: `https://${domain}`, readyState: provisioned.readyState, inspectorUrl: "" },
      domain: provisioned.domain,
      requestId: id,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "The shared HD Instant Gutter Quote site could not be published."
    return NextResponse.json({ error: message, requestId: id }, { status: error instanceof VercelDomainError ? error.status : 502 })
  }
}
