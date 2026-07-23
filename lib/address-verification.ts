import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"

export type VerifiedAddress = {
  placeId: string
  address: string
  state: string
  county: string
}

type AddressTokenPayload = VerifiedAddress & {
  version: 1
  tenantId: string
  sessionId: string
  expiresAt: number
}

function signingSecret() {
  const secret = process.env.PLATFORM_SESSION_SECRET
  if (!secret || secret.length < 32) throw new Error("Address verification is not configured.")
  return secret
}

function signatureFor(encodedPayload: string) {
  return createHmac("sha256", signingSecret()).update(encodedPayload).digest("base64url")
}

export function createAddressToken(input: VerifiedAddress, tenantId: string, sessionId: string) {
  const payload: AddressTokenPayload = {
    version: 1,
    tenantId,
    sessionId,
    ...input,
    expiresAt: Date.now() + 60 * 60 * 1000,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url")
  return `${encodedPayload}.${signatureFor(encodedPayload)}`
}

export function verifyAddressToken(token: string, tenantId: string, sessionId: string): VerifiedAddress | null {
  const [encodedPayload, suppliedSignature, extra] = token.split(".")
  if (!encodedPayload || !suppliedSignature || extra) return null

  const expectedSignature = signatureFor(encodedPayload)
  const suppliedBuffer = Buffer.from(suppliedSignature)
  const expectedBuffer = Buffer.from(expectedSignature)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as AddressTokenPayload
    if (
      payload.version !== 1 ||
      payload.tenantId !== tenantId ||
      payload.sessionId !== sessionId ||
      payload.expiresAt < Date.now() ||
      !payload.placeId ||
      !payload.address ||
      !payload.state ||
      !payload.county
    ) return null

    return {
      placeId: payload.placeId,
      address: payload.address,
      state: payload.state,
      county: payload.county,
    }
  } catch {
    return null
  }
}
