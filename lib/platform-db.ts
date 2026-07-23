import "server-only"

import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { Pool, type PoolClient, type QueryResultRow } from "pg"
import { decryptPii, encryptPii } from "@/lib/pii-crypto"

const scrypt = promisify(scryptCallback)
let pool: Pool | undefined
let systemPool: Pool | undefined
let schemaReady: Promise<void> | undefined

export type StripeSubscriptionStatus =
  | "inactive"
  | "trialing"
  | "active"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused"

export type SiteAccessState = "inactive" | "active" | "grace" | "suspended"

export type TenantRecord = {
  internal_id: string
  tenant_id: string
  company_name: string
  lead_email: string
  contact_name: string | null
  phone: string | null
  password_hash: string
  plan_code: "demo" | "launch"
  draft_config: unknown | null
  draft_updated_at: string | null
  render_credits: number
  demo_render_used_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: StripeSubscriptionStatus
  access_state: SiteAccessState
  grace_ends_at: string | null
  subscription_period_end: string | null
  vercel_project_id: string | null
  vercel_project_name: string | null
  deployment_url: string | null
  managed_domain: string | null
  clerk_org_id: string | null
  completed_lead_retention_months: number
  created_at: string
  updated_at: string
}

export type LeadRecord = {
  id: string
  session_id: string
  status: "started" | "completed"
  address: string
  state: string
  county: string
  name: string | null
  email: string | null
  phone: string | null
  quote: Record<string, unknown> | null
  notification_status?: LeadNotificationStatus | null
  notification_recipient?: string | null
  created_at: string
  updated_at: string
}

export type LeadNotificationStatus = "queued" | "processing" | "sent" | "failed"

export type LeadNotificationRecord = {
  id: string
  tenant_id: string
  lead_id: string
  event_type: "lead.contact_provided" | "quote.completed"
  recipient: string
  status: LeadNotificationStatus
  attempts: number
  provider_message_id: string | null
  last_error: string | null
  locked_at: string | null
  next_attempt_at: string
  sent_at: string | null
  created_at: string
  updated_at: string
}

export type ClaimedLeadNotification = LeadNotificationRecord & {
  company_name: string
  address: string
  state: string
  county: string
  name: string
  email: string
  phone: string
  quote: Record<string, unknown> | null
}

export type QuoteSessionRecord = {
  id: string
  tenant_id: string
  status: "started" | "completed" | "expired"
  place_id: string | null
  render_attempts: number
  expires_at: string
  created_at: string
  updated_at: string
}

export type RenderJobStatus = "queued" | "processing" | "succeeded" | "failed"

export type RenderJobRecord = {
  id: string
  tenant_id: string
  quote_session_id: string
  idempotency_key: string
  status: RenderJobStatus
  source: "streetview" | "upload"
  source_blob_url: string | null
  result_blob_url: string | null
  system_name: string
  manufacturer: string | null
  option_name: string | null
  color: string | null
  error_code: string | null
  error_message: string | null
  remaining_credits: number | null
  provider_started_at: string | null
  completed_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export type PlatformOverview = {
  contractors: number
  activeSubscriptions: number
  billingAttention: number
  liveWebsites: number
  leadsLast30Days: number
  completedQuotesLast30Days: number
  rendersLast30Days: number
  failedRendersLast30Days: number
  activeRenderJobs: number
  failedLeadNotifications: number
  availableRenderCredits: number
}

export type PlatformAuditRecord = {
  id: string
  tenant_id: string | null
  company_name: string | null
  actor_type: "contractor" | "platform" | "system" | "homeowner"
  action: string
  target_type: string | null
  created_at: string
}

export type PlatformIncompleteSignup = {
  tenant_id: string
  company_name: string
  contact_name: string | null
  lead_email: string
  phone: string | null
  plan_code: "demo" | "launch"
  subscription_status: StripeSubscriptionStatus
  created_at: string
  draft_updated_at: string | null
  demo_render_used_at: string | null
  test_sessions: number
  latest_version_status: "approved" | "provisioning" | "live" | "failed" | null
  last_activity_at: string
  setup_stage: "Account created" | "Template started" | "Template configured" | "Demo testing" | "Checkout started"
}

export type PlatformTenantDetail = {
  leadCount: number
  completedLeadCount: number
  abandonedLeadCount: number
  quoteSessionCount: number
  renderCount: number
  successfulRenderCount: number
  failedRenderCount: number
  failedNotificationCount: number
  domains: Array<{ hostname: string; status: string; is_primary: boolean; verified_at: string | null }>
  versions: Array<{ id: string; version: number; status: string; approved_by: string; approved_at: string; deployment_url: string | null; failure_reason: string | null }>
  audit: PlatformAuditRecord[]
}

export type SiteVersionRecord = {
  id: string
  tenant_id: string
  version: number
  config_hash: string
  config: unknown
  status: "approved" | "provisioning" | "live" | "failed"
  approved_by: string
  approved_at: string
  github_repo: string | null
  vercel_project: string | null
  deployment_url: string | null
  failure_reason: string | null
  updated_at: string
}

function database() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.")
  const configuredMax = Number(process.env.DATABASE_POOL_MAX || 5)
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number.isSafeInteger(configuredMax) ? Math.max(1, Math.min(20, configuredMax)) : 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
  })
  return pool
}

function systemDatabase() {
  const connectionString = process.env.PLATFORM_DATABASE_URL || process.env.DATABASE_URL
  if (!connectionString) throw new Error("PLATFORM_DATABASE_URL or DATABASE_URL is not configured.")
  systemPool ??= new Pool({ connectionString, max: 2, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined })
  return systemPool
}

async function tenantQuery<T extends QueryResultRow = QueryResultRow>(tenantId: string, text: string, values: unknown[] = []) {
  const client = await database().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
    const result = await client.query<T>(text, values)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}

async function ensureSchema() {
  schemaReady ??= systemDatabase().query(`
    CREATE TABLE IF NOT EXISTS gutterquote_tenants (
      internal_id UUID NOT NULL DEFAULT gen_random_uuid(),
      tenant_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      lead_email TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      plan_code TEXT NOT NULL DEFAULT 'demo' CHECK (plan_code IN ('demo', 'launch')),
      draft_config JSONB,
      draft_updated_at TIMESTAMPTZ,
      render_credits INTEGER NOT NULL DEFAULT 0 CHECK (render_credits >= 0),
      demo_render_used_at TIMESTAMPTZ,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'inactive',
      access_state TEXT NOT NULL DEFAULT 'inactive',
      grace_ends_at TIMESTAMPTZ,
      subscription_period_end TIMESTAMPTZ,
      vercel_project_id TEXT,
      vercel_project_name TEXT,
      deployment_url TEXT,
      managed_domain TEXT,
      clerk_org_id TEXT,
      completed_lead_retention_months INTEGER NOT NULL DEFAULT 24 CHECK (completed_lead_retention_months BETWEEN 1 AND 24),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gutterquote_leads (
      id UUID PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES gutterquote_tenants(tenant_id) ON DELETE CASCADE,
      session_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed')),
      address TEXT NOT NULL,
      state TEXT NOT NULL,
      county TEXT NOT NULL,
      name TEXT,
      email TEXT,
      phone TEXT,
      quote JSONB,
      render_attempts INTEGER NOT NULL DEFAULT 0 CHECK (render_attempts BETWEEN 0 AND 4),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, session_id)
    );
    CREATE INDEX IF NOT EXISTS gutterquote_leads_tenant_updated_idx ON gutterquote_leads (tenant_id, updated_at DESC);
    CREATE TABLE IF NOT EXISTS gutterquote_lead_notifications (
      id UUID PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES gutterquote_tenants(tenant_id) ON DELETE CASCADE,
      lead_id UUID NOT NULL REFERENCES gutterquote_leads(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('lead.contact_provided', 'quote.completed')),
      recipient TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 8),
      provider_message_id TEXT,
      last_error TEXT,
      locked_at TIMESTAMPTZ,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, lead_id, event_type)
    );
    CREATE INDEX IF NOT EXISTS gutterquote_lead_notifications_due_idx
      ON gutterquote_lead_notifications (status, next_attempt_at) WHERE status = 'queued';
    CREATE TABLE IF NOT EXISTS gutterquote_tenant_domains (
      hostname TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES gutterquote_tenants(tenant_id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'disabled')),
      is_primary BOOLEAN NOT NULL DEFAULT FALSE,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS gutterquote_tenant_domains_tenant_idx ON gutterquote_tenant_domains (tenant_id, status);
    CREATE TABLE IF NOT EXISTS gutterquote_quote_sessions (
      id UUID PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES gutterquote_tenants(tenant_id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'expired')),
      place_id TEXT,
      render_attempts INTEGER NOT NULL DEFAULT 0 CHECK (render_attempts BETWEEN 0 AND 4),
      ip_hash TEXT,
      user_agent_hash TEXT,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS gutterquote_quote_sessions_tenant_updated_idx ON gutterquote_quote_sessions (tenant_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS gutterquote_quote_sessions_expiry_idx ON gutterquote_quote_sessions (expires_at);
    CREATE TABLE IF NOT EXISTS gutterquote_render_jobs (
      id UUID PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES gutterquote_tenants(tenant_id) ON DELETE CASCADE,
      quote_session_id UUID NOT NULL REFERENCES gutterquote_quote_sessions(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'succeeded', 'failed')),
      source TEXT NOT NULL CHECK (source IN ('streetview', 'upload')),
      source_blob_url TEXT,
      result_blob_url TEXT,
      system_name TEXT NOT NULL,
      manufacturer TEXT,
      option_name TEXT,
      color TEXT,
      error_code TEXT,
      error_message TEXT,
      remaining_credits INTEGER,
      provider_started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, quote_session_id, idempotency_key)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS gutterquote_render_jobs_one_active_idx
      ON gutterquote_render_jobs (tenant_id, quote_session_id) WHERE status IN ('queued', 'processing');
    CREATE INDEX IF NOT EXISTS gutterquote_render_jobs_expiry_idx ON gutterquote_render_jobs (expires_at);
    CREATE TABLE IF NOT EXISTS gutterquote_audit_events (
      id UUID PRIMARY KEY,
      tenant_id TEXT REFERENCES gutterquote_tenants(tenant_id) ON DELETE SET NULL,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('contractor', 'platform', 'system', 'homeowner')),
      actor_id TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      request_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS gutterquote_audit_events_tenant_created_idx ON gutterquote_audit_events (tenant_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS gutterquote_credit_ledger (
      id UUID PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES gutterquote_tenants(tenant_id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT NOT NULL,
      event_key TEXT UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS gutterquote_site_versions (
      id UUID PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES gutterquote_tenants(tenant_id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      config_hash TEXT NOT NULL,
      config JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'provisioning', 'live', 'failed')),
      approved_by TEXT NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      github_repo TEXT,
      vercel_project TEXT,
      deployment_url TEXT,
      failure_reason TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (tenant_id, version),
      UNIQUE (tenant_id, config_hash)
    );
    CREATE TABLE IF NOT EXISTS gutterquote_stripe_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS gutterquote_clerk_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ
    );
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS plan_code TEXT NOT NULL DEFAULT 'demo';
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS contact_name TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS phone TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS draft_config JSONB;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS draft_updated_at TIMESTAMPTZ;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS demo_render_used_at TIMESTAMPTZ;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive';
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS access_state TEXT NOT NULL DEFAULT 'inactive';
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS grace_ends_at TIMESTAMPTZ;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMPTZ;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS vercel_project_id TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS vercel_project_name TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS deployment_url TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS managed_domain TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS internal_id UUID;
    UPDATE gutterquote_tenants SET internal_id = gen_random_uuid() WHERE internal_id IS NULL;
    ALTER TABLE gutterquote_tenants ALTER COLUMN internal_id SET DEFAULT gen_random_uuid();
    ALTER TABLE gutterquote_tenants ALTER COLUMN internal_id SET NOT NULL;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS clerk_org_id TEXT;
    ALTER TABLE gutterquote_tenants ADD COLUMN IF NOT EXISTS completed_lead_retention_months INTEGER NOT NULL DEFAULT 24;
    ALTER TABLE gutterquote_leads ADD COLUMN IF NOT EXISTS render_attempts INTEGER NOT NULL DEFAULT 0;
    CREATE UNIQUE INDEX IF NOT EXISTS gutterquote_tenants_internal_id_idx ON gutterquote_tenants (internal_id);
    CREATE UNIQUE INDEX IF NOT EXISTS gutterquote_tenants_clerk_org_idx ON gutterquote_tenants (clerk_org_id) WHERE clerk_org_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS gutterquote_tenants_stripe_customer_idx ON gutterquote_tenants (stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS gutterquote_tenants_stripe_subscription_idx ON gutterquote_tenants (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
    ALTER TABLE gutterquote_tenants ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_leads ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_credit_ledger ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_site_versions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_tenant_domains ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_quote_sessions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_render_jobs ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_audit_events ENABLE ROW LEVEL SECURITY;
    ALTER TABLE gutterquote_lead_notifications ENABLE ROW LEVEL SECURITY;
    DO $$ BEGIN
      CREATE POLICY gutterquote_tenants_tenant_policy ON gutterquote_tenants
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_leads_tenant_policy ON gutterquote_leads
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_credit_ledger_tenant_policy ON gutterquote_credit_ledger
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_site_versions_tenant_policy ON gutterquote_site_versions
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_tenant_domains_tenant_policy ON gutterquote_tenant_domains
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_quote_sessions_tenant_policy ON gutterquote_quote_sessions
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_render_jobs_tenant_policy ON gutterquote_render_jobs
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_audit_events_tenant_policy ON gutterquote_audit_events
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR tenant_id IS NULL)
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '') OR tenant_id IS NULL);
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE POLICY gutterquote_lead_notifications_tenant_policy ON gutterquote_lead_notifications
        USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''))
        WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), ''));
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `).then(() => undefined)
  return schemaReady
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = (await scrypt(password, salt, 64)) as Buffer
  return `scrypt:${salt.toString("base64url")}:${derived.toString("base64url")}`
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, saltValue, hashValue] = stored.split(":")
  if (scheme !== "scrypt" || !saltValue || !hashValue) return false
  const expected = Buffer.from(hashValue, "base64url")
  const actual = (await scrypt(password, Buffer.from(saltValue, "base64url"), expected.length)) as Buffer
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function upsertTenant(input: { tenantId: string; companyName: string; leadEmail: string; passwordHash: string }) {
  await ensureSchema()
  await systemDatabase().query(
    `INSERT INTO gutterquote_tenants (tenant_id, company_name, lead_email, password_hash)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tenant_id) DO UPDATE SET company_name = EXCLUDED.company_name, lead_email = EXCLUDED.lead_email,
       password_hash = EXCLUDED.password_hash, updated_at = NOW()`,
    [input.tenantId, input.companyName, input.leadEmail, input.passwordHash],
  )
}

export async function createSignupTenant(input: {
  tenantId: string
  companyName: string
  leadEmail: string
  contactName: string
  phone: string
  passwordHash: string
  planCode: "demo" | "launch"
}) {
  await ensureSchema()
  const result = await systemDatabase().query<TenantRecord>(
    `INSERT INTO gutterquote_tenants (tenant_id, company_name, lead_email, contact_name, phone, password_hash, plan_code)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (tenant_id) DO NOTHING
     RETURNING *`,
    [input.tenantId, input.companyName, input.leadEmail, input.contactName, input.phone, input.passwordHash, input.planCode],
  )
  return result.rows[0] ?? null
}

export async function updateTenantProfile(input: { tenantId: string; companyName: string; leadEmail: string; phone?: string; planCode?: "demo" | "launch" }) {
  await ensureSchema()
  const result = await tenantQuery<TenantRecord>(input.tenantId,
    `UPDATE gutterquote_tenants SET company_name = $2, lead_email = $3,
       plan_code = COALESCE($4, plan_code), phone = COALESCE($5, phone), updated_at = NOW()
     WHERE tenant_id = $1 RETURNING *`,
    [input.tenantId, input.companyName, input.leadEmail, input.planCode ?? null, input.phone ?? null],
  )
  return result.rows[0] ?? null
}

export async function saveTenantDraft(input: { tenantId: string; config: unknown }) {
  await ensureSchema()
  const result = await tenantQuery<TenantRecord>(input.tenantId,
    `UPDATE gutterquote_tenants SET draft_config = $2, draft_updated_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 RETURNING *`,
    [input.tenantId, JSON.stringify(input.config)],
  )
  return result.rows[0] ?? null
}

export async function getTenant(tenantId: string) {
  await ensureSchema()
  const result = await tenantQuery<TenantRecord>(tenantId, "SELECT * FROM gutterquote_tenants WHERE tenant_id = $1", [tenantId])
  return result.rows[0] ?? null
}

export async function getTenantByClerkOrganization(clerkOrgId: string) {
  await ensureSchema()
  const result = await systemDatabase().query<TenantRecord>(
    "SELECT * FROM gutterquote_tenants WHERE clerk_org_id = $1",
    [clerkOrgId],
  )
  return result.rows[0] ?? null
}

export async function linkTenantClerkOrganization(tenantId: string, clerkOrgId: string) {
  await ensureSchema()
  const result = await tenantQuery<TenantRecord>(tenantId,
    "UPDATE gutterquote_tenants SET clerk_org_id = $2, updated_at = NOW() WHERE tenant_id = $1 RETURNING *",
    [tenantId, clerkOrgId],
  )
  return result.rows[0] ?? null
}

export async function registerTenantDomain(input: { tenantId: string; hostname: string; verified?: boolean; primary?: boolean }) {
  await ensureSchema()
  const hostname = input.hostname.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
  if (!hostname) throw new Error("A hostname is required.")
  const client = await database().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId])
    if (input.primary) {
      await client.query("UPDATE gutterquote_tenant_domains SET is_primary = FALSE, updated_at = NOW() WHERE tenant_id = $1", [input.tenantId])
    }
    const result = await client.query(
      `INSERT INTO gutterquote_tenant_domains (hostname, tenant_id, status, is_primary, verified_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (hostname) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, status = EXCLUDED.status,
         is_primary = EXCLUDED.is_primary, verified_at = EXCLUDED.verified_at, updated_at = NOW()
       RETURNING *`,
      [hostname, input.tenantId, input.verified ? "verified" : "pending", Boolean(input.primary), input.verified ? new Date() : null],
    )
    await client.query("COMMIT")
    return result.rows[0]
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}

export async function getTenantByHostname(hostnameValue: string) {
  await ensureSchema()
  const hostname = hostnameValue.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
  const result = await systemDatabase().query<TenantRecord>(
    `SELECT tenant.* FROM gutterquote_tenants tenant
     JOIN gutterquote_tenant_domains domain ON domain.tenant_id = tenant.tenant_id
     WHERE domain.hostname = $1 AND domain.status = 'verified'`,
    [hostname],
  )
  return result.rows[0] ?? null
}

export async function getPublishedTenantConfig(tenantId: string) {
  await ensureSchema()
  const version = await tenantQuery<{ config: unknown }>(tenantId,
    `SELECT config FROM gutterquote_site_versions
     WHERE tenant_id = $1 AND status = 'live'
     ORDER BY version DESC LIMIT 1`,
    [tenantId],
  )
  if (version.rows[0]) return version.rows[0].config
  const tenant = await getTenant(tenantId)
  return tenant?.draft_config ?? null
}

export async function createQuoteSession(input: { tenantId: string; ipHash?: string; userAgentHash?: string; ttlHours?: number }) {
  await ensureSchema()
  const id = randomUUID()
  const result = await tenantQuery<QuoteSessionRecord>(input.tenantId,
    `INSERT INTO gutterquote_quote_sessions (id, tenant_id, ip_hash, user_agent_hash, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + ($5 * INTERVAL '1 hour')) RETURNING *`,
    [id, input.tenantId, input.ipHash ?? null, input.userAgentHash ?? null, input.ttlHours ?? 24],
  )
  return result.rows[0]
}

export async function getQuoteSession(tenantId: string, sessionId: string) {
  await ensureSchema()
  const result = await tenantQuery<QuoteSessionRecord>(tenantId,
    `SELECT * FROM gutterquote_quote_sessions
     WHERE tenant_id = $1 AND id::text = $2 AND status <> 'expired' AND expires_at > NOW()`,
    [tenantId, sessionId],
  )
  return result.rows[0] ?? null
}

export async function bindQuoteSessionAddress(input: { tenantId: string; sessionId: string; placeId: string }) {
  await ensureSchema()
  const result = await tenantQuery<QuoteSessionRecord>(input.tenantId,
    `UPDATE gutterquote_quote_sessions SET place_id = $3, updated_at = NOW()
     WHERE tenant_id = $1 AND id::text = $2 AND status = 'started' AND expires_at > NOW()
       AND (place_id IS NULL OR place_id = $3)
     RETURNING *`,
    [input.tenantId, input.sessionId, input.placeId],
  )
  return result.rows[0] ?? null
}

export async function completeQuoteSession(tenantId: string, sessionId: string) {
  await ensureSchema()
  const result = await tenantQuery<QuoteSessionRecord>(tenantId,
    `UPDATE gutterquote_quote_sessions SET status = 'completed', updated_at = NOW()
     WHERE tenant_id = $1 AND id::text = $2 AND status = 'started' AND expires_at > NOW() RETURNING *`,
    [tenantId, sessionId],
  )
  return result.rows[0] ?? null
}

export type ReserveRenderJobResult =
  | { ok: true; job: RenderJobRecord; remainingQuoteRenders: number; duplicate: boolean }
  | { ok: false; reason: "missing_session" | "quote_limit" | "active_job" | "tenant_busy" | "tenant_daily_limit" | "no_credits" }

export async function reserveRenderJob(input: {
  tenantId: string
  sessionId: string
  idempotencyKey: string
  source: "streetview" | "upload"
  sourceBlobUrl: string
  system: string
  manufacturer?: string
  option?: string
  color?: string
}): Promise<ReserveRenderJobResult> {
  await ensureSchema()
  const client = await database().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId])
    const existing = await client.query<RenderJobRecord>(
      `SELECT * FROM gutterquote_render_jobs WHERE tenant_id = $1 AND quote_session_id::text = $2 AND idempotency_key = $3`,
      [input.tenantId, input.sessionId, input.idempotencyKey],
    )
    if (existing.rows[0]) {
      const session = await client.query<{ render_attempts: number }>(
        "SELECT render_attempts FROM gutterquote_quote_sessions WHERE tenant_id = $1 AND id::text = $2",
        [input.tenantId, input.sessionId],
      )
      await client.query("COMMIT")
      return { ok: true, job: existing.rows[0], remainingQuoteRenders: Math.max(0, 4 - (session.rows[0]?.render_attempts ?? 4)), duplicate: true }
    }

    const session = await client.query<QuoteSessionRecord>(
      `SELECT * FROM gutterquote_quote_sessions
       WHERE tenant_id = $1 AND id::text = $2 AND status = 'started' AND expires_at > NOW() FOR UPDATE`,
      [input.tenantId, input.sessionId],
    )
    if (!session.rows[0]) { await client.query("ROLLBACK"); return { ok: false, reason: "missing_session" } }
    if (session.rows[0].render_attempts >= 4) { await client.query("ROLLBACK"); return { ok: false, reason: "quote_limit" } }

    const active = await client.query(
      `SELECT 1 FROM gutterquote_render_jobs
       WHERE tenant_id = $1 AND quote_session_id::text = $2 AND status IN ('queued', 'processing')`,
      [input.tenantId, input.sessionId],
    )
    if (active.rowCount) { await client.query("ROLLBACK"); return { ok: false, reason: "active_job" } }

    await client.query("SELECT tenant_id FROM gutterquote_tenants WHERE tenant_id = $1 FOR UPDATE", [input.tenantId])
    const activeForTenant = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM gutterquote_render_jobs WHERE tenant_id = $1 AND status IN ('queued', 'processing')",
      [input.tenantId],
    )
    if (Number(activeForTenant.rows[0]?.count || 0) >= Number(process.env.MAX_TENANT_RENDER_CONCURRENCY || 10)) {
      await client.query("ROLLBACK"); return { ok: false, reason: "tenant_busy" }
    }
    const daily = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM gutterquote_credit_ledger
       WHERE tenant_id = $1 AND reason = 'gemini_render' AND delta = -1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [input.tenantId],
    )
    if (Number(daily.rows[0]?.count || 0) >= Number(process.env.MAX_TENANT_DAILY_RENDERS || 100)) {
      await client.query("ROLLBACK"); return { ok: false, reason: "tenant_daily_limit" }
    }

    const credits = await client.query<{ render_credits: number }>(
      `UPDATE gutterquote_tenants SET render_credits = render_credits - 1, updated_at = NOW()
       WHERE tenant_id = $1 AND render_credits > 0 RETURNING render_credits`,
      [input.tenantId],
    )
    if (!credits.rows[0]) { await client.query("ROLLBACK"); return { ok: false, reason: "no_credits" } }

    const attempts = session.rows[0].render_attempts + 1
    await client.query(
      "UPDATE gutterquote_quote_sessions SET render_attempts = $3, updated_at = NOW() WHERE tenant_id = $1 AND id::text = $2",
      [input.tenantId, input.sessionId, attempts],
    )
    await client.query(
      "UPDATE gutterquote_leads SET render_attempts = GREATEST(render_attempts, $3), updated_at = NOW() WHERE tenant_id = $1 AND session_id = $2",
      [input.tenantId, input.sessionId, attempts],
    )

    const jobId = randomUUID()
    const job = await client.query<RenderJobRecord>(
      `INSERT INTO gutterquote_render_jobs
       (id, tenant_id, quote_session_id, idempotency_key, source, source_blob_url, system_name, manufacturer, option_name, color, remaining_credits)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [jobId, input.tenantId, input.sessionId, input.idempotencyKey, input.source, input.sourceBlobUrl,
        input.system, input.manufacturer ?? null, input.option ?? null, input.color ?? null, credits.rows[0].render_credits],
    )
    await ledger(client, input.tenantId, -1, "gemini_render", `render:${jobId}`)
    await client.query(
      `INSERT INTO gutterquote_audit_events (id, tenant_id, actor_type, action, target_type, target_id, metadata)
       VALUES ($1,$2,'homeowner','render.queued','render_job',$3,$4)`,
      [randomUUID(), input.tenantId, jobId, JSON.stringify({ quoteSessionId: input.sessionId, attempt: attempts })],
    )
    await client.query("COMMIT")
    return { ok: true, job: job.rows[0], remainingQuoteRenders: 4 - attempts, duplicate: false }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}

export async function claimRenderJob(jobId: string) {
  await ensureSchema()
  const result = await systemDatabase().query<RenderJobRecord>(
    `UPDATE gutterquote_render_jobs SET status = 'processing', provider_started_at = NOW(), updated_at = NOW()
     WHERE id::text = $1 AND status = 'queued' AND provider_started_at IS NULL RETURNING *`,
    [jobId],
  )
  return result.rows[0] ?? null
}

export async function completeRenderJob(input: { jobId: string; resultBlobUrl: string }) {
  await ensureSchema()
  const result = await systemDatabase().query<RenderJobRecord>(
    `UPDATE gutterquote_render_jobs SET status = 'succeeded', result_blob_url = $2,
       completed_at = NOW(), updated_at = NOW() WHERE id::text = $1 AND status = 'processing' RETURNING *`,
    [input.jobId, input.resultBlobUrl],
  )
  return result.rows[0] ?? null
}

export async function failRenderJob(input: { jobId: string; errorCode: string; errorMessage: string; refundCredit?: boolean }) {
  await ensureSchema()
  const client = await systemDatabase().connect()
  try {
    await client.query("BEGIN")
    const job = await client.query<RenderJobRecord>("SELECT * FROM gutterquote_render_jobs WHERE id::text = $1 FOR UPDATE", [input.jobId])
    if (!job.rows[0] || job.rows[0].status === "failed" || job.rows[0].status === "succeeded") {
      await client.query("ROLLBACK")
      return job.rows[0] ?? null
    }
    const failed = await client.query<RenderJobRecord>(
      `UPDATE gutterquote_render_jobs SET status = 'failed', error_code = $2, error_message = $3,
       completed_at = NOW(), updated_at = NOW() WHERE id::text = $1 RETURNING *`,
      [input.jobId, input.errorCode, input.errorMessage.slice(0, 500)],
    )
    if (input.refundCredit) {
      const eventKey = `refund:${input.jobId}`
      const exists = await client.query("SELECT 1 FROM gutterquote_credit_ledger WHERE event_key = $1", [eventKey])
      if (!exists.rowCount) {
        await client.query("UPDATE gutterquote_tenants SET render_credits = render_credits + 1, updated_at = NOW() WHERE tenant_id = $1", [job.rows[0].tenant_id])
        await ledger(client, job.rows[0].tenant_id, 1, "failed_render_refund", eventKey)
      }
    }
    await client.query("COMMIT")
    return failed.rows[0]
  } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
}

export async function getRenderJob(input: { tenantId: string; sessionId: string; jobId: string }) {
  await ensureSchema()
  const result = await tenantQuery<RenderJobRecord>(input.tenantId,
    `SELECT * FROM gutterquote_render_jobs WHERE tenant_id = $1 AND quote_session_id::text = $2 AND id::text = $3`,
    [input.tenantId, input.sessionId, input.jobId],
  )
  return result.rows[0] ?? null
}

export async function listQueuedRenderJobIds(limit = 20) {
  await ensureSchema()
  const result = await systemDatabase().query<{ id: string }>(
    `SELECT id::text AS id FROM gutterquote_render_jobs
     WHERE status = 'queued' ORDER BY created_at ASC LIMIT $1`,
    [Math.max(1, Math.min(100, limit))],
  )
  return result.rows.map((row) => row.id)
}

export async function listStaleRenderJobIds(limit = 50) {
  await ensureSchema()
  const result = await systemDatabase().query<{ id: string }>(
    `SELECT id::text AS id FROM gutterquote_render_jobs
     WHERE status = 'processing' AND provider_started_at < NOW() - INTERVAL '5 minutes'
     ORDER BY provider_started_at ASC LIMIT $1`,
    [Math.max(1, Math.min(100, limit))],
  )
  return result.rows.map((row) => row.id)
}

export async function recordAuditEvent(input: {
  tenantId?: string | null
  actorType: "contractor" | "platform" | "system" | "homeowner"
  actorId?: string
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
  requestId?: string
}) {
  await ensureSchema()
  const query = input.tenantId ? tenantQuery.bind(null, input.tenantId) : systemDatabase().query.bind(systemDatabase())
  await query(
    `INSERT INTO gutterquote_audit_events (id, tenant_id, actor_type, actor_id, action, target_type, target_id, metadata, request_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [randomUUID(), input.tenantId ?? null, input.actorType, input.actorId ?? null, input.action,
      input.targetType ?? null, input.targetId ?? null, JSON.stringify(input.metadata ?? {}), input.requestId ?? null],
  )
}

export async function runRetentionCleanup() {
  await ensureSchema()
  const abandoned = await systemDatabase().query(
    `DELETE FROM gutterquote_leads WHERE status = 'started' AND updated_at < NOW() - INTERVAL '90 days' RETURNING id`,
  )
  const completed = await systemDatabase().query(
    `DELETE FROM gutterquote_leads AS lead
     USING gutterquote_tenants AS tenant
     WHERE lead.tenant_id = tenant.tenant_id
       AND lead.status = 'completed'
       AND lead.updated_at < NOW() - make_interval(months => tenant.completed_lead_retention_months)
     RETURNING lead.id`,
  )
  const sessions = await systemDatabase().query(
    `UPDATE gutterquote_quote_sessions SET status = 'expired', updated_at = NOW()
     WHERE status = 'started' AND expires_at <= NOW() RETURNING id`,
  )
  const jobs = await systemDatabase().query<{ id: string; source_blob_url: string | null; result_blob_url: string | null }>(
    `SELECT id::text AS id, source_blob_url, result_blob_url
     FROM gutterquote_render_jobs WHERE expires_at <= NOW() ORDER BY expires_at ASC LIMIT 500`,
  )
  return { abandoned: abandoned.rowCount, completed: completed.rowCount, expiredSessions: sessions.rowCount, jobs: jobs.rows }
}

export async function deleteExpiredRenderJobs(jobIds: string[]) {
  if (!jobIds.length) return 0
  await ensureSchema()
  const result = await systemDatabase().query(
    `DELETE FROM gutterquote_render_jobs WHERE id::text = ANY($1::text[]) AND expires_at <= NOW() RETURNING id`,
    [jobIds],
  )
  return result.rowCount
}

export async function exportTenantData(tenantId: string) {
  await ensureSchema()
  const [tenant, leads, notifications, domains, versions, ledger, audit] = await Promise.all([
    tenantQuery(tenantId, `SELECT tenant_id, company_name, lead_email, contact_name, phone, plan_code, access_state, managed_domain, completed_lead_retention_months, created_at, updated_at FROM gutterquote_tenants WHERE tenant_id = $1`, [tenantId]),
    tenantQuery(tenantId, `SELECT id, session_id, status, address, state, county, name, email, phone, quote, render_attempts, created_at, updated_at FROM gutterquote_leads WHERE tenant_id = $1 ORDER BY updated_at DESC`, [tenantId]),
    tenantQuery(tenantId, `SELECT lead_id, event_type, recipient, status, attempts, provider_message_id, last_error, sent_at, created_at, updated_at FROM gutterquote_lead_notifications WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]),
    tenantQuery(tenantId, `SELECT hostname, status, is_primary, verified_at, created_at FROM gutterquote_tenant_domains WHERE tenant_id = $1 ORDER BY created_at`, [tenantId]),
    tenantQuery(tenantId, `SELECT version, approved_by, config, approved_at, status, deployment_url FROM gutterquote_site_versions WHERE tenant_id = $1 ORDER BY version DESC`, [tenantId]),
    tenantQuery(tenantId, `SELECT delta, reason, event_key, created_at FROM gutterquote_credit_ledger WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]),
    tenantQuery(tenantId, `SELECT actor_type, actor_id, action, target_type, target_id, metadata, request_id, created_at FROM gutterquote_audit_events WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]),
  ])
  const exportedLeads = leads.rows.map((lead) => ({ ...lead, address: decryptPii(lead.address), name: decryptPii(lead.name), email: decryptPii(lead.email), phone: decryptPii(lead.phone) }))
  return { exportedAt: new Date().toISOString(), tenant: tenant.rows[0] ?? null, leads: exportedLeads, leadNotifications: notifications.rows, domains: domains.rows, versions: versions.rows, creditLedger: ledger.rows, auditEvents: audit.rows }
}

export async function deleteTenantLead(tenantId: string, leadId: string) {
  await ensureSchema()
  const result = await tenantQuery(tenantId, `DELETE FROM gutterquote_leads WHERE tenant_id = $1 AND id::text = $2 RETURNING id`, [tenantId, leadId])
  return Boolean(result.rowCount)
}

export async function getTenantByStripeCustomerId(customerId: string) {
  await ensureSchema()
  const result = await systemDatabase().query<TenantRecord>("SELECT * FROM gutterquote_tenants WHERE stripe_customer_id = $1", [customerId])
  return result.rows[0] ?? null
}

export async function getLatestTenantByEmail(email: string) {
  await ensureSchema()
  const result = await systemDatabase().query<TenantRecord>(
    "SELECT * FROM gutterquote_tenants WHERE LOWER(lead_email) = LOWER($1) ORDER BY updated_at DESC LIMIT 1",
    [email],
  )
  return result.rows[0] ?? null
}

export async function listTenants() {
  await ensureSchema()
  const result = await systemDatabase().query<TenantRecord>(
    "SELECT * FROM gutterquote_tenants ORDER BY updated_at DESC LIMIT 500",
  )
  return result.rows
}

export async function listIncompleteSignups(limit = 200): Promise<PlatformIncompleteSignup[]> {
  await ensureSchema()
  const result = await systemDatabase().query<PlatformIncompleteSignup>(`
    SELECT
      tenant.tenant_id,
      tenant.company_name,
      tenant.contact_name,
      tenant.lead_email,
      tenant.phone,
      tenant.plan_code,
      tenant.subscription_status,
      tenant.created_at,
      tenant.draft_updated_at,
      tenant.demo_render_used_at,
      COALESCE(sessions.test_sessions, 0)::int AS test_sessions,
      latest_version.status AS latest_version_status,
      GREATEST(
        tenant.created_at,
        COALESCE(tenant.draft_updated_at, tenant.created_at),
        COALESCE(sessions.last_activity_at, tenant.created_at),
        COALESCE(latest_version.approved_at, tenant.created_at)
      ) AS last_activity_at,
      CASE
        WHEN latest_version.id IS NOT NULL OR tenant.stripe_customer_id IS NOT NULL THEN 'Checkout started'
        WHEN COALESCE(sessions.test_sessions, 0) > 0 OR tenant.demo_render_used_at IS NOT NULL THEN 'Demo testing'
        WHEN tenant.draft_config IS NOT NULL
          AND jsonb_typeof(tenant.draft_config->'serviceAreas') = 'object'
          AND jsonb_object_length(tenant.draft_config->'serviceAreas') > 0 THEN 'Template configured'
        WHEN tenant.draft_config IS NOT NULL THEN 'Template started'
        ELSE 'Account created'
      END AS setup_stage
    FROM gutterquote_tenants AS tenant
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::int AS test_sessions, MAX(updated_at) AS last_activity_at
      FROM gutterquote_quote_sessions
      WHERE tenant_id = tenant.tenant_id
    ) AS sessions ON TRUE
    LEFT JOIN LATERAL (
      SELECT id, status, approved_at
      FROM gutterquote_site_versions
      WHERE tenant_id = tenant.tenant_id
      ORDER BY approved_at DESC
      LIMIT 1
    ) AS latest_version ON TRUE
    WHERE tenant.deployment_url IS NULL
      AND tenant.subscription_status IN ('inactive', 'incomplete', 'incomplete_expired')
    ORDER BY last_activity_at DESC
    LIMIT $1
  `, [Math.max(1, Math.min(500, limit))])
  return result.rows
}

export async function getPlatformOverview(): Promise<PlatformOverview> {
  await ensureSchema()
  const result = await systemDatabase().query<PlatformOverview>(`
    SELECT
      (SELECT COUNT(*)::int FROM gutterquote_tenants) AS "contractors",
      (SELECT COUNT(*)::int FROM gutterquote_tenants WHERE subscription_status IN ('active', 'trialing')) AS "activeSubscriptions",
      (SELECT COUNT(*)::int FROM gutterquote_tenants WHERE subscription_status IN ('past_due', 'unpaid', 'incomplete') OR access_state IN ('grace', 'suspended')) AS "billingAttention",
      (SELECT COUNT(*)::int FROM gutterquote_tenants WHERE deployment_url IS NOT NULL AND access_state IN ('active', 'grace')) AS "liveWebsites",
      (SELECT COUNT(*)::int FROM gutterquote_leads WHERE created_at >= NOW() - INTERVAL '30 days') AS "leadsLast30Days",
      (SELECT COUNT(*)::int FROM gutterquote_leads WHERE status = 'completed' AND updated_at >= NOW() - INTERVAL '30 days') AS "completedQuotesLast30Days",
      (SELECT COUNT(*)::int FROM gutterquote_render_jobs WHERE created_at >= NOW() - INTERVAL '30 days') AS "rendersLast30Days",
      (SELECT COUNT(*)::int FROM gutterquote_render_jobs WHERE status = 'failed' AND created_at >= NOW() - INTERVAL '30 days') AS "failedRendersLast30Days",
      (SELECT COUNT(*)::int FROM gutterquote_render_jobs WHERE status IN ('queued', 'processing')) AS "activeRenderJobs",
      (SELECT COUNT(*)::int FROM gutterquote_lead_notifications WHERE status = 'failed') AS "failedLeadNotifications",
      (SELECT COALESCE(SUM(render_credits), 0)::int FROM gutterquote_tenants) AS "availableRenderCredits"
  `)
  return result.rows[0]
}

export async function listPlatformAudit(limit = 20): Promise<PlatformAuditRecord[]> {
  await ensureSchema()
  const result = await systemDatabase().query<PlatformAuditRecord>(`
    SELECT event.id::text AS id, event.tenant_id, tenant.company_name, event.actor_type,
      event.action, event.target_type, event.created_at
    FROM gutterquote_audit_events AS event
    LEFT JOIN gutterquote_tenants AS tenant ON tenant.tenant_id = event.tenant_id
    ORDER BY event.created_at DESC
    LIMIT $1
  `, [Math.max(1, Math.min(100, limit))])
  return result.rows
}

export async function getPlatformTenantDetail(tenantId: string): Promise<PlatformTenantDetail> {
  await ensureSchema()
  const db = systemDatabase()
  const [metrics, domains, versions, audit] = await Promise.all([
    db.query<{
      lead_count: number
      completed_lead_count: number
      abandoned_lead_count: number
      quote_session_count: number
      render_count: number
      successful_render_count: number
      failed_render_count: number
      failed_notification_count: number
    }>(`
      SELECT
        (SELECT COUNT(*)::int FROM gutterquote_leads WHERE tenant_id = $1) AS lead_count,
        (SELECT COUNT(*)::int FROM gutterquote_leads WHERE tenant_id = $1 AND status = 'completed') AS completed_lead_count,
        (SELECT COUNT(*)::int FROM gutterquote_leads WHERE tenant_id = $1 AND status = 'started') AS abandoned_lead_count,
        (SELECT COUNT(*)::int FROM gutterquote_quote_sessions WHERE tenant_id = $1) AS quote_session_count,
        (SELECT COUNT(*)::int FROM gutterquote_render_jobs WHERE tenant_id = $1) AS render_count,
        (SELECT COUNT(*)::int FROM gutterquote_render_jobs WHERE tenant_id = $1 AND status = 'succeeded') AS successful_render_count,
        (SELECT COUNT(*)::int FROM gutterquote_render_jobs WHERE tenant_id = $1 AND status = 'failed') AS failed_render_count,
        (SELECT COUNT(*)::int FROM gutterquote_lead_notifications WHERE tenant_id = $1 AND status = 'failed') AS failed_notification_count
    `, [tenantId]),
    db.query<{ hostname: string; status: string; is_primary: boolean; verified_at: string | null }>(
      "SELECT hostname, status, is_primary, verified_at FROM gutterquote_tenant_domains WHERE tenant_id = $1 ORDER BY is_primary DESC, created_at DESC",
      [tenantId],
    ),
    db.query<{ id: string; version: number; status: string; approved_by: string; approved_at: string; deployment_url: string | null; failure_reason: string | null }>(
      "SELECT id::text AS id, version, status, approved_by, approved_at, deployment_url, failure_reason FROM gutterquote_site_versions WHERE tenant_id = $1 ORDER BY version DESC LIMIT 20",
      [tenantId],
    ),
    db.query<PlatformAuditRecord>(`
      SELECT event.id::text AS id, event.tenant_id, tenant.company_name, event.actor_type,
        event.action, event.target_type, event.created_at
      FROM gutterquote_audit_events AS event
      LEFT JOIN gutterquote_tenants AS tenant ON tenant.tenant_id = event.tenant_id
      WHERE event.tenant_id = $1
      ORDER BY event.created_at DESC LIMIT 30
    `, [tenantId]),
  ])
  const row = metrics.rows[0]
  return {
    leadCount: row.lead_count,
    completedLeadCount: row.completed_lead_count,
    abandonedLeadCount: row.abandoned_lead_count,
    quoteSessionCount: row.quote_session_count,
    renderCount: row.render_count,
    successfulRenderCount: row.successful_render_count,
    failedRenderCount: row.failed_render_count,
    failedNotificationCount: row.failed_notification_count,
    domains: domains.rows,
    versions: versions.rows,
    audit: audit.rows,
  }
}

export async function updateTenantStripeCustomer(tenantId: string, customerId: string) {
  await ensureSchema()
  await tenantQuery(tenantId,
    "UPDATE gutterquote_tenants SET stripe_customer_id = $2, updated_at = NOW() WHERE tenant_id = $1",
    [tenantId, customerId],
  )
}

export async function saveTenantVercelProject(input: {
  tenantId: string
  projectId: string
  projectName: string
  deploymentUrl?: string
  managedDomain?: string
}) {
  await ensureSchema()
  await tenantQuery(input.tenantId,
    `UPDATE gutterquote_tenants SET vercel_project_id = $2, vercel_project_name = $3,
      deployment_url = COALESCE($4, deployment_url), managed_domain = COALESCE($5, managed_domain), updated_at = NOW() WHERE tenant_id = $1`,
    [input.tenantId, input.projectId, input.projectName, input.deploymentUrl ?? null, input.managedDomain ?? null],
  )
}

export async function getTenantAccess(tenantId: string) {
  await ensureSchema()
  await tenantQuery(tenantId,
    `UPDATE gutterquote_tenants SET access_state = 'suspended', updated_at = NOW()
     WHERE tenant_id = $1 AND access_state = 'grace' AND grace_ends_at IS NOT NULL AND grace_ends_at <= NOW()`,
    [tenantId],
  )
  const tenant = await getTenant(tenantId)
  if (!tenant) return null
  return {
    tenantId: tenant.tenant_id,
    subscriptionStatus: tenant.subscription_status,
    accessState: tenant.access_state,
    graceEndsAt: tenant.grace_ends_at,
    periodEnd: tenant.subscription_period_end,
    vercelProjectId: tenant.vercel_project_id,
  }
}

export async function applySubscriptionState(input: {
  tenantId: string
  subscriptionId?: string | null
  customerId?: string | null
  status: StripeSubscriptionStatus
  periodEnd?: Date | null
  graceDays?: number
}) {
  await ensureSchema()
  const client = await systemDatabase().connect()
  try {
    await client.query("BEGIN")
    const current = await client.query<TenantRecord>(
      "SELECT * FROM gutterquote_tenants WHERE tenant_id = $1 FOR UPDATE",
      [input.tenantId],
    )
    if (!current.rows[0]) throw new Error(`Tenant ${input.tenantId} was not found.`)

    let accessState: SiteAccessState = "inactive"
    let graceEndsAt: Date | null = null
    if (input.status === "active" || input.status === "trialing") {
      accessState = "active"
    } else if (input.status === "past_due") {
      accessState = "grace"
      const existingGrace = current.rows[0].grace_ends_at ? new Date(current.rows[0].grace_ends_at) : null
      graceEndsAt = existingGrace && existingGrace.getTime() > Date.now()
        ? existingGrace
        : new Date(Date.now() + (input.graceDays ?? Number(process.env.SUBSCRIPTION_GRACE_DAYS || 7)) * 86_400_000)
    } else if (["canceled", "unpaid", "paused", "incomplete_expired"].includes(input.status)) {
      accessState = "suspended"
    }

    const result = await client.query<TenantRecord>(
      `UPDATE gutterquote_tenants SET stripe_customer_id = COALESCE($2, stripe_customer_id),
        stripe_subscription_id = COALESCE($3, stripe_subscription_id), subscription_status = $4,
        access_state = $5, grace_ends_at = $6, subscription_period_end = $7, updated_at = NOW()
       WHERE tenant_id = $1 RETURNING *`,
      [input.tenantId, input.customerId ?? null, input.subscriptionId ?? null, input.status, accessState,
        graceEndsAt, input.periodEnd ?? null],
    )
    await client.query("COMMIT")
    return result.rows[0]
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

export async function beginStripeEvent(eventId: string, eventType: string) {
  await ensureSchema()
  const result = await systemDatabase().query(
    `INSERT INTO gutterquote_stripe_events (event_id, event_type) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
    [eventId, eventType],
  )
  return result.rowCount === 1
}

export async function completeStripeEvent(eventId: string) {
  await ensureSchema()
  await systemDatabase().query("UPDATE gutterquote_stripe_events SET processed_at = NOW() WHERE event_id = $1", [eventId])
}

export async function releaseStripeEvent(eventId: string) {
  await ensureSchema()
  await systemDatabase().query("DELETE FROM gutterquote_stripe_events WHERE event_id = $1 AND processed_at IS NULL", [eventId])
}

export async function beginClerkEvent(eventId: string, eventType: string) {
  await ensureSchema()
  const result = await systemDatabase().query(
    `INSERT INTO gutterquote_clerk_events (event_id, event_type) VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
    [eventId, eventType],
  )
  return result.rowCount === 1
}

export async function completeClerkEvent(eventId: string) {
  await ensureSchema()
  await systemDatabase().query("UPDATE gutterquote_clerk_events SET processed_at = NOW() WHERE event_id = $1", [eventId])
}

export async function releaseClerkEvent(eventId: string) {
  await ensureSchema()
  await systemDatabase().query("DELETE FROM gutterquote_clerk_events WHERE event_id = $1 AND processed_at IS NULL", [eventId])
}

export async function upsertLead(input: {
  tenantId: string; sessionId: string; address: string; state: string; county: string
  status?: "started" | "completed"; name?: string; email?: string; phone?: string; quote?: unknown
}) {
  await ensureSchema()
  const id = randomUUID()
  const result = await tenantQuery<LeadRecord>(input.tenantId,
    `INSERT INTO gutterquote_leads (id, tenant_id, session_id, status, address, state, county, name, email, phone, quote)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (tenant_id, session_id) DO UPDATE SET
       status = CASE WHEN EXCLUDED.status = 'completed' THEN 'completed' ELSE gutterquote_leads.status END,
       address = EXCLUDED.address, state = EXCLUDED.state, county = EXCLUDED.county,
       name = COALESCE(EXCLUDED.name, gutterquote_leads.name), email = COALESCE(EXCLUDED.email, gutterquote_leads.email),
       phone = COALESCE(EXCLUDED.phone, gutterquote_leads.phone), quote = COALESCE(EXCLUDED.quote, gutterquote_leads.quote), updated_at = NOW()
     RETURNING *`,
    [id, input.tenantId, input.sessionId, input.status ?? "started", encryptPii(input.address), input.state, input.county,
      encryptPii(input.name), encryptPii(input.email), encryptPii(input.phone), input.quote ? JSON.stringify(input.quote) : null],
  )
  return decryptLead(result.rows[0])
}

export async function enqueueLeadNotification(
  tenantId: string,
  leadId: string,
  eventType: LeadNotificationRecord["event_type"],
) {
  await ensureSchema()
  const result = await tenantQuery<LeadNotificationRecord>(tenantId,
    `INSERT INTO gutterquote_lead_notifications (id, tenant_id, lead_id, event_type, recipient)
     SELECT $1, tenant.tenant_id, lead.id, $4, tenant.lead_email
     FROM gutterquote_tenants AS tenant
     JOIN gutterquote_leads AS lead ON lead.tenant_id = tenant.tenant_id
     WHERE tenant.tenant_id = $2 AND lead.id::text = $3
       AND lead.name IS NOT NULL AND lead.email IS NOT NULL AND lead.phone IS NOT NULL
       AND ($4 <> 'quote.completed' OR lead.status = 'completed')
     ON CONFLICT (tenant_id, lead_id, event_type) DO UPDATE SET
       recipient = CASE WHEN gutterquote_lead_notifications.status = 'sent'
         THEN gutterquote_lead_notifications.recipient ELSE EXCLUDED.recipient END,
       updated_at = NOW()
     RETURNING gutterquote_lead_notifications.*`,
    [randomUUID(), tenantId, leadId, eventType],
  )
  if (!result.rows[0]) throw new Error("The lead email could not be queued.")
  return result.rows[0]
}

export async function claimLeadNotification(notificationId: string) {
  await ensureSchema()
  const client = await systemDatabase().connect()
  try {
    await client.query("BEGIN")
    const selected = await client.query<ClaimedLeadNotification>(
      `SELECT notification.*, tenant.company_name, lead.address, lead.state, lead.county,
        lead.name, lead.email, lead.phone, lead.quote
       FROM gutterquote_lead_notifications AS notification
       JOIN gutterquote_tenants AS tenant ON tenant.tenant_id = notification.tenant_id
       JOIN gutterquote_leads AS lead ON lead.id = notification.lead_id
       WHERE notification.id::text = $1 AND notification.status = 'queued'
         AND notification.next_attempt_at <= NOW() AND notification.attempts < 8
       FOR UPDATE OF notification SKIP LOCKED`,
      [notificationId],
    )
    const notification = selected.rows[0]
    if (!notification) {
      await client.query("ROLLBACK")
      return null
    }
    await client.query(
      `UPDATE gutterquote_lead_notifications
       SET status = 'processing', attempts = attempts + 1, locked_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [notification.id],
    )
    await client.query("COMMIT")
    return {
      ...notification,
      attempts: notification.attempts + 1,
      status: "processing" as const,
      address: decryptPii(notification.address) || "",
      name: decryptPii(notification.name) || "Homeowner",
      email: decryptPii(notification.email) || "",
      phone: decryptPii(notification.phone) || "",
    }
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}

export async function completeLeadNotification(notificationId: string, providerMessageId?: string) {
  await ensureSchema()
  const result = await systemDatabase().query<LeadNotificationRecord>(
    `UPDATE gutterquote_lead_notifications
     SET status = 'sent', provider_message_id = $2, sent_at = NOW(), locked_at = NULL,
       last_error = NULL, updated_at = NOW()
     WHERE id::text = $1 AND status = 'processing' RETURNING *`,
    [notificationId, providerMessageId ?? null],
  )
  return result.rows[0] ?? null
}

export async function failLeadNotification(notificationId: string, attempts: number, message: string) {
  await ensureSchema()
  const terminal = attempts >= 8
  const delaySeconds = Math.min(3_600, 30 * (2 ** Math.max(0, attempts - 1)))
  const nextAttemptAt = new Date(Date.now() + delaySeconds * 1_000)
  const result = await systemDatabase().query<LeadNotificationRecord>(
    `UPDATE gutterquote_lead_notifications
     SET status = $2, last_error = $3, locked_at = NULL, next_attempt_at = $4, updated_at = NOW()
     WHERE id::text = $1 AND status = 'processing' RETURNING *`,
    [notificationId, terminal ? "failed" : "queued", message.slice(0, 500), nextAttemptAt],
  )
  return result.rows[0] ?? null
}

export async function requeueStaleLeadNotifications() {
  await ensureSchema()
  const result = await systemDatabase().query(
    `UPDATE gutterquote_lead_notifications
     SET status = CASE WHEN attempts >= 8 THEN 'failed' ELSE 'queued' END,
       locked_at = NULL, next_attempt_at = NOW(), last_error = 'Delivery worker lease expired.', updated_at = NOW()
     WHERE status = 'processing' AND locked_at < NOW() - INTERVAL '5 minutes'
     RETURNING id`,
  )
  return result.rowCount ?? 0
}

export async function listDueLeadNotificationIds(limit = 25) {
  await ensureSchema()
  const result = await systemDatabase().query<{ id: string }>(
    `SELECT id::text AS id FROM gutterquote_lead_notifications
     WHERE status = 'queued' AND next_attempt_at <= NOW() AND attempts < 8
     ORDER BY next_attempt_at ASC LIMIT $1`,
    [Math.max(1, Math.min(100, limit))],
  )
  return result.rows.map((row) => row.id)
}

export async function leadSessionExists(tenantId: string, sessionId: string) {
  await ensureSchema()
  const result = await tenantQuery(tenantId, "SELECT 1 FROM gutterquote_leads WHERE tenant_id = $1 AND session_id = $2", [tenantId, sessionId])
  return result.rowCount === 1
}

export async function listLeads(tenantId: string) {
  await ensureSchema()
  const result = await tenantQuery<LeadRecord>(tenantId,
    `SELECT lead.id, lead.session_id, lead.status, lead.address, lead.state, lead.county, lead.name,
       lead.email, lead.phone, lead.quote, lead.created_at, lead.updated_at,
       notification.status AS notification_status, notification.recipient AS notification_recipient
     FROM gutterquote_leads AS lead
     LEFT JOIN LATERAL (
       SELECT status, recipient FROM gutterquote_lead_notifications
       WHERE tenant_id = lead.tenant_id AND lead_id = lead.id
       ORDER BY created_at DESC LIMIT 1
     ) AS notification ON TRUE
     WHERE lead.tenant_id = $1 ORDER BY lead.updated_at DESC LIMIT 500`,
    [tenantId],
  )
  return result.rows.map(decryptLead)
}

export async function listAbandonedLeads(tenantId: string) {
  await ensureSchema()
  const result = await tenantQuery<LeadRecord>(tenantId,
    `SELECT id, session_id, status, address, state, county, name, email, phone, quote, created_at, updated_at
     FROM gutterquote_leads
     WHERE tenant_id = $1 AND status = 'started'
     ORDER BY updated_at DESC LIMIT 500`,
    [tenantId],
  )
  return result.rows.map(decryptLead)
}

function decryptLead(lead: LeadRecord): LeadRecord {
  return {
    ...lead,
    address: decryptPii(lead.address) || "",
    name: decryptPii(lead.name),
    email: decryptPii(lead.email),
    phone: decryptPii(lead.phone),
  }
}

async function ledger(client: PoolClient, tenantId: string, delta: number, reason: string, eventKey?: string) {
  await client.query(
    "INSERT INTO gutterquote_credit_ledger (id, tenant_id, delta, reason, event_key) VALUES ($1,$2,$3,$4,$5)",
    [randomUUID(), tenantId, delta, reason, eventKey ?? null],
  )
}

export async function consumeDemoRender(tenantId: string) {
  await ensureSchema()
  const result = await tenantQuery(tenantId,
    `UPDATE gutterquote_tenants SET demo_render_used_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $1 AND access_state = 'inactive' AND demo_render_used_at IS NULL
     RETURNING demo_render_used_at`,
    [tenantId],
  )
  return Boolean(result.rows[0])
}

export async function refundDemoRender(tenantId: string) {
  await ensureSchema()
  await tenantQuery(tenantId,
    "UPDATE gutterquote_tenants SET demo_render_used_at = NULL, updated_at = NOW() WHERE tenant_id = $1 AND access_state = 'inactive'",
    [tenantId],
  )
}

export async function addRenderCredits(tenantId: string, credits: number, reason: string, eventKey?: string) {
  await ensureSchema()
  const client = await database().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId])
    if (eventKey) {
      const exists = await client.query("SELECT 1 FROM gutterquote_credit_ledger WHERE event_key = $1", [eventKey])
      if (exists.rowCount) { await client.query("ROLLBACK"); return false }
    }
    await client.query("UPDATE gutterquote_tenants SET render_credits = render_credits + $2, updated_at = NOW() WHERE tenant_id = $1", [tenantId, credits])
    await ledger(client, tenantId, credits, reason, eventKey)
    await client.query("COMMIT")
    return true
  } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
}

export async function approveSiteConfiguration(input: { tenantId: string; config: unknown; approvedBy: string }) {
  await ensureSchema()
  const serialized = JSON.stringify(input.config)
  const configHash = createHash("sha256").update(serialized).digest("hex")
  const client = await database().connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId])
    await client.query("SELECT tenant_id FROM gutterquote_tenants WHERE tenant_id = $1 FOR UPDATE", [input.tenantId])
    const existing = await client.query(
      "SELECT * FROM gutterquote_site_versions WHERE tenant_id = $1 AND config_hash = $2 FOR UPDATE",
      [input.tenantId, configHash],
    )
    if (existing.rows[0]) { await client.query("COMMIT"); return existing.rows[0] }
    const versionResult = await client.query<{ next_version: number }>(
      "SELECT COALESCE(MAX(version), 0) + 1 AS next_version FROM gutterquote_site_versions WHERE tenant_id = $1",
      [input.tenantId],
    )
    const id = randomUUID()
    const result = await client.query(
      `INSERT INTO gutterquote_site_versions (id, tenant_id, version, config_hash, config, approved_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [id, input.tenantId, versionResult.rows[0].next_version, configHash, serialized, input.approvedBy],
    )
    await client.query("COMMIT")
    return result.rows[0]
  } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
}

export async function getSiteVersionForTenant(tenantId: string, id: string) {
  await ensureSchema()
  const result = await tenantQuery<SiteVersionRecord>(
    tenantId,
    "SELECT * FROM gutterquote_site_versions WHERE tenant_id = $1 AND id::text = $2",
    [tenantId, id],
  )
  return result.rows[0] ?? null
}

export async function claimSiteVersionProvisioning(tenantId: string, id: string) {
  await ensureSchema()
  const result = await tenantQuery<SiteVersionRecord>(
    tenantId,
    `UPDATE gutterquote_site_versions
     SET status = 'provisioning', failure_reason = NULL, updated_at = NOW()
     WHERE tenant_id = $1 AND id::text = $2
       AND (status IN ('approved', 'failed') OR (status = 'provisioning' AND updated_at < NOW() - INTERVAL '10 minutes'))
     RETURNING *`,
    [tenantId, id],
  )
  return result.rows[0] ?? null
}

export async function updateSiteVersion(input: {
  id: string; status: "approved" | "provisioning" | "live" | "failed"; githubRepo?: string
  vercelProject?: string; deploymentUrl?: string; failureReason?: string
}) {
  await ensureSchema()
  const result = await systemDatabase().query(
    `UPDATE gutterquote_site_versions SET status = $2, github_repo = COALESCE($3, github_repo),
      vercel_project = COALESCE($4, vercel_project), deployment_url = COALESCE($5, deployment_url),
      failure_reason = $6, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [input.id, input.status, input.githubRepo ?? null, input.vercelProject ?? null, input.deploymentUrl ?? null, input.failureReason ?? null],
  )
  return result.rows[0]
}
