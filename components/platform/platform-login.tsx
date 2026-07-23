"use client"

import Link from "next/link"
import { FormEvent, useState } from "react"

export function PlatformLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError("")
    const response = await fetch("/api/platform/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const result = await response.json() as { error?: string }
    if (!response.ok) {
      setError(result.error || "Sign-in failed.")
      setLoading(false)
      return
    }
    window.location.reload()
  }

  return <main className="platform-login-shell"><form className="platform-login" onSubmit={submit}>
    <small>HD PRECISION · PRIVATE ADMIN</small><h1>Admin sign in</h1><p>Manage customers, billing status, domains, deployments, leads, rendering usage, and platform operations.</p>
    <label><span>Admin email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoFocus autoComplete="username" placeholder="you@company.com" /></label>
    <label><span>Admin password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
    {error && <div>{error}</div>}<button disabled={loading || email.length === 0 || password.length === 0}>{loading ? "Signing in…" : "Open admin portal"}</button>
    <Link href="/">Return to HD Instant Gutter Quote</Link>
  </form></main>
}
