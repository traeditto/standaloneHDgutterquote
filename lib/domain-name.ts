export const MANAGED_DOMAIN_MAX_PRICE = 15

export function normalizeManagedDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    .replace(/^www\./, "")
    .replace(/\.$/, "")
}

export function managedDomainSuggestion(companyName: string) {
  const company = companyName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 38)
  return `${company || "yourcompanyname"}instantquote.com`
}

export function managedDomainError(value: string) {
  const domain = normalizeManagedDomain(value)
  if (!domain) return "Choose a domain name."
  if (domain.length > 63) return "Choose a shorter .com domain."
  if (!domain.endsWith(".com")) return "Managed domains must end in .com."
  const label = domain.slice(0, -4)
  if (label.length < 2 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)) {
    return "Use letters, numbers, or hyphens and end the name in .com."
  }
  return ""
}
