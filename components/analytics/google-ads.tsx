import Script from "next/script"

const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID?.trim()

export function GoogleAdsTag() {
  if (!googleAdsId) return null

  return <>
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAdsId)}`}
      strategy="afterInteractive"
    />
    <Script id="google-ads-tag" strategy="afterInteractive">
      {`
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        window.gtag = window.gtag || gtag;
        gtag('js', new Date());
        gtag('config', '${googleAdsId}');
      `}
    </Script>
  </>
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export function trackContractorSignupConversion({
  transactionId,
  callback,
}: {
  transactionId: string
  callback: () => void
}) {
  const conversionLabel = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL?.trim()
  if (!googleAdsId || !conversionLabel || typeof window.gtag !== "function") {
    callback()
    return false
  }

  window.gtag("event", "conversion", {
    send_to: `${googleAdsId}/${conversionLabel}`,
    value: 1,
    currency: "USD",
    transaction_id: transactionId,
    event_callback: callback,
    event_timeout: 1500,
  })
  return true
}
