import "server-only"

import { DEFAULT_CONFIG, IS_DEPLOYED_COMPANY_SITE } from "@/lib/company-config"
import { getSiteAccess } from "@/lib/site-access"

export async function quoteApiAllowed() {
  if (!IS_DEPLOYED_COMPANY_SITE) return true
  try {
    return (await getSiteAccess(DEFAULT_CONFIG.tenantId)).allowed
  } catch {
    return false
  }
}
