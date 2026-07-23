import { ShieldAlert } from "lucide-react"

export function SiteSuspended({ companyName }: { companyName: string }) {
  return <main className="suspended-site">
    <section>
      <span><ShieldAlert size={22} /></span>
      <small>WEBSITE TEMPORARILY UNAVAILABLE</small>
      <h1>{companyName}</h1>
      <p>This instant quote website is temporarily unavailable. Please contact the gutter company directly or check back soon.</p>
    </section>
  </main>
}
