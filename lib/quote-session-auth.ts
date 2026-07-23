import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export const QUOTE_SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-gq_quote" : "gq_quote"

type QuoteSessionClaims = {
  version: 1
  tenantId: string
  sessionId: string
  expiresAt: number
}

function secret() {
  const value = process.env.QUOTE_SESSION_SECRET || process.env.PLATFORM_SESSION_SECRET
  if (!value || value.length < 32) throw new Error("QUOTE_SESSION_SECRET must contain at least 32 characters.")
  return value
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function createQuoteSessionToken(input: { tenantId: string; sessionId: string; expiresAt: number }) {
  const claims: QuoteSessionClaims = { version: 1, ...input }
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function readQuoteSessionToken(value: string | undefined, expectedTenantId: string) {
  if (!value) return null
  const [payload, signature, extra] = value.split(".")
  if (!payload || !signature || extra) return null
  const expected = Buffer.from(sign(payload), "base64url")
  const supplied = Buffer.from(signature, "base64url")
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as QuoteSessionClaims
    if (claims.version !== 1 || claims.tenantId !== expectedTenantId || claims.expiresAt <= Date.now() || !claims.sessionId) return null
    return claims
  } catch { return null }
}

