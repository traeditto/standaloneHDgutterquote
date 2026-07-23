import Link from "next/link"

export function ContractorPortalHeader({
  companyName,
  active,
  websiteUrl,
}: {
  companyName: string
  active: "dashboard" | "abandoned"
  websiteUrl?: string | null
}) {
  return <header className="contractor-header">
    <div><small>CONTRACTOR PORTAL</small><h1>{companyName}</h1></div>
    <nav aria-label="Contractor portal">
      <Link className={active === "dashboard" ? "is-active" : ""} href="/contractor">Dashboard</Link>
      <Link href="/setup">Edit website</Link>
      <Link className={active === "abandoned" ? "is-active" : ""} href="/contractor/abandoned">Abandoned addresses</Link>
      <Link href={websiteUrl || "/preview"} target={websiteUrl ? "_blank" : undefined} rel={websiteUrl ? "noreferrer" : undefined}>View website</Link>
      <form action="/api/contractor/logout" method="post"><button>Sign out</button></form>
    </nav>
  </header>
}
