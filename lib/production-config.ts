export type ReadinessGroup = {
  id: string
  label: string
  missing: string[]
  ready: boolean
}

const GROUPS: Array<{ id: string; label: string; variables: string[] }> = [
  { id: "core", label: "Core security", variables: ["PLATFORM_SESSION_SECRET", "QUOTE_SESSION_SECRET", "SECURITY_HASH_PEPPER", "WIDGET_SIGNING_SECRET", "CRON_SECRET", "NEXT_PUBLIC_APP_URL", "PLATFORM_HOSTS"] },
  { id: "database", label: "Database and tenant isolation", variables: ["DATABASE_URL", "PLATFORM_DATABASE_URL", "PII_ENCRYPTION_KEY_V1"] },
  { id: "identity", label: "Clerk identity", variables: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY", "CLERK_WEBHOOK_SIGNING_SECRET"] },
  { id: "abuse", label: "Abuse prevention", variables: ["NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY"] },
  { id: "providers", label: "Maps, imagery, and rendering", variables: ["GOOGLE_MAPS_API_KEY", "GEMINI_API_KEY", "BLOB_READ_WRITE_TOKEN"] },
  { id: "billing", label: "Stripe billing", variables: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_SUBSCRIPTION_PRICE_ID", "STRIPE_SETUP_PRICE_ID", "STRIPE_INTRO_COUPON_ID", "STRIPE_RENDER_PRICE_ID"] },
  { id: "hosting", label: "Managed hosting", variables: ["VERCEL_TOKEN", "VERCEL_TEAM_ID", "VERCEL_PLATFORM_PROJECT_ID", "VERCEL_PLATFORM_PROJECT_NAME"] },
  { id: "domain", label: "Domain registration", variables: ["DOMAIN_REGISTRANT_FIRST_NAME", "DOMAIN_REGISTRANT_LAST_NAME", "DOMAIN_REGISTRANT_EMAIL", "DOMAIN_REGISTRANT_PHONE", "DOMAIN_REGISTRANT_ADDRESS1", "DOMAIN_REGISTRANT_CITY", "DOMAIN_REGISTRANT_STATE", "DOMAIN_REGISTRANT_ZIP", "DOMAIN_REGISTRANT_COUNTRY", "DOMAIN_REGISTRANT_COMPANY"] },
  { id: "email", label: "Lead email", variables: ["RESEND_API_KEY", "LEAD_FROM_EMAIL"] },
]

export function productionReadiness(env: Record<string, string | undefined>) {
  const groups: ReadinessGroup[] = GROUPS.map((group) => {
    const missing = group.variables.filter((name) => !env[name]?.trim())
    return { id: group.id, label: group.label, missing, ready: missing.length === 0 }
  })
  return {
    ready: groups.every((group) => group.ready),
    groups,
    missing: groups.flatMap((group) => group.missing),
  }
}
