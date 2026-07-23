"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"
import { ArrowRight, Check, Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react"
import { trackContractorSignupConversion } from "@/components/analytics/google-ads"

type PlanCode = "demo" | "launch"

export function SignupForm({ initialPlan, initialMode = "signup" }: { initialPlan: PlanCode; initialMode?: "signup" | "login" }) {
  const router = useRouter()
  const [mode, setMode] = useState<"signup" | "login">(initialMode)
  const [plan, setPlan] = useState<PlanCode>(initialPlan)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError("")
    const form = new FormData(event.currentTarget)

    try {
      const response = await fetch(mode === "signup" ? "/api/signup" : "/api/signup/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "signup" ? {
          companyName: form.get("companyName"),
          contactName: form.get("contactName"),
          email: form.get("email"),
          phone: form.get("phone"),
          password: form.get("password"),
          plan,
          acceptedTerms: form.get("acceptedTerms") === "on",
        } : {
          email: form.get("email"),
          password: form.get("password"),
        }),
      })
      const result = await response.json() as { error?: string; tenantId?: string }
      if (!response.ok) throw new Error(result.error || "We could not open your workspace.")
      const destination = mode === "signup" ? "/setup?welcome=1" : "/setup"
      let navigated = false
      const navigate = () => {
        if (navigated) return
        navigated = true
        router.push(destination)
        router.refresh()
      }
      if (mode === "signup" && result.tenantId) {
        const trackingStarted = trackContractorSignupConversion({ transactionId: result.tenantId, callback: navigate })
        if (trackingStarted) window.setTimeout(navigate, 1600)
      } else {
        navigate()
      }
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "We could not open your workspace.")
      setLoading(false)
    }
  }

  return <main className="signup-shell">
    <section className="signup-story">
      <Link href="/for-contractors" className="sales-brand"><span><Sparkles size={18} /></span><b>HD Instant</b> Gutter Quote <small className="sales-brand-owner">by HD Precision</small></Link>
      <div>
        <small>BUILD BEFORE YOU BUY</small>
        <h1>See exactly what your custom page looks like before you pay.</h1>
        <p>Configure the brand, service area, products, colors, and prices. Test real addresses in the complete homeowner journey. Nothing is published—and no payment is required—until you approve the site for launch.</p>
        <ul>
          <li><Check size={16} /> No credit card to build the demo</li>
          <li><Check size={16} /> Unlimited private test addresses</li>
          <li><Check size={16} /> One free AI gutter visualization</li>
          <li><Check size={16} /> No production leads or emails</li>
          <li><Check size={16} /> Production provisioning remains payment-locked</li>
        </ul>
      </div>
      <p><ShieldCheck size={15} /> Your draft is private and only becomes a live customer website after payment.</p>
    </section>

    <section className="signup-panel">
      <div className="signup-card">
        <div className="signup-card__heading">
          <span>{mode === "signup" ? "FREE WORKSPACE" : "WELCOME BACK"}</span>
          <h2>{mode === "signup" ? "Build your contractor demo" : "Resume your contractor demo"}</h2>
          <p>{mode === "signup" ? "Start free. Choose whether you are exploring or already planning to launch." : "Use the business email and password from signup."}</p>
        </div>

        {mode === "signup" && <div className="signup-plan-picker" role="radiogroup" aria-label="Select a plan">
          <button type="button" role="radio" aria-checked={plan === "demo"} className={plan === "demo" ? "is-selected" : ""} onClick={() => setPlan("demo")}>
            <span><b>Free Demo</b><small>Build and test privately</small></span><strong>$0</strong>
          </button>
          <button type="button" role="radio" aria-checked={plan === "launch"} className={plan === "launch" ? "is-selected" : ""} onClick={() => setPlan("launch")}>
            <span><b>Managed Launch</b><small>$499 setup after approval</small></span><strong>$199 <small>/mo for 3 months, then $249/mo</small></strong>
          </button>
        </div>}

        <form onSubmit={submit}>
          {mode === "signup" && <div className="signup-field-row">
            <label><span>Gutter company</span><input name="companyName" required minLength={2} maxLength={120} placeholder="Acme Gutters" autoComplete="organization" /></label>
            <label><span>Your name</span><input name="contactName" required minLength={2} maxLength={120} placeholder="Jordan Smith" autoComplete="name" /></label>
          </div>}
          <div className={mode === "signup" ? "signup-field-row" : ""}>
            <label><span>Business email</span><input name="email" type="email" required placeholder="you@company.com" autoComplete="email" /></label>
            {mode === "signup" && <label><span>Business phone</span><input name="phone" type="tel" required minLength={7} maxLength={40} placeholder="(555) 555-0147" autoComplete="tel" /></label>}
          </div>
          <label><span>Password</span><div className="signup-password"><input name="password" type={showPassword ? "text" : "password"} required minLength={12} maxLength={200} placeholder={mode === "signup" ? "At least 12 characters" : "Your password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>
          {mode === "signup" && <label className="signup-terms"><input name="acceptedTerms" type="checkbox" required /><span><Check size={11} /></span><p>I agree to use test property data only for evaluating my own contractor website and understand that the demo cannot be published until payment is active.</p></label>}
          {error && <div className="signup-error">{error}</div>}
          <button className="signup-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17} /> Opening workspace…</> : <>{mode === "signup" ? "Build my free demo" : "Resume my demo"} <ArrowRight size={16} /></>}</button>
        </form>

        <div className="signup-switch">
          <LockKeyhole size={14} />
          <span>{mode === "signup" ? "Already started a demo?" : "Need a new workspace?"}</span>
          <button type="button" onClick={() => { setMode((current) => current === "signup" ? "login" : "signup"); setError("") }}>{mode === "signup" ? "Sign in" : "Create one free"}</button>
        </div>
      </div>
    </section>
  </main>
}
