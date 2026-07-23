# HD Instant Gutter Quote by HD Precision

HD Instant Gutter Quote is one multi-tenant Next.js application for the sales site, contractor studio, dashboards, and homeowner quote sites. Contractor subdomains beneath `TENANT_ROOT_DOMAIN` and verified custom domains resolve through `gutterquote_tenant_domains`; published configuration lives in PostgreSQL and one deployment updates every tenant. Configure the matching wildcard domain on the shared Vercel project.

## Security model

- Public tenant identity comes only from a verified hostname. Contractor tenant identity comes from the active Clerk Organization; the legacy signed workspace cookie is retained only for migration.
- PostgreSQL row-level policies protect tenant-owned tables. `DATABASE_URL` must use a restricted non-owner application role; `PLATFORM_DATABASE_URL` is a separately restricted operational role for schema migration, verified hostname lookup, signed webhooks, queue workers, and retention. Table owners bypass RLS by default and must never be used as the application role.
- Homeowner sessions are created server-side, signed in an HttpOnly cookie, bound to the hostname tenant, and tied to signed Google place verification.
- Production rendering is queued. Reservation, the immutable four-attempt quote limit, credit deduction, idempotency, and concurrency checks happen in one database transaction.
- Private source and result images expire after 24 hours. Abandoned leads expire after 90 days; completed leads default to 24 months.
- Homeowner contact fields are envelope-ready, versioned AES-GCM ciphertext. Inject the active key from a KMS-backed secret store and never place keys in application data.
- Distributed rate limits use Upstash Redis. Turnstile is required before a production render. Security headers are configured globally.

## Contractor flow

1. A contractor creates a free workspace and builds the branded experience in `/setup`.
2. `/preview` tests full address, product, pricing, and one demo render before payment.
3. Approval freezes an immutable configuration.
4. Stripe collects the $499 setup fee and starts $199/month for three months, then $249/month.
5. The approved domain is attached to the shared Vercel project and registered to the tenant.
6. Stripe webhooks update tenant access without pausing the shared project.

## Existing website widget

Published contractors can add their existing website origin in the template studio and copy the installation snippet from the contractor dashboard. The cross-origin loader at `/widget.js` adds a responsive quote button and modal. It issues a short-lived, tenant-bound token only when the requesting website origin is on the published allowlist; `/embed` applies a matching `frame-ancestors` policy and uses a partitioned secure quote-session cookie.

```html
<script src="https://your-quote-domain.com/widget.js" data-label="Get an instant gutter quote" defer></script>
```

The contractor website may need to allow the quote domain in its own `script-src` Content Security Policy. Optional `data-color`, `data-accent`, and `data-label` attributes customize the launcher without changing the quote configuration.

## Automatic lead email delivery

Each tenant starts with the contractor's verified signup email as its lead-delivery address. The contractor may replace it in the template studio. HD Instant Gutter Quote emails the contractor when a homeowner supplies contact information and sends a completed-quote update when the homeowner finishes; address-only starts remain in the dashboard and are not emailed.

Notifications use a tenant-scoped database outbox, Resend idempotency keys, and an eight-attempt exponential retry schedule. The homeowner email is set as `Reply-To`, while all mail originates from the single verified `LEAD_FROM_EMAIL` domain. Leads remain visible in the contractor dashboard even if email delivery is delayed.

## Production services

- Clerk Organizations with verified email and MFA enforcement for owners, administrators, and platform staff
- Serverless PostgreSQL transaction pooler, restricted application role, encrypted backups, PITR, and tested restores
- Upstash Redis, Cloudflare Turnstile, private Vercel Blob storage, Stripe, Vercel Domains, Google APIs, Gemini, and Resend

Copy `.env.example` to `.env.local` for local development. Production, preview, and development must have separate databases and credentials. Rotate every previously distributed database, Stripe, Google, Gemini, Vercel, and GitHub credential before migration.

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm dev
```

## Webhooks and scheduled work

- Stripe: `/api/stripe/webhook`
- Clerk: `/api/clerk/webhook`
- Queue sweep: `/api/cron/render-jobs`
- Lead email sweep: `/api/cron/lead-notifications`
- Retention cleanup: `/api/cron/retention`

Both webhook routes verify signatures and persist idempotency records. Cron routes require `Authorization: Bearer $CRON_SECRET`.

## Operational requirements

Before broad rollout, enforce owner/admin MFA in Clerk, configure Blob lifecycle deletion, create alerts for render volume/queue latency/provider failure/credit mismatches/cross-tenant attempts, run restore and rollback drills, and complete external penetration testing. See [`docs/operations.md`](docs/operations.md) for the launch checklist and incident procedures.
