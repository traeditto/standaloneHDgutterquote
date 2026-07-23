import { describe, expect, it } from "vitest"
import { MANAGED_DOMAIN_MAX_PRICE, managedDomainError, managedDomainSuggestion, normalizeManagedDomain } from "@/lib/domain-name"

describe("managed domains", () => {
  it("normalizes a contractor domain", () => {
    expect(normalizeManagedDomain(" HTTPS://WWW.Summit-Gutters.com/path ")).toBe("summit-gutters.com")
  })

  it("requires a valid single-label .com", () => {
    expect(managedDomainError("summit-gutters.com")).toBe("")
    expect(managedDomainError("quotes.summit-gutters.com")).toContain("letters, numbers, or hyphens")
    expect(managedDomainError("summit-gutters.net")).toContain(".com")
  })

  it("creates a predictable suggestion and enforces the managed budget", () => {
    expect(managedDomainSuggestion("Summit Gutter Co.")).toBe("summitguttercoinstantquote.com")
    expect(MANAGED_DOMAIN_MAX_PRICE).toBe(15)
  })
})
