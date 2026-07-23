"use client"

import Link from "next/link"
import { FlaskConical, Settings2 } from "lucide-react"
import { useState } from "react"
import { CompanyConfigProvider } from "@/components/company-config-provider"
import { GutterSiteHeader } from "@/components/site-header"
import { GutterHowItWorks, GutterSiteFooter, GutterTrustBar } from "@/components/gutter-marketing-sections"
import { QuoteTool } from "@/components/quote/quote-tool"
import type { CompanyConfig } from "@/lib/company-config"

export function QuoteExperience({
  previewMode = false,
  embedMode = false,
  initialConfig,
}: {
  productionMode?: boolean
  previewMode?: boolean
  embedMode?: boolean
  demoRenderAvailable?: boolean
  initialConfig?: CompanyConfig | null
}) {
  const [estimateGenerated, setEstimateGenerated] = useState(false)

  return (
    <CompanyConfigProvider initialConfig={initialConfig}>
      <div className={`gutter-experience flex min-h-screen flex-col bg-background ${embedMode ? "gutter-experience--embedded" : ""}`}>
        {previewMode && (
          <div className="sticky top-0 z-[100] flex flex-wrap items-center justify-between gap-3 bg-[#12362b] px-4 py-3 text-sm text-white shadow-lg sm:px-6">
            <span className="flex items-center gap-2 font-semibold"><FlaskConical className="size-4 text-[#d9f45b]" /> Private contractor preview · leads, email, and paid rendering are disabled</span>
            <Link href="/setup" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold hover:bg-white/20"><Settings2 className="size-4" /> Return to Setup Studio</Link>
          </div>
        )}
        {!embedMode && <GutterSiteHeader />}
        <main className="flex-1">
          <QuoteTool contractorPreview={previewMode} onEstimateGeneratedChange={setEstimateGenerated} />
          {!embedMode && <GutterTrustBar />}
          {!embedMode && !estimateGenerated && <GutterHowItWorks />}
        </main>
        {!embedMode && <GutterSiteFooter />}
      </div>
    </CompanyConfigProvider>
  )
}
