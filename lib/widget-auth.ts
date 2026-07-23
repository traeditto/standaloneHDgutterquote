import { createHmac, timingSafeEqual } from "node:crypto"

export type WidgetClaims = {
  version: 1
  tenantId: string
  parentOrigin: string
  expiresAt: number
}

function secret() {
  const value = process.env.WIDGET_SIGNING_SECRET || process.env.QUOTE_SESSION_SECRET || process.env.PLATFORM_SESSION_SECRET
  if (!value || value.length < 32) throw new Error("WIDGET_SIGNING_SECRET must contain at least 32 characters.")
  return value
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function createWidgetToken(input: Omit<WidgetClaims, "version">) {
  const payload = Buffer.from(JSON.stringify({ version: 1, ...input } satisfies WidgetClaims)).toString("base64url")
  return `${payload}.${signature(payload)}`
}

export function readWidgetToken(value?: string | null) {
  if (!value) return null
  const [payload, supplied, extra] = value.split(".")
  if (!payload || !supplied || extra) return null
  const expectedBytes = Buffer.from(signature(payload), "base64url")
  const suppliedBytes = Buffer.from(supplied, "base64url")
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as WidgetClaims
    if (claims.version !== 1 || !claims.tenantId || !claims.parentOrigin || claims.expiresAt <= Date.now()) return null
    const origin = new URL(claims.parentOrigin).origin.toLowerCase()
    if (origin !== claims.parentOrigin || (!origin.startsWith("https://") && !(process.env.NODE_ENV !== "production" && origin.startsWith("http://")))) return null
    return claims
  } catch { return null }
}
