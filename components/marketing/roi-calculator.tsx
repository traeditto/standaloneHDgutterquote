"use client"

import { useMemo, useState, type ChangeEvent } from "react"

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value)
}

export function RoiCalculator() {
  const [traffic, setTraffic] = useState(1000)
  const [conversionLift, setConversionLift] = useState(1.5)
  const [closeRate, setCloseRate] = useState(30)
  const [ticket, setTicket] = useState(3000)
  const result = useMemo(() => {
    const inspections = Math.max(0, traffic) * Math.max(0, conversionLift) / 100
    const jobs = inspections * Math.max(0, closeRate) / 100
    return { inspections, jobs, revenue: jobs * Math.max(0, ticket) }
  }, [closeRate, conversionLift, ticket, traffic])

  const numberInput = (setter: (value: number) => void, options: { min: number; max: number }) => (event: ChangeEvent<HTMLInputElement>) => setter(Math.min(options.max, Math.max(options.min, Number(event.target.value) || 0)))

  return <div className="roi-calculator">
    <div className="roi-calculator__inputs">
      <label><span>Monthly website visitors</span><input type="number" min="0" max="1000000" step="100" value={traffic} onChange={numberInput(setTraffic, { min: 0, max: 1000000 })} /></label>
      <label><span>Added visitor-to-booked-estimate conversion</span><div><input type="number" min="0" max="25" step="0.1" value={conversionLift} onChange={numberInput(setConversionLift, { min: 0, max: 25 })} /><em>%</em></div></label>
      <label><span>Booked-estimate-to-sold-job close rate</span><div><input type="number" min="0" max="100" step="1" value={closeRate} onChange={numberInput(setCloseRate, { min: 0, max: 100 })} /><em>%</em></div></label>
      <label><span>Average gutter ticket</span><div><em>$</em><input type="number" min="0" max="1000000" step="250" value={ticket} onChange={numberInput(setTicket, { min: 0, max: 1000000 })} /></div></label>
    </div>
    <div className="roi-calculator__results" aria-live="polite"><small>DIRECTIONAL MONTHLY OPPORTUNITY</small><article><span>Additional booked estimates</span><strong>{result.inspections.toFixed(1)}</strong></article><article><span>Potential sold jobs</span><strong>{result.jobs.toFixed(1)}</strong></article><article className="is-revenue"><span>Revenue opportunity</span><strong>{money(result.revenue)}</strong></article><p>Illustrative scenario only. HD Instant Gutter Quote does not guarantee traffic, conversion lift, appointments, close rate, jobs, or revenue.</p></div>
  </div>
}
