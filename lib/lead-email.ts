import "server-only"

import { Resend } from "resend"

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!)
}

export async function sendLeadEmail(input: {
  to: string; companyName: string; address: string; state: string; county: string
  name: string; email: string; phone: string; estimate?: string; idempotencyKey: string
  eventType: "lead.contact_provided" | "quote.completed"
}) {
  if (!process.env.RESEND_API_KEY || !process.env.LEAD_FROM_EMAIL) throw new Error("Lead email delivery is not configured.")
  const resend = new Resend(process.env.RESEND_API_KEY)
  const dashboardUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "")}/contractor`
  const property = `${input.address}, ${input.county}, ${input.state}`
  const completed = input.eventType === "quote.completed"
  const activity = completed ? "completed an instant quote" : "shared their contact information while building a quote"
  const response = await resend.emails.send({
    from: process.env.LEAD_FROM_EMAIL,
    to: input.to,
    ...(input.email ? { replyTo: input.email } : {}),
    subject: `${completed ? "Completed gutter quote" : "New gutter lead"}: ${input.address}`,
    text: `New GutterQuote lead for ${input.companyName}\n\n${input.name} ${activity}.\nProperty: ${property}\nEmail: ${input.email}\nPhone: ${input.phone}${input.estimate ? `\nEstimate: ${input.estimate}` : ""}${dashboardUrl.startsWith("http") ? `\n\nDashboard: ${dashboardUrl}` : ""}`,
    html: `<h2>${completed ? "Completed GutterQuote" : "New GutterQuote lead"}</h2><p><strong>${escapeHtml(input.name)}</strong> ${activity}.</p>
      <table cellpadding="6"><tr><td><strong>Property</strong></td><td>${escapeHtml(property)}</td></tr>
      <tr><td><strong>Email</strong></td><td><a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></td></tr>
      <tr><td><strong>Phone</strong></td><td><a href="tel:${escapeHtml(input.phone)}">${escapeHtml(input.phone)}</a></td></tr>
      ${input.estimate ? `<tr><td><strong>Estimate</strong></td><td>${escapeHtml(input.estimate)}</td></tr>` : ""}</table>
      <p>${dashboardUrl.startsWith("http") ? `<a href="${escapeHtml(dashboardUrl)}">Open the contractor dashboard</a> to see the full quote and incomplete address starts.` : `Sign in to the ${escapeHtml(input.companyName)} contractor dashboard to see full quote details and incomplete address starts.`}</p>`,
  }, { idempotencyKey: input.idempotencyKey })
  if (response.error) throw new Error(response.error.message || "The email provider rejected the lead notification.")
  if (!response.data?.id) throw new Error("The email provider did not confirm the lead notification.")
  return { sent: true, providerMessageId: response.data.id }
}
