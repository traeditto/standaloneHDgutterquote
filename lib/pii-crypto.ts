import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto"

const PREFIX = "rqenc"

function activeVersion() {
  const value = Number(process.env.PII_ENCRYPTION_KEY_VERSION || 1)
  if (!Number.isSafeInteger(value) || value < 1 || value > 99) throw new Error("PII_ENCRYPTION_KEY_VERSION is invalid.")
  return value
}

function encryptionKey(version: number) {
  const material = process.env[`PII_ENCRYPTION_KEY_V${version}`] || (process.env.NODE_ENV !== "production" ? process.env.PLATFORM_SESSION_SECRET : undefined)
  if (!material || material.length < 32) throw new Error(`PII_ENCRYPTION_KEY_V${version} must be supplied by the production secret manager.`)
  return createHash("sha256").update(material).digest()
}

export function encryptPii(value: string | null | undefined) {
  if (!value) return value ?? null
  if (value.startsWith(`${PREFIX}:v`)) return value
  const version = activeVersion()
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(version), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}:v${version}:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`
}

export function decryptPii(value: string | null | undefined) {
  if (!value || !value.startsWith(`${PREFIX}:v`)) return value ?? null
  const [namespace, version, ivValue, tagValue, encryptedValue] = value.split(":")
  const versionNumber = Number(version?.replace(/^v/, ""))
  if (namespace !== PREFIX || !Number.isSafeInteger(versionNumber) || !ivValue || !tagValue || !encryptedValue) throw new Error("Encrypted lead data is malformed.")
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(versionNumber), Buffer.from(ivValue, "base64url"))
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"))
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8")
}
