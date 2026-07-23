import { describe, expect, it } from "vitest"
import { launchCatalogMatches } from "@/lib/billing-pricing"

const expectedCatalog = {
  monthlyAmount: 19_900,
  monthlyCurrency: "usd",
  monthlyInterval: "month",
  setupAmount: 29_900,
  setupCurrency: "usd",
  setupRecurring: false,
  couponDeleted: false,
  couponAmountOff: 5_000,
  couponCurrency: "usd",
  couponDuration: "repeating",
  couponDurationMonths: 3,
}

describe("launch pricing", () => {
  it("accepts $299 setup, $149 for three months, then $199", () => {
    expect(launchCatalogMatches(expectedCatalog)).toBe(true)
  })

  it("rejects accidental price drift", () => {
    expect(launchCatalogMatches({ ...expectedCatalog, monthlyAmount: 24_900 })).toBe(false)
    expect(launchCatalogMatches({ ...expectedCatalog, couponDurationMonths: 2 })).toBe(false)
    expect(launchCatalogMatches({ ...expectedCatalog, setupRecurring: true })).toBe(false)
  })
})
