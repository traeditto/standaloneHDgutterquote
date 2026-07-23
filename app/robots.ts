import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://quote.hdprecision.com"

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/for-contractors", "/gutter-quote-software", "/instant-gutter-quote", "/gutter-estimate-software"],
      disallow: ["/platform/", "/api/", "/setup/", "/account/"],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
