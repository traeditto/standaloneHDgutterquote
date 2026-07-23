import { GoogleGenAI } from "@google/genai"
import { NextRequest, NextResponse } from "next/server"
import { verifyAddressToken } from "@/lib/address-verification"
import { consumeDemoRender, getQuoteSession, refundDemoRender } from "@/lib/platform-db"
import { QUOTE_SESSION_COOKIE, readQuoteSessionToken } from "@/lib/quote-session-auth"
import { validateRenderUpload } from "@/lib/render-upload"
import { sameOrigin } from "@/lib/request-security"
import { resolveContractorTenant } from "@/lib/tenant-context"

export const runtime = "nodejs"

type RenderPhoto = {
  bytes: Buffer
  mimeType: string
  source: "streetview" | "upload"
}

async function streetViewPhoto(address: string): Promise<RenderPhoto | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey || !address) return null

  const query = new URLSearchParams({ location: address, source: "outdoor", key: apiKey })
  const metadataResponse = await fetch(`https://maps.googleapis.com/maps/api/streetview/metadata?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (!metadataResponse.ok) return null
  const metadata = await metadataResponse.json() as { status?: string }
  if (metadata.status !== "OK") return null

  const imageQuery = new URLSearchParams({
    location: address,
    size: "640x480",
    fov: "80",
    pitch: "10",
    source: "outdoor",
    key: apiKey,
  })
  const imageResponse = await fetch(`https://maps.googleapis.com/maps/api/streetview?${imageQuery}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  })
  const mimeType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/jpeg"
  if (!imageResponse.ok || !mimeType.startsWith("image/")) return null
  return { bytes: Buffer.from(await imageResponse.arrayBuffer()), mimeType, source: "streetview" }
}

export async function POST(request: NextRequest) {
  let demoCharged = false
  let chargedTenant = ""
  try {
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI gutter rendering is not configured." }, { status: 503 })
    const data = await request.formData()
    const testMode = data.get("testMode") === "true"
    if (!testMode) return NextResponse.json({ code: "QUEUED_RENDER_REQUIRED", error: "Production gutter previews must use the secured render-job endpoint." }, { status: 410 })
    const sessionId = String(data.get("sessionId") || "")
    const addressToken = String(data.get("addressToken") || "")
    const system = String(data.get("system") || "")
    const manufacturer = String(data.get("manufacturer") || "")
    const option = String(data.get("option") || "")
    const color = String(data.get("color") || "")
    const requestedSource = data.get("source") === "upload" ? "upload" : "streetview"
    const photo = data.get("photo")
    if (!sessionId || !addressToken || !system) return NextResponse.json({ error: "A verified property and gutter system are required." }, { status: 400 })
    if (requestedSource === "upload" && (!(photo instanceof File) || photo.size === 0)) return NextResponse.json({ error: "Choose a home photo to use for this rendering." }, { status: 400 })
    if (photo instanceof File && (!photo.type.startsWith("image/") || photo.size > 8_000_000)) return NextResponse.json({ error: "Upload a JPG, PNG, or WebP image smaller than 8 MB." }, { status: 400 })
    if (!sameOrigin(request)) return NextResponse.json({ error: "Cross-site demo renders are not allowed." }, { status: 403 })
    const tenant = await resolveContractorTenant(request)
    if (!tenant) return NextResponse.json({ error: "Sign in to use the free demo render." }, { status: 401 })
    chargedTenant = tenant.tenant_id
    const claims = readQuoteSessionToken(request.cookies.get(QUOTE_SESSION_COOKIE)?.value, tenant.tenant_id)
    if (!claims || claims.sessionId !== sessionId || !await getQuoteSession(tenant.tenant_id, sessionId)) {
      return NextResponse.json({ error: "Your private quote session expired. Refresh the preview and try again." }, { status: 401 })
    }
    const verifiedAddress = verifyAddressToken(addressToken, tenant.tenant_id, sessionId)
    if (!verifiedAddress) return NextResponse.json({ error: "The verified property address expired. Select the address again." }, { status: 400 })
    const address = verifiedAddress.address

    const upload = requestedSource === "upload" && photo instanceof File ? await validateRenderUpload(photo) : null
    const renderPhoto = upload
      ? { bytes: upload.bytes, mimeType: upload.mimeType, source: "upload" as const }
      : await streetViewPhoto(address)
    if (!renderPhoto) {
      return NextResponse.json({
        code: "STREET_VIEW_UNAVAILABLE",
        error: "Google Street View could not find a clear exterior image for this address. Upload a photo of the home instead.",
      }, { status: 422 })
    }

    const remainingCredits = 0
    if (!(await consumeDemoRender(chargedTenant))) {
      return NextResponse.json({ code: "DEMO_RENDER_USED", error: "This workspace's free demo render has already been used." }, { status: 402 })
    }
    demoCharged = true

    const prompt = `Edit this ${renderPhoto.source === "streetview" ? "Google Street View exterior image" : "customer-supplied house photo"} as a realistic gutter visualization. Replace only the visible gutters and downspouts with ${system}${manufacturer ? ` made from ${manufacturer}` : ""}${option ? ` using the ${option} profile` : ""}${color ? ` in ${color}` : ""}. Follow the existing roof edges and drainage locations. Preserve the roof covering, roof geometry, walls, windows, trim, landscaping, sky, camera position, lighting, people, signs, and neighboring property. Do not add gutters where they would be structurally implausible, redesign the house, or add structures. The result is an approximate product visualization, not an architectural plan.`
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image",
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: renderPhoto.mimeType, data: renderPhoto.bytes.toString("base64") } }] }],
      config: { responseModalities: ["TEXT", "IMAGE"] },
    })
    const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)
    if (!imagePart?.inlineData?.data) throw new Error("Gemini did not return a rendered image. Try a clearer exterior photo.")
    return NextResponse.json({
      image: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`,
      sourceImage: `data:${renderPhoto.mimeType};base64,${renderPhoto.bytes.toString("base64")}`,
      source: renderPhoto.source,
      remainingCredits,
      remainingQuoteRenders: 4,
      demoRenderUsed: testMode,
      disclaimer: "AI visualization only. Confirm color and product with a current physical manufacturer sample.",
    })
  } catch (error) {
    if (demoCharged) await refundDemoRender(chargedTenant).catch(() => undefined)
    return NextResponse.json({ error: error instanceof Error ? error.message : "The gutter rendering could not be created." }, { status: 503 })
  }
}
