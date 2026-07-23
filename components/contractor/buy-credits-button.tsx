"use client"

import { useState } from "react"
import { CreditCard, LoaderCircle } from "lucide-react"

export function BuyCreditsButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function buy() {
    setBusy(true); setError("")
    try {
      const response = await fetch("/api/billing/checkout", { method: "POST" })
      const result = await response.json() as { url?: string; error?: string }
      if (!response.ok || !result.url) throw new Error(result.error || "Checkout could not be opened.")
      window.location.href = result.url
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Checkout could not be opened."); setBusy(false) }
  }
  return <div className="buy-credits"><button type="button" onClick={buy} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16} /> : <CreditCard size={16} />} Buy render credits</button>{error && <small>{error}</small>}</div>
}
