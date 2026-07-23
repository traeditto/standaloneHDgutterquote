import "server-only"

import { MANAGED_DOMAIN_MAX_PRICE, managedDomainError, normalizeManagedDomain } from "@/lib/domain-name"

type VercelErrorPayload = { error?: { code?: string; message?: string } }
type AvailabilityResponse = { available: boolean }
type PriceResponse = { years: number; purchasePrice: number | string; renewalPrice: number | string }
type PurchaseResponse = { orderId: string }

export type ManagedDomainQuote = {
  domain: string
  available: boolean
  owned: boolean
  eligible: boolean
  purchasePrice: number | null
  renewalPrice: number | null
  years: number
  maxPrice: number
  message: string
}

export class VercelDomainError extends Error {
  status: number
  code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function withTeam(path: string) {
  const url = new URL(path, "https://api.vercel.com")
  const teamId = process.env.VERCEL_TEAM_ID
  if (teamId) url.searchParams.set("teamId", teamId)
  return url.toString()
}

async function registrarRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.VERCEL_TOKEN
  if (!token) throw new VercelDomainError("Domain search is not configured yet.", 503)
  const response = await fetch(withTeam(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  })
  const data = (await response.json().catch(() => ({}))) as T & VercelErrorPayload
  if (!response.ok) {
    throw new VercelDomainError(data.error?.message || `Domain request failed with status ${response.status}.`, response.status, data.error?.code)
  }
  return data
}

function money(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(amount) || amount < 0) throw new VercelDomainError("The registrar returned an invalid domain price.", 502)
  return Number(amount.toFixed(2))
}

async function accountOwnsDomain(domain: string) {
  try {
    await registrarRequest(`/v5/domains/${encodeURIComponent(domain)}`)
    return true
  } catch (error) {
    if (error instanceof VercelDomainError && error.status === 404) return false
    if (error instanceof VercelDomainError && error.status === 403) return false
    throw error
  }
}

export async function getManagedDomainQuote(value: string, options: { allowedOwnedDomain?: string | null } = {}): Promise<ManagedDomainQuote> {
  const domain = normalizeManagedDomain(value)
  const validationError = managedDomainError(domain)
  if (validationError) throw new VercelDomainError(validationError, 400)

  if (await accountOwnsDomain(domain)) {
    const reusable = normalizeManagedDomain(options.allowedOwnedDomain || "") === domain
    return {
      domain,
      available: false,
      owned: true,
      eligible: reusable,
      purchasePrice: 0,
      renewalPrice: null,
      years: 0,
      maxPrice: MANAGED_DOMAIN_MAX_PRICE,
      message: reusable
        ? "This domain is already managed for your GutterQuote website and can be reused."
        : "That domain is reserved for another GutterQuote Cloud website. Try another name.",
    }
  }

  const availability = await registrarRequest<AvailabilityResponse>(`/v1/registrar/domains/${encodeURIComponent(domain)}/availability`)
  if (!availability.available) {
    return {
      domain,
      available: false,
      owned: false,
      eligible: false,
      purchasePrice: null,
      renewalPrice: null,
      years: 0,
      maxPrice: MANAGED_DOMAIN_MAX_PRICE,
      message: "That domain is already taken. Try another name.",
    }
  }

  const price = await registrarRequest<PriceResponse>(`/v1/registrar/domains/${encodeURIComponent(domain)}/price`)
  const purchasePrice = money(price.purchasePrice)
  const renewalPrice = money(price.renewalPrice)
  const withinBudget = purchasePrice <= MANAGED_DOMAIN_MAX_PRICE && renewalPrice <= MANAGED_DOMAIN_MAX_PRICE
  return {
    domain,
    available: true,
    owned: false,
    eligible: withinBudget,
    purchasePrice,
    renewalPrice,
    years: price.years,
    maxPrice: MANAGED_DOMAIN_MAX_PRICE,
    message: withinBudget
      ? `Available for $${purchasePrice.toFixed(2)} for the first ${price.years === 1 ? "year" : `${price.years} years`}.`
      : `This domain exceeds the $${MANAGED_DOMAIN_MAX_PRICE.toFixed(2)} registration or renewal limit. Try another name.`,
  }
}

function registrantContact() {
  const fields = {
    firstName: process.env.DOMAIN_REGISTRANT_FIRST_NAME,
    lastName: process.env.DOMAIN_REGISTRANT_LAST_NAME,
    email: process.env.DOMAIN_REGISTRANT_EMAIL,
    phone: process.env.DOMAIN_REGISTRANT_PHONE,
    address1: process.env.DOMAIN_REGISTRANT_ADDRESS1,
    city: process.env.DOMAIN_REGISTRANT_CITY,
    state: process.env.DOMAIN_REGISTRANT_STATE,
    zip: process.env.DOMAIN_REGISTRANT_ZIP,
    country: process.env.DOMAIN_REGISTRANT_COUNTRY || "US",
  }
  const missing = Object.entries(fields).filter(([, value]) => !value?.trim()).map(([key]) => key)
  if (missing.length > 0) throw new VercelDomainError(`Managed-domain registrant details are incomplete: ${missing.join(", ")}.`, 503)
  return {
    ...fields as Record<keyof typeof fields, string>,
    ...(process.env.DOMAIN_REGISTRANT_ADDRESS2 ? { address2: process.env.DOMAIN_REGISTRANT_ADDRESS2 } : {}),
    ...(process.env.DOMAIN_REGISTRANT_COMPANY ? { companyName: process.env.DOMAIN_REGISTRANT_COMPANY } : {}),
  }
}

export function assertManagedDomainPurchaseConfigured() {
  registrantContact()
}

export async function purchaseManagedDomain(quote: ManagedDomainQuote) {
  if (!quote.eligible) throw new VercelDomainError("This domain is not eligible for managed registration.", 400)
  if (quote.owned) return { purchased: false, orderId: null }
  if (!quote.available || quote.purchasePrice === null || quote.purchasePrice > MANAGED_DOMAIN_MAX_PRICE) {
    throw new VercelDomainError(`Domain registration cannot exceed $${MANAGED_DOMAIN_MAX_PRICE.toFixed(2)}.`, 400)
  }
  const purchase = await registrarRequest<PurchaseResponse>(`/v1/registrar/domains/${encodeURIComponent(quote.domain)}/buy`, {
    method: "POST",
    body: JSON.stringify({
      autoRenew: true,
      years: quote.years,
      expectedPrice: quote.purchasePrice,
      contactInformation: registrantContact(),
    }),
  })
  return { purchased: true, orderId: purchase.orderId }
}
