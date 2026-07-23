import { Analytics } from "@vercel/analytics/next"
import { ClerkProvider } from "@clerk/nextjs"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono, Manrope } from "next/font/google"
import { GoogleAdsTag } from "@/components/analytics/google-ads"
import { MetaPixel } from "@/components/meta-pixel"
import "./globals.css"
import "./gutter.css"

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})
const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://gutterquote.example.com"),
  title: "HD Instant Gutter Quote by HD Precision — Instant gutter quote websites",
  description: "Branded instant gutter quote websites that help gutter contractors capture price-ready local leads.",
  openGraph: {
    title: "HD Instant Gutter Quote by HD Precision",
    description: "Turn your gutter website into a branded 24/7 estimator.",
    images: [{ url: "/gutter-quote-social.png", width: 1731, height: 909, alt: "A modern home with measured seamless gutters and downspouts" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HD Instant Gutter Quote by HD Precision",
    description: "Turn your gutter website into a branded 24/7 estimator.",
    images: ["/gutter-quote-social.png"],
  },
}

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#12362B",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const content = (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${manrope.variable}`}
    >
      <body className="font-sans antialiased">
        <MetaPixel />
        {children}
        <GoogleAdsTag />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <ClerkProvider>{content}</ClerkProvider> : content
}
