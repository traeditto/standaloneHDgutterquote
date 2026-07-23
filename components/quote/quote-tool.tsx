"use client"

import { useEffect, useState } from "react"
import {
  billableGutterLength,
  measureRoof,
  type MaterialId,
  type RoofMeasurement,
} from "@/lib/gutter-quote"
import { enabledProducts } from "@/lib/company-config"
import { useCompanyConfig } from "@/components/company-config-provider"
import { configFingerprint, recordAddressTest } from "@/lib/publish-workflow"
import { Stepper } from "./stepper"
import { AddressStep, type VerifiedPropertyAddress } from "./address-step"
import { ConfirmStep } from "./confirm-step"
import { MeasuringStep } from "./measuring-step"
import { LeadStep } from "./lead-step"
import { MaterialsStep } from "./materials-step"
import { SuccessStep } from "./success-step"
import { UnavailableStep } from "./unavailable-step"

type Stage =
  | "address"
  | "confirm"
  | "measuring"
  | "lead"
  | "materials"
  | "success"
  | "unavailable"

const STAGE_TO_STEP: Record<Stage, number> = {
  address: 0,
  confirm: 0,
  measuring: 1,
  lead: 2,
  materials: 3,
  success: 3,
  unavailable: 1,
}

export function QuoteTool({
  contractorPreview = false,
  onEstimateGeneratedChange,
}: {
  contractorPreview?: boolean
  onEstimateGeneratedChange?: (generated: boolean) => void
}) {
  const config = useCompanyConfig()
  const materials = enabledProducts(config)
  const [stage, setStage] = useState<Stage>("address")
  const [address, setAddress] = useState("")
  const [addressVerification, setAddressVerification] = useState<VerifiedPropertyAddress | null>(null)
  const [quoteSessionId, setQuoteSessionId] = useState("")
  const [measurement, setMeasurement] = useState<RoofMeasurement | null>(null)
  const [selectedId, setSelectedId] = useState<MaterialId | null>(null)
  const [gutterLength, setGutterLength] = useState<number | null>(null)
  // Building height used for pricing. Defaults to the detected story count when
  // a measurement lands, but the customer can override it on the quote step.
  const [stories, setStories] = useState<number | null>(null)
  const [contact, setContact] = useState({ name: "", email: "", phone: "" })
  const [unavailableReason, setUnavailableReason] = useState<
    "not-found" | "error" | "out-of-area"
  >("not-found")
  const [sessionError, setSessionError] = useState("")

  async function startSession() {
    setQuoteSessionId("")
    const response = await fetch("/api/quotes/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testMode: contractorPreview }),
    })
    const result = await response.json() as { sessionId?: string; error?: string }
    if (!response.ok || !result.sessionId) throw new Error(result.error || "The quote session could not be started.")
    setQuoteSessionId(result.sessionId)
    setSessionError("")
  }

  useEffect(() => {
    void startSession().catch((error) => {
      setSessionError(error instanceof Error ? error.message : "The quote session could not be started.")
    })
    // Start exactly one server-bound session for this mounted quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function trackActivity(
    nextStage: "address-entered" | "measurement-started" | "measured" | "measurement-unavailable" | "out-of-area" | "lead-submitted" | "quote-viewed",
    details: { name?: string; email?: string; phone?: string } = {},
    verification = addressVerification,
  ) {
    if (!verification || !quoteSessionId) return
    void fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: quoteSessionId,
        addressToken: verification.token,
        completed: nextStage === "quote-viewed",
        contactProvided: Boolean(details.name || details.email || details.phone),
        testMode: contractorPreview,
        ...details,
      }),
      keepalive: true,
    }).catch(() => undefined)
  }

  // Step 1: capture the address and show the aerial confirmation before we
  // spend a measurement on it.
  function handleAddress(verification: VerifiedPropertyAddress) {
    setAddress(verification.address)
    setAddressVerification(verification)
    setStage("confirm")
    trackActivity("address-entered", {}, verification)
  }

  // Step 2: once the customer confirms the aerial view is their home, run the
  // roof measurement. If they dragged the confirmation pin onto the correct
  // roof, `coords` carries the corrected location to measure instead.
  async function runMeasurement(coords?: { lat: number; lon: number }) {
    setStage("measuring")
    trackActivity("measurement-started")
    const result = await measureRoof(quoteSessionId, addressVerification?.token || "", coords)
    if (result.status === "ok") {
      trackActivity("measured")
      setMeasurement(result.measurement)
      setStories(result.measurement.stories ?? 1)
      if (contractorPreview) {
        recordAddressTest({
          address,
          status: "automatic",
          successful: true,
          measurementSource: result.measurement.source,
          gutterLength: billableGutterLength(result.measurement),
          configFingerprint: configFingerprint(config),
        })
        const recommended = materials.find((material) => material.badge)?.id ?? materials[0]?.id
        if (recommended) setSelectedId(recommended)
        setContact({ name: "Contractor test", email: "preview@example.com", phone: "5555555555" })
        setStage("materials")
      } else {
        setStage("lead")
      }
    } else {
      trackActivity(result.status === "out-of-area" ? "out-of-area" : "measurement-unavailable")
      if (contractorPreview) {
        recordAddressTest({
          address,
          status: result.status === "out-of-area" ? "out-of-area" : "unavailable",
          successful: false,
          configFingerprint: configFingerprint(config),
        })
      }
      setUnavailableReason(result.status)
      setStage("unavailable")
    }
  }

  function handleRestart() {
    setStage("address")
    setAddress("")
    setAddressVerification(null)
    void startSession().catch(() => setSessionError("The quote session could not be restarted."))
    setMeasurement(null)
    setSelectedId(null)
    setGutterLength(null)
    setStories(null)
    setContact({ name: "", email: "", phone: "" })
  }

  const selectedMaterial = materials.find((m) => m.id === selectedId) ?? null
  const estimateGenerated = stage !== "address"

  useEffect(() => {
    onEstimateGeneratedChange?.(estimateGenerated)
  }, [estimateGenerated, onEstimateGeneratedChange])

  return (
    <section
      id="quote-tool"
      className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14"
    >
      <div className="mb-8">
        <Stepper current={STAGE_TO_STEP[stage]} />
      </div>
      {sessionError && <p className="mx-auto mb-5 max-w-xl rounded-xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-800">{sessionError}</p>}

      {stage === "address" && (
        <AddressStep
          onSubmit={handleAddress}
          quoteSessionId={quoteSessionId}
          contractorPreview={contractorPreview}
          initialValue={address}
          initialVerification={addressVerification}
        />
      )}

      {stage === "confirm" && (
        <ConfirmStep
          address={address}
          addressToken={addressVerification?.token || ""}
          sessionId={quoteSessionId}
          onConfirm={runMeasurement}
          onEdit={() => setStage("address")}
        />
      )}

      {stage === "measuring" && <MeasuringStep address={address} />}

      {stage === "unavailable" && (
        <UnavailableStep
          address={address}
          reason={unavailableReason}
          onBack={handleRestart}
          onManualEstimate={(m) => {
            setMeasurement(m)
            setStories(m.stories ?? 1)
            trackActivity("measured")
            if (contractorPreview) {
              recordAddressTest({
                address,
                status: "manual",
                successful: true,
                measurementSource: m.source,
                gutterLength: billableGutterLength(m),
                configFingerprint: configFingerprint(config),
              })
              const recommended = materials.find((material) => material.badge)?.id ?? materials[0]?.id
              if (recommended) setSelectedId(recommended)
              setContact({ name: "Contractor test", email: "preview@example.com", phone: "5555555555" })
              setStage("materials")
            } else {
              setStage("lead")
            }
          }}
        />
      )}

      {stage === "lead" && measurement && (
        <LeadStep
          address={address}
          quoteSessionId={quoteSessionId}
          addressToken={addressVerification?.token || ""}
          measurement={measurement}
          gutterLength={gutterLength}
          onGutterLengthChange={setGutterLength}
          onSubmit={(lead) => {
            setContact(lead)
            // Pre-select the recommended gutter system so pricing is visible
            // immediately on the quote step.
            if (!selectedId) {
              const recommended =
                materials.find((m) => m.badge)?.id ?? materials[0]?.id
              if (!recommended) return
              setSelectedId(recommended)
            }
            setStage("materials")
          }}
        />
      )}

      {stage === "materials" && measurement && (
        <MaterialsStep
          address={address}
          quoteSessionId={quoteSessionId}
          addressToken={addressVerification?.token || ""}
          measurement={measurement}
          selected={selectedId}
          onSelect={setSelectedId}
          gutterLength={gutterLength}
          onGutterLengthChange={setGutterLength}
          stories={stories ?? measurement.stories ?? 1}
          onStoriesChange={setStories}
          contractorPreview={contractorPreview}
          onContinue={() => {
            trackActivity("quote-viewed", contact)
            setStage("success")
          }}
        />
      )}

      {stage === "success" && measurement && selectedMaterial && (
        <SuccessStep
          name={contact.name}
          email={contact.email}
          material={selectedMaterial}
          measurement={measurement}
          gutterLength={gutterLength}
          stories={stories ?? measurement.stories ?? 1}
          onRestart={handleRestart}
        />
      )}
    </section>
  )
}
