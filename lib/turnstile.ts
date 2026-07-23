import "server-only"

export async function verifyTurnstile(token: string | null, remoteIp: string, expectedHostname?: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return process.env.NODE_ENV !== "production"
  if (!token) return false
  const body = new URLSearchParams({ secret, response: token, remoteip: remoteIp })
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) return false
  const result = await response.json() as { success?: boolean; hostname?: string }
  const expected = expectedHostname?.toLowerCase().replace(/:\d+$/, "")
  return result.success === true && (!expected || !result.hostname || result.hostname.toLowerCase() === expected)
}
