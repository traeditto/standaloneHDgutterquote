import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export const PLATFORM_ADMIN_COOKIE = "gutterquote_platform_admin"

function safeTextEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(actual)
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer)
}

function configuredAdminEmail() {
  const value = process.env.PLATFORM_ADMIN_EMAIL?.trim().toLowerCase()
  if (!value || !value.includes("@") || value.length > 254) {
    throw new Error("PLATFORM_ADMIN_EMAIL must contain a valid email address.")
  }
  return value
}

function sessionSecret() {
  const value = process.env.PLATFORM_SESSION_SECRET
  if (!value || value.length < 32) throw new Error("PLATFORM_SESSION_SECRET must contain at least 32 characters.")
  return value
}

export function verifyPlatformCredentials(email: string, password: string) {
  const suppliedEmail = email.trim().toLowerCase()
  const expectedEmail = configuredAdminEmail()
  const configured = process.env.PLATFORM_ADMIN_PASSWORD
  if (!configured || configured.length < 12) throw new Error("PLATFORM_ADMIN_PASSWORD must contain at least 12 characters.")
  return safeTextEqual(expectedEmail, suppliedEmail) && safeTextEqual(configured, password)
}

export function createPlatformAdminSession(email: string) {
  const payload = Buffer.from(JSON.stringify({
    role: "platform-admin",
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  })).toString("base64url")
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function readPlatformAdminSession(value?: string) {
  if (!value) return false
  const [payload, supplied] = value.split(".")
  if (!payload || !supplied) return false
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest()
  const actual = Buffer.from(supplied, "base64url")
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { role?: string; email?: string; expiresAt?: number }
    return parsed.role === "platform-admin" &&
      parsed.email === configuredAdminEmail() &&
      Boolean(parsed.expiresAt && parsed.expiresAt > Date.now())
  } catch {
    return false
  }
}
