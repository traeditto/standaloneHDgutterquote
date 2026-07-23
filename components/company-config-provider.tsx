"use client"

import { createContext, useContext, useEffect, useState } from "react"
import {
  DEFAULT_CONFIG,
  loadCompanyConfig,
  normalizeCompanyConfig,
  type CompanyConfig,
} from "@/lib/company-config"

const CompanyConfigContext = createContext<CompanyConfig>(DEFAULT_CONFIG)

export function CompanyConfigProvider({
  children,
  initialConfig,
}: {
  children: React.ReactNode
  initialConfig?: CompanyConfig | null
}) {
  const [config, setConfig] = useState(() =>
    initialConfig ? normalizeCompanyConfig(initialConfig, DEFAULT_CONFIG) : DEFAULT_CONFIG,
  )

  useEffect(() => {
    if (!initialConfig) setConfig(loadCompanyConfig())
  }, [initialConfig])

  return (
    <CompanyConfigContext.Provider value={config}>
      <div
        style={{
          "--primary": config.primaryColor,
          "--accent": config.accentColor,
          "--ring": config.accentColor,
          "--brand": config.accentColor,
        } as React.CSSProperties}
      >
        {children}
      </div>
    </CompanyConfigContext.Provider>
  )
}

export function useCompanyConfig() {
  return useContext(CompanyConfigContext)
}
