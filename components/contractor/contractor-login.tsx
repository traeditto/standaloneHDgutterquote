"use client"

import { FormEvent, useState } from "react"
import { LockKeyhole, LoaderCircle } from "lucide-react"

export function ContractorLogin({ companyName }: { companyName: string }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try {
      const response = await fetch("/api/contractor/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error || "Sign-in failed.")
      window.location.reload()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Sign-in failed.") } finally { setBusy(false) }
  }

  return <main className="contractor-shell contractor-login-shell"><form className="contractor-login" onSubmit={submit}>
    <span className="contractor-login__icon"><LockKeyhole /></span><small>PRIVATE CONTRACTOR PORTAL</small><h1>{companyName}</h1>
    <p>Sign in to edit your website, update products and pricing, and review completed or abandoned quote activity.</p>
    <label><span>Dashboard password</span><input autoFocus required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    {error && <div className="contractor-error">{error}</div>}
    <button disabled={busy}>{busy ? <><LoaderCircle className="spin" size={16} /> Signing in…</> : "Open dashboard"}</button>
  </form></main>
}
