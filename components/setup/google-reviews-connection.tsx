"use client"

import { ExternalLink, LoaderCircle, Star } from "lucide-react"
import { useState } from "react"
import type { GoogleReviewSummary } from "@/lib/google-reviews-types"

export function GoogleReviewsConnection({
  placeId,
  enabled,
  canPreview,
  onPlaceIdChange,
  onEnabledChange,
}: {
  placeId: string
  enabled: boolean
  canPreview: boolean
  onPlaceIdChange: (value: string) => void
  onEnabledChange: (value: boolean) => void
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [error, setError] = useState("")
  const [summary, setSummary] = useState<GoogleReviewSummary | null>(null)

  const checkConnection = async () => {
    setStatus("loading")
    setError("")
    setSummary(null)
    try {
      const response = await fetch("/api/google-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ placeId }),
      })
      const result = await response.json() as { summary?: GoogleReviewSummary; error?: string }
      if (!response.ok || !result.summary) throw new Error(result.error || "Google could not verify this business.")
      setSummary(result.summary)
      setStatus("ready")
      onEnabledChange(true)
    } catch (connectionError) {
      setError(connectionError instanceof Error ? connectionError.message : "Google could not verify this business.")
      setStatus("error")
      onEnabledChange(false)
    }
  }

  return (
    <section className="google-reviews-setup">
      <div className="google-reviews-setup__heading">
        <span><Star size={16} fill="currentColor" /><b>Google reviews</b><small>Optional</small></span>
        <label className="switch" aria-label="Show Google reviews on quote site">
          <input type="checkbox" checked={enabled} disabled={!placeId.trim()} onChange={(event) => onEnabledChange(event.target.checked)} />
          <span />
        </label>
      </div>
      <p>Show your Google rating and up to three recent review excerpts on your instant quote site.</p>
      <label className="google-place-field">
        <span>Google Business Place ID</span>
        <div><input value={placeId} onChange={(event) => { onPlaceIdChange(event.target.value); setStatus("idle"); setSummary(null); setError("") }} placeholder="Paste your Place ID, such as ChIJ…" autoCapitalize="none" autoCorrect="off" spellCheck={false} /><button type="button" onClick={() => void checkConnection()} disabled={!canPreview || !placeId.trim() || status === "loading"}>{status === "loading" ? <LoaderCircle className="spin" size={14} /> : <Star size={14} />} Check connection</button></div>
      </label>
      <a className="google-place-help" href="https://developers.google.com/maps/documentation/places/web-service/place-id#find-id" target="_blank" rel="noreferrer">Find my Google Place ID <ExternalLink size={12} /></a>
      {!canPreview && <p className="google-review-note">Save this template to a contractor account to test the connection.</p>}
      {error && <p className="google-review-error">{error}</p>}
      {summary && (
        <div className="google-review-preview">
          <span className="google-review-preview__score"><b>{summary.rating.toFixed(1)}</b><i>{"★".repeat(Math.round(summary.rating))}</i><small>{summary.reviewCount.toLocaleString()} Google reviews</small></span>
          <span><b>{summary.businessName}</b><small>Connected · reviews will appear when this option is on.</small></span>
        </div>
      )}
    </section>
  )
}
