import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant } from "@/lib/tenant-context"
import { getManagedDomainQuote, VercelDomainError } from "@/lib/vercel-domains"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site domain searches are not allowed." }, { status: 403 })
  const tenant = await resolveContractorTenant(request)
  if (!tenant) return NextResponse.json({ error: "Sign in before checking a managed domain." }, { status: 401 })
  const rate = await checkRateLimit({ request, scope: "domain-check", identifier: tenant.tenant_id, limit: 20, windowSeconds: 3600 })
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter)
  try {
    const body = await request.json() as { domain?: string }
    return NextResponse.json(await getManagedDomainQuote(body.domain || "", { allowedOwnedDomain: tenant.managed_domain }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The domain could not be checked." }, { status: error instanceof VercelDomainError ? error.status : 502 })
  }
}
