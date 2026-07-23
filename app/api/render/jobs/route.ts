import { randomUUID } from "node:crypto"
import { after, NextRequest, NextResponse } from "next/server"
import { verifyAddressToken } from "@/lib/address-verification"
import { getQuoteSession, reserveRenderJob } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { checkRateLimit, clientIp, rateLimitResponse, sameOrigin } from "@/lib/request-security"
import { deletePrivateImages, storePrivateImage } from "@/lib/render-storage"
import { validateRenderUpload } from "@/lib/render-upload"
import { processRenderJob } from "@/lib/render-worker"
import { resolvePublicTenant } from "@/lib/tenant-context"
import { verifyTurnstile } from "@/lib/turnstile"

export const runtime = "nodejs"
export const maxDuration = 120

async function streetViewPhoto(address: string) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) throw new Error("Google Street View is not configured.")
  const query = new URLSearchParams({ location: address, source: "outdoor", key: apiKey })
  const metadataResponse = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${query}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) })
  const metadata = metadataResponse.ok ? await metadataResponse.json() as { status?: string } : null
  if (metadata?.status !== "OK") return null
  const imageQuery = new URLSearchParams({ location: address, size: "640x480", fov: "80", pitch: "10", source: "outdoor", key: apiKey })
  const response = await fetch(`https://maps.googleapis.com/maps/api/streetview?${imageQuery}`, { cache: "no-store", signal: AbortSignal.timeout(15_000) })
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) return null
  return Buffer.from(await response.arrayBuffer())
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.RENDER_PLATFORM_PAUSED === "true") return NextResponse.json({ code: "RENDERING_PAUSED", error: "Gutter previews are temporarily paused. Please try again later." }, { status: 503 })
    if (!sameOrigin(request)) return NextResponse.json({ code: "ORIGIN_MISMATCH", error: "Cross-site render requests are not allowed." }, { status: 403 })
    const tenant = await resolvePublicTenant(request)
    if (!tenant) return NextResponse.json({ code: "UNKNOWN_TENANT", error: "This quote site is not registered." }, { status: 404 })
    if (!["active", "grace"].includes(tenant.access_state)) return NextResponse.json({ code: "SITE_UNAVAILABLE", error: "This quote service is temporarily unavailable." }, { status: 402 })
    const data = await request.formData()
    const sessionId = String(data.get("sessionId") || "")
    const addressToken = String(data.get("addressToken") || "")
    const system = String(data.get("system") || "").trim().slice(0, 120)
    const manufacturer = String(data.get("manufacturer") || "").trim().slice(0, 120)
    const option = String(data.get("option") || "").trim().slice(0, 120)
    const color = String(data.get("color") || "").trim().slice(0, 40)
    const idempotencyKey = String(data.get("idempotencyKey") || "")
    const source = data.get("source") === "upload" ? "upload" : "streetview"
    const photo = data.get("photo")
    if (!/^[a-f0-9-]{36}$/i.test(sessionId) || !/^[a-f0-9-]{36}$/i.test(idempotencyKey) || !addressToken || !system) {
      return NextResponse.json({ code: "INVALID_REQUEST", error: "A verified property, roof system, and request key are required." }, { status: 400 })
    }
    const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
    const session = claims?.sessionId === sessionId ? await getQuoteSession(tenant.tenant_id, sessionId) : null
    if (!session) return NextResponse.json({ code: "INVALID_QUOTE_SESSION", error: "Your quote session expired. Refresh the page and try again." }, { status: 401 })
    const address = verifyAddressToken(addressToken, tenant.tenant_id, sessionId)
    if (!address || (session.place_id && session.place_id !== address.placeId)) return NextResponse.json({ code: "INVALID_ADDRESS", error: "The verified property address is invalid or expired." }, { status: 400 })
    const rate = await checkRateLimit({ request, scope: "render-job", identifier: `${tenant.tenant_id}:${sessionId}`, limit: 8, windowSeconds: 3600 })
    if (!rate.allowed) return rateLimitResponse(rate.retryAfter)
    const ipRate = await checkRateLimit({ request, scope: "render-job-ip", limit: 20, windowSeconds: 3600 })
    if (!ipRate.allowed) return rateLimitResponse(ipRate.retryAfter)
    if (!await verifyTurnstile(String(data.get("turnstileToken") || "") || null, clientIp(request), request.headers.get("x-forwarded-host") || request.headers.get("host") || undefined)) {
      return NextResponse.json({ code: "BOT_CHECK_FAILED", error: "Please complete the security check and try again." }, { status: 403 })
    }

    let bytes: Buffer | null
    let contentType = "image/jpeg"
    let extension = "jpg"
    if (source === "upload") {
      if (!(photo instanceof File)) return NextResponse.json({ code: "PHOTO_REQUIRED", error: "Choose a home photo to use for this rendering." }, { status: 400 })
      const upload = await validateRenderUpload(photo)
      bytes = upload.bytes
      contentType = upload.mimeType
      extension = upload.extension
    } else {
      bytes = await streetViewPhoto(address.address)
      if (!bytes) return NextResponse.json({ code: "STREET_VIEW_UNAVAILABLE", error: "Google Street View could not find a clear exterior image. Upload a photo of the home instead." }, { status: 422 })
    }
    const sourceUrl = await storePrivateImage(`renders/${tenant.tenant_id}/${sessionId}/${randomUUID()}-source.${extension}`, bytes, contentType)
    const reserved = await reserveRenderJob({ tenantId: tenant.tenant_id, sessionId, idempotencyKey, source, sourceBlobUrl: sourceUrl, system, manufacturer, option, color })
    if (!reserved.ok) {
      await deletePrivateImages([sourceUrl]).catch(() => undefined)
      if (reserved.reason === "quote_limit") return NextResponse.json({ code: "QUOTE_RENDER_LIMIT", error: "All four gutter previews for this quote have been used.", remainingQuoteRenders: 0 }, { status: 429 })
      if (reserved.reason === "active_job") return NextResponse.json({ code: "RENDER_IN_PROGRESS", error: "A roof preview is already being created for this quote." }, { status: 409 })
      if (reserved.reason === "tenant_busy") return NextResponse.json({ code: "TENANT_RENDER_BUSY", error: "This contractor is creating several gutter previews right now. Please try again shortly." }, { status: 429, headers: { "Retry-After": "15" } })
      if (reserved.reason === "tenant_daily_limit") return NextResponse.json({ code: "TENANT_DAILY_RENDER_LIMIT", error: "This contractor's daily gutter-preview safety limit has been reached." }, { status: 429, headers: { "Retry-After": "3600" } })
      if (reserved.reason === "no_credits") return NextResponse.json({ code: "NO_RENDER_CREDITS", error: "This contractor has no gutter-preview credits available." }, { status: 402 })
      return NextResponse.json({ code: "INVALID_QUOTE_SESSION", error: "The saved quote session could not be found." }, { status: 400 })
    }
    if (reserved.duplicate) await deletePrivateImages([sourceUrl]).catch(() => undefined)
    if (!reserved.duplicate && reserved.job.status === "queued") after(() => processRenderJob(reserved.job.id))
    return NextResponse.json({ jobId: reserved.job.id, status: reserved.job.status, remainingQuoteRenders: reserved.remainingQuoteRenders }, { status: reserved.duplicate ? 200 : 202 })
  } catch (error) {
    return NextResponse.json({ code: "RENDER_JOB_FAILED", error: error instanceof Error ? error.message : "The gutter preview could not be queued." }, { status: 503 })
  }
}
