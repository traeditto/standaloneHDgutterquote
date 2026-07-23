"use client"

import Link from "next/link"
import { useState } from "react"
import { Check, Clipboard, Code2 } from "lucide-react"

export function WidgetInstallCard({ quoteUrl, allowedOrigins }: { quoteUrl: string | null; allowedOrigins: string[] }) {
  const [copied, setCopied] = useState(false)
  const source = quoteUrl?.replace(/\/$/, "") || ""
  const snippet = source ? `<script src="${source}/widget.js" data-label="Get an instant gutter quote" defer></script>` : ""

  async function copy() {
    if (!snippet) return
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return <article className="widget-install-card">
    <span>WEBSITE WIDGET</span>
    <h2><Code2 size={20} /> Add HD Instant Gutter Quote to your current site.</h2>
    {!source ? <><p>Publish your quote website first. Your secure installation snippet will appear here afterward.</p><Link href="/setup">Finish setup</Link></> : <>
      <p>Paste this once before your existing website&apos;s closing <code>&lt;/body&gt;</code> tag. It adds a branded quote button that opens the complete experience.</p>
      <pre><code>{snippet}</code></pre>
      <button type="button" onClick={copy}>{copied ? <><Check size={14} /> Copied</> : <><Clipboard size={14} /> Copy widget code</>}</button>
      <small>{allowedOrigins.length ? `Approved on: ${allowedOrigins.join(", ")}` : "Add your existing website URL in Template settings, then publish the update before installing."}</small>
    </>}
  </article>
}
