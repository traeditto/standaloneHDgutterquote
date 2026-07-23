import { NextRequest, NextResponse } from "next/server"
import { verifyAddressToken } from "@/lib/address-verification"
import { getQuoteSession } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { checkRateLimit, rateLimitResponse } from "@/lib/request-security"
import { resolveContractorTenant, resolvePublicTenant } from "@/lib/tenant-context"
import { geocode } from "@/lib/roof-measure-server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const tenant = await resolvePublicTenant(request) ?? await resolveContractorTenant(request)
  if (!tenant) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const sessionId = params.get("sessionId") || ""
  const addressToken = params.get("addressToken") || ""
  const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
  if (!claims || claims.sessionId !== sessionId || !await getQuoteSession(tenant.tenant_id, sessionId)) return NextResponse.json({ error: "Not found." }, { status: 404 })
  const verified = verifyAddressToken(addressToken, tenant.tenant_id, sessionId)
  if (!verified) return NextResponse.json({ error: "The verified address expired." }, { status: 401 })
  const rate = await checkRateLimit({ request, scope: "aerial", identifier: `${tenant.tenant_id}:${sessionId}`, limit: 12, windowSeconds: 3600 })
  if (!rate.allowed) return rateLimitResponse(rate.retryAfter)
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return NextResponse.json({ error: "Aerial view is not configured." }, { status: 503 })

  const zoom = Math.min(21, Math.max(18, Number(params.get("zoom")) || 20))
  const width = Math.min(640, Math.max(320, Number(params.get("w")) || 640))
  const height = Math.min(640, Math.max(240, Number(params.get("h")) || 400))
  const latParam = params.get("lat")
  const lonParam = params.get("lon")
  let lat = latParam === null ? NaN : Number(latParam)
  let lon = lonParam === null ? NaN : Number(lonParam)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    const located = await geocode(verified.address)
    if (located) { lat = located.lat; lon = located.lon }
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return NextResponse.json({ error: "The property location could not be resolved." }, { status: 404 })
  if (params.get("format") === "json") return NextResponse.json({ lat, lon, zoom }, { headers: { "Cache-Control": "private, no-store" } })

  const center = `${lat},${lon}`
  const query = new URLSearchParams({ center, zoom: String(zoom), size: `${width}x${height}`, scale: "2", maptype: "satellite", key: apiKey })
  if (params.get("pin") !== "off") query.set("markers", `color:0xF97316|${center}`)
  try {
    const response = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${query}`, { signal: AbortSignal.timeout(10_000), cache: "no-store" })
    const contentType = response.headers.get("content-type") || ""
    if (!response.ok || !contentType.startsWith("image/")) return NextResponse.json({ error: "The aerial image could not be loaded." }, { status: 502 })
    return new NextResponse(await response.arrayBuffer(), { headers: { "Content-Type": contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
  } catch { return NextResponse.json({ error: "The aerial image could not be loaded." }, { status: 502 }) }
}
