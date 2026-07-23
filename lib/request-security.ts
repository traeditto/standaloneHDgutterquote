import "server-only"

import { createHash, randomUUID } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

const localBuckets = new Map<string, { count: number; resetAt: number }>()
let redis: Redis | null | undefined

function redisClient() {
  if (redis !== undefined) return redis
  redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
    : null
  return redis
}

export function requestId(request: Request) {
  return request.headers.get("x-request-id")?.slice(0, 100) || randomUUID()
}

export function clientIp(request: Request) {
  return (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim().slice(0, 100)
}

export function privacyHash(value: string) {
  const pepper = process.env.SECURITY_HASH_PEPPER || process.env.PLATFORM_SESSION_SECRET || "development-only"
  return createHash("sha256").update(`${pepper}:${value}`).digest("hex")
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin) return process.env.NODE_ENV !== "production"
  try {
    const expectedHost = request.headers.get("x-forwarded-host") || request.headers.get("host")
    return Boolean(expectedHost && new URL(origin).host.toLowerCase() === expectedHost.toLowerCase())
  } catch { return false }
}

export async function checkRateLimit(input: {
  request: NextRequest
  scope: string
  identifier?: string
  limit: number
  windowSeconds: number
}) {
  const identifier = input.identifier || privacyHash(clientIp(input.request))
  const key = `${input.scope}:${identifier}`
  const remote = redisClient()
  if (remote) {
    const limiter = new Ratelimit({
      redis: remote,
      limiter: Ratelimit.slidingWindow(input.limit, `${input.windowSeconds} s`),
      prefix: "gutterquote:ratelimit",
      analytics: true,
    })
    const result = await limiter.limit(key)
    return { allowed: result.success, remaining: result.remaining, retryAfter: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)) }
  }

  const now = Date.now()
  const current = localBuckets.get(key)
  if (!current || current.resetAt <= now) {
    localBuckets.set(key, { count: 1, resetAt: now + input.windowSeconds * 1000 })
    return { allowed: true, remaining: input.limit - 1, retryAfter: input.windowSeconds }
  }
  current.count += 1
  return { allowed: current.count <= input.limit, remaining: Math.max(0, input.limit - current.count), retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) }
}

export function rateLimitResponse(retryAfter: number) {
  return NextResponse.json(
    { code: "RATE_LIMITED", error: "Too many requests. Please wait and try again." },
    { status: 429, headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" } },
  )
}
