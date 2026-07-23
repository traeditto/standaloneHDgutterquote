import { SignUp } from "@clerk/nextjs"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Create Your HD Instant Gutter Quote Account | HD Precision",
}

export default function SignUpPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect("/signup")
  return <main className="contractor-shell contractor-login-shell"><SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/onboarding" /></main>
}
