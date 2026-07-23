import { describe, expect, it } from "vitest"
import { productionReadiness } from "@/lib/production-config"

describe("production readiness", () => {
  it("reports missing launch configuration by group", () => {
    const result = productionReadiness({ DATABASE_URL: "postgres://configured" })
    expect(result.ready).toBe(false)
    expect(result.groups.find((group) => group.id === "database")?.missing).toContain("PLATFORM_DATABASE_URL")
    expect(result.missing).toContain("STRIPE_SECRET_KEY")
  })

  it("never treats whitespace as configured", () => {
    expect(productionReadiness({ STRIPE_SECRET_KEY: "   " }).missing).toContain("STRIPE_SECRET_KEY")
  })
})
