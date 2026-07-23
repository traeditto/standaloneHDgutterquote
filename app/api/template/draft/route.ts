import { NextRequest, NextResponse } from "next/server"
import type { CompanyConfig } from "@/lib/company-config"
import { saveTenantDraft, updateTenantProfile } from "@/lib/platform-db"
import { sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function validConfig(value: unknown): value is CompanyConfig {
  if (!value || typeof value !== "object") return false
  const config = value as Partial<CompanyConfig>
  return Boolean(
    config.companyName?.trim() &&
    config.phone !== undefined &&
    (config.licenseNumber === undefined || (typeof config.licenseNumber === "string" && config.licenseNumber.length <= 80)) &&
    (config.googlePlaceId === undefined || (typeof config.googlePlaceId === "string" && config.googlePlaceId.length <= 512)) &&
    (config.showGoogleReviews === undefined || typeof config.showGoogleReviews === "boolean") &&
    config.email !== undefined &&
    config.serviceAreas && typeof config.serviceAreas === "object" &&
    Array.isArray(config.gutterProducts) &&
    config.gutterProducts.length > 0 &&
    config.gutterProducts.every((product) =>
      product?.id && product?.name && product.pricePerFoot &&
      [1, 2, 3].every((tier) => Number.isFinite(product.pricePerFoot[tier as 1 | 2 | 3])),
    ),
  )
}

export async function GET(request: NextRequest) {
  const tenant = await resolveContractorTenant(request)
  if (!tenant) return NextResponse.json({ error: "Sign in to open this template workspace." }, { status: 401 })
  try {
    return NextResponse.json({
      tenantId: tenant.tenant_id,
      config: tenant.draft_config,
      savedAt: tenant.draft_updated_at,
      plan: tenant.plan_code,
      accessState: tenant.access_state,
      deploymentUrl: tenant.deployment_url,
      managedDomain: tenant.managed_domain,
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The template could not be loaded." }, { status: 503 })
  }
}

export async function PUT(request: NextRequest) {
  const tenant = await resolveContractorTenant(request)
  if (!tenant) return NextResponse.json({ error: "Sign in to save this template." }, { status: 401 })
  const tenantId = tenant.tenant_id
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site draft updates are not allowed." }, { status: 403 })

  try {
    const body = await request.json() as { config?: unknown }
    if (!validConfig(body.config)) {
      return NextResponse.json({ error: "Complete the required company and product fields before saving." }, { status: 400 })
    }

    const privateLeadEmail = body.config.leadEmail?.trim() || body.config.email.trim()
    const config: CompanyConfig = { ...body.config, tenantId, leadEmail: privateLeadEmail }
    if (Buffer.byteLength(JSON.stringify(config), "utf8") > 900_000) {
      return NextResponse.json({ error: "This template is too large to save. Use a smaller logo and try again." }, { status: 413 })
    }

    const saved = await saveTenantDraft({ tenantId, config })
    if (!saved) return NextResponse.json({ error: "Contractor workspace not found." }, { status: 404 })
    await updateTenantProfile({ tenantId, companyName: config.companyName, leadEmail: privateLeadEmail, phone: config.phone })
    return NextResponse.json({ ok: true, savedAt: saved.draft_updated_at, config })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The template could not be saved." }, { status: 503 })
  }
}
