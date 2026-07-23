"use client"

import { MapPin, Ruler, FileCheck, Droplets } from "lucide-react"
import { BrandMark } from "@/components/brand-mark"
import { useCompanyConfig } from "@/components/company-config-provider"
import { STATE_NAMES } from "@/lib/company-config"

export function GutterTrustBar() {
  const stats = [
    { value: "24/7", label: "Quote availability" },
    { value: "60 sec", label: "Typical quote time" },
    { value: "$0", label: "Homeowner cost" },
  ]
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="font-heading text-2xl font-extrabold text-foreground sm:text-3xl">
              {s.value}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function GutterHowItWorks() {
  const config = useCompanyConfig()
  const steps = [
    {
      icon: MapPin,
      title: "Enter your address",
      body: "We pull up your home and locate the building outline — no measuring tape or ladder required.",
    },
    {
      icon: Ruler,
      title: "We estimate your gutter run",
      body: "We use public GIS and property records to estimate linear feet, downspouts, and installation complexity.",
    },
    {
      icon: FileCheck,
      title: "See instant pricing",
      body: "Compare the gutter sizes, profiles, and guard systems your local contractor offers — all in under a minute.",
    },
    {
      icon: Droplets,
      title: "Book a free inspection",
      body: `Choose the gutter system you like and schedule a final measurement with a ${config.companyName} specialist.`,
    },
  ]
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h2 className="text-balance font-heading text-3xl font-extrabold tracking-tight text-foreground">
          How it works
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-pretty text-muted-foreground">
          A transparent gutter quote without the awkward sales visit. Here&apos;s
          the whole process.
        </p>
      </div>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.title} className="relative rounded-2xl border border-border bg-card p-6">
            <span className="absolute right-5 top-5 font-heading text-4xl font-extrabold text-muted/60">
              {i + 1}
            </span>
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent/10">
              <s.icon className="size-6 text-accent" />
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold text-foreground">
              {s.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function GutterSiteFooter() {
  const config = useCompanyConfig()
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <BrandMark name={config.companyName} logo={config.logo} compact />
        <p>Licensed &amp; insured • Serving {config.counties.length} {config.counties.length === 1 ? "county" : "counties"} in {STATE_NAMES[config.state] ?? config.state}</p>
        <p>© {new Date().getFullYear()} {config.companyName}</p>
      </div>
    </footer>
  )
}
