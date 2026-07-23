import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://quote.hdprecision.com"
  const routes = [
    "/for-contractors",
    "/gutter-quote-software",
    "/instant-gutter-quote",
    "/gutter-estimate-software",
  ]

  return routes.map((route, index) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.8,
  }))
}
