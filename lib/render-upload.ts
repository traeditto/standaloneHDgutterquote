import "server-only"

export type ValidatedRenderUpload = {
  bytes: Buffer
  mimeType: "image/jpeg" | "image/png" | "image/webp"
  extension: "jpg" | "png" | "webp"
}

function detectedImageType(bytes: Buffer): Omit<ValidatedRenderUpload, "bytes"> | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: "image/jpeg", extension: "jpg" }
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mimeType: "image/png", extension: "png" }
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return { mimeType: "image/webp", extension: "webp" }
  }
  return null
}

export async function validateRenderUpload(file: File): Promise<ValidatedRenderUpload> {
  if (file.size <= 0 || file.size > 8_000_000) {
    throw new Error("Upload a JPG, PNG, or WebP image smaller than 8 MB.")
  }
  const bytes = Buffer.from(await file.arrayBuffer())
  const detected = detectedImageType(bytes)
  if (!detected) throw new Error("Upload a valid JPG, PNG, or WebP image.")
  return { bytes, ...detected }
}
