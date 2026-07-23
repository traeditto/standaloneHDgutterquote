# Production operations

## Launch gate

- Rotate all credentials ever copied to customer deployments. Use separate development, preview, and production credentials.
- Enforce verified email and MFA for Clerk organization owners/admins and platform staff. Confirm custom roles map only to the intended tenant.
- Connect through a transaction pooler with a restricted, non-owner PostgreSQL role. Apply and test RLS policies with that role.
- Enable encrypted backups, point-in-time recovery, quarterly restoration tests, and a private Blob lifecycle rule that deletes objects after 24 hours.
- Configure Redis, Turnstile, request/error monitoring, queue depth and latency, database saturation, provider spend, credit-ledger reconciliation, webhook failures, and cross-tenant denial alerts.
- Verify the Resend sending domain, publish its SPF and DKIM records, set a DMARC policy, and configure `RESEND_API_KEY`, `LEAD_FROM_EMAIL`, and `NEXT_PUBLIC_APP_URL`. Monitor terminal lead-notification failures and provider suppression/bounce events.
- Run cross-tenant, IDOR, CSRF, token-replay, malicious-upload, brute-force, rate-limit bypass, concurrent fourth/fifth render, and load tests. Complete an external penetration test.

## Incident response

1. Pause new provider calls with `RENDER_PLATFORM_PAUSED=true` when spend or provider behavior is abnormal.
2. Suspend only the affected tenant in the database; never pause the shared Vercel project for a tenant billing event.
3. Revoke affected Clerk sessions and rotate scoped secrets. Preserve audit, webhook, and request IDs without copying decrypted PII into incident notes.
4. Determine affected tenants and data, follow breach-notification obligations, restore from a tested point when necessary, and verify ledger and queue consistency.
5. Roll back the shared deployment from Vercel, run smoke/isolation checks, document the timeline and remediation, and rotate any exposed credential again.

## Data lifecycle

- Source and generated images: 24 hours.
- Abandoned quotes: 90 days.
- Completed leads: 24 months by default, configurable shorter per tenant.
- Owner/admin export: `GET /api/contractor/data/export`.
- Owner/admin lead deletion: `DELETE /api/contractor/data/leads/{leadId}`.

Deletion and export actions are immutable audit events. Periodically reconcile database image references against private object storage and verify that no decrypted homeowner PII appears in logs or error reporting.
