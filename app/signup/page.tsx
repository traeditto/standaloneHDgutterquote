import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { SignupForm } from "@/components/signup/signup-form"
import { CONTRACTOR_COOKIE, readContractorSession } from "@/lib/contractor-auth"
import { getTenant } from "@/lib/platform-db"

export const metadata: Metadata = {
  title: "Build Your Free HD Instant Gutter Quote Demo | HD Precision",
  description: "Build and test a private HD Instant Gutter Quote website from HD Precision before paying to launch it.",
}

export const dynamic = "force-dynamic"

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string; mode?: string }> }) {
  const params = await searchParams
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    redirect(params.mode === "login" ? "/sign-in" : "/sign-up")
  }
  let tenantId: string | null = null
  try { tenantId = readContractorSession((await cookies()).get(CONTRACTOR_COOKIE)?.value) } catch { /* show signup when sessions are not configured */ }
  if (tenantId && await getTenant(tenantId).catch(() => null)) redirect("/setup")
  const plan = params.plan === "launch" ? "launch" : "demo"
  return <SignupForm initialPlan={plan} initialMode={params.mode === "login" ? "login" : "signup"} />
}
