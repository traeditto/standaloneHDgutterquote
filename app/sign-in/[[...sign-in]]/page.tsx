import { SignIn } from "@clerk/nextjs"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

export const metadata: Metadata = {
  title: "Sign In to HD Instant Gutter Quote | HD Precision",
}

export default function SignInPage() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) redirect("/signup?mode=login")
  return <main className="contractor-shell contractor-login-shell"><SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/contractor" /></main>
}
