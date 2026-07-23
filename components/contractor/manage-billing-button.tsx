"use client"

import { useState } from "react"

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const openPortal = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error || "Billing portal unavailable.")
      window.location.assign(result.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing portal unavailable.")
      setLoading(false)
    }
  }

  return <div className="billing-manage"><button type="button" onClick={openPortal} disabled={loading}>{loading ? "Opening…" : "Manage subscription"}</button>{error && <small>{error}</small>}</div>
}

