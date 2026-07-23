"use client"

import { ExternalLink } from "lucide-react"
import { useEffect, useState } from "react"
import type { GoogleReviewSummary } from "@/lib/google-reviews-types"

export function GoogleReviews({ previewPlaceId }: { previewPlaceId?: string }) {
  const [summary, setSummary] = useState<GoogleReviewSummary | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch("/api/google-reviews", previewPlaceId ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ placeId: previewPlaceId }),
          signal: controller.signal,
        } : { signal: controller.signal })
        const result = await response.json() as { enabled?: boolean; summary?: GoogleReviewSummary }
        if (response.ok && result.enabled && result.summary) setSummary(result.summary)
      } catch { /* Reviews are optional; keep the quote experience available. */ }
    }
    void load()
    return () => controller.abort()
  }, [previewPlaceId])

  if (!summary) return null

  const mapsHref = summary.googleMapsUri || undefined
  return (
    <section className="google-reviews-section" aria-label={`Google reviews for ${summary.businessName}`}>
      <div className="google-reviews-heading">
        <span>Trusted by local homeowners</span>
        <h2>Gutter service backed by<br /><em>real customer reviews.</em></h2>
        <div className="google-reviews-rating"><b>{summary.rating.toFixed(1)}</b><span aria-label={`${summary.rating} out of 5 stars`}>{"★".repeat(Math.round(summary.rating))}</span><small>{summary.reviewCount.toLocaleString()} Google reviews</small>{mapsHref && <a href={mapsHref} target="_blank" rel="noreferrer">View on Google <ExternalLink size={12} /></a>}</div>
      </div>
      {summary.reviews.length > 0 && <div className="google-review-cards">
        {summary.reviews.map((review, index) => (
          <article key={`${review.authorName}-${index}`}>
            <div><span aria-hidden="true">{"★".repeat(Math.round(review.rating))}</span><small>{review.relativeTime}</small></div>
            <p>“{review.text}”</p>
            {review.authorUri ? <a href={review.authorUri} target="_blank" rel="noreferrer">{review.authorName}</a> : <b>{review.authorName}</b>}
          </article>
        ))}
      </div>}
      <div className="google-reviews-attribution">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png" alt="Powered by Google" />
      </div>
    </section>
  )
}
