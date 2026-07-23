import "server-only"

import { GoogleGenAI } from "@google/genai"
import { claimRenderJob, completeRenderJob, failRenderJob } from "@/lib/platform-db"
import { suppressFaintBleed } from "@/lib/gutter-composite"
import { readPrivateImage, storePrivateImage } from "@/lib/render-storage"

export async function processRenderJob(jobId: string) {
  const job = await claimRenderJob(jobId)
  if (!job) return
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("AI gutter rendering is not configured.")
    const source = await readPrivateImage(job.source_blob_url || "")
    const prompt = `Edit this ${job.source === "streetview" ? "Google Street View exterior image" : "customer-supplied house photo"} as a realistic gutter visualization. Replace only the visible gutters and downspouts with ${job.system_name}${job.manufacturer ? ` using ${job.manufacturer}` : ""}${job.option_name ? ` in the ${job.option_name} profile and size` : ""}${job.color ? ` with the finish ${job.color}` : ""}. Preserve the roof covering, fascia, soffits, walls, windows, doors, landscaping, sky, camera position, lighting, people, signs, and neighboring property. Follow the existing eaves and downspout paths; do not add floating gutters, change roof geometry, redesign the house, or add structures. The result is an approximate product visualization, not an installation plan.`
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
    const response = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-lite-image",
      contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: source.contentType, data: source.bytes.toString("base64") } }] }],
      config: { responseModalities: ["TEXT", "IMAGE"] },
    })
    const imagePart = response.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data)
    if (!imagePart?.inlineData?.data) throw new Error("Gemini did not return a rendered image. Try a clearer exterior photo.")
    const generated = Buffer.from(imagePart.inlineData.data, "base64")
    const cleaned = await suppressFaintBleed(source.bytes, generated).catch(() => ({
      bytes: generated,
      mediaType: imagePart.inlineData?.mimeType || "image/png",
    }))
    const resultUrl = await storePrivateImage(
      `renders/${job.tenant_id}/${job.quote_session_id}/${job.id}-result.png`,
      cleaned.bytes,
      cleaned.mediaType,
    )
    await completeRenderJob({ jobId, resultBlobUrl: resultUrl })
  } catch (error) {
    await failRenderJob({
      jobId,
      errorCode: "PROVIDER_FAILED",
      errorMessage: error instanceof Error ? error.message : "The gutter rendering could not be created.",
      refundCredit: true,
    }).catch(() => undefined)
  }
}
