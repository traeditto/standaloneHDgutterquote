import "server-only"

import { del, get, put } from "@vercel/blob"

function requireProductionStore() {
  if (process.env.NODE_ENV === "production" && !process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("Private render storage is not configured.")
  }
}

export async function storePrivateImage(pathname: string, bytes: Buffer, contentType = "image/jpeg") {
  requireProductionStore()
  if (!process.env.BLOB_READ_WRITE_TOKEN) return `data:${contentType};base64,${bytes.toString("base64")}`
  const blob = await put(pathname, bytes, { access: "private", contentType, addRandomSuffix: true })
  return blob.url
}

export async function readPrivateImage(url: string) {
  if (url.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(url)
    if (!match) throw new Error("The stored render image is invalid.")
    return { bytes: Buffer.from(match[2], "base64"), contentType: match[1] }
  }
  const result = await get(url, { access: "private" })
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error("The stored render image was not found.")
  return {
    bytes: Buffer.from(await new Response(result.stream).arrayBuffer()),
    contentType: result.blob.contentType || "application/octet-stream",
  }
}

export async function deletePrivateImages(urls: Array<string | null | undefined>) {
  const stored = urls.filter((url): url is string => Boolean(url && !url.startsWith("data:")))
  if (stored.length && process.env.BLOB_READ_WRITE_TOKEN) await del(stored)
}

