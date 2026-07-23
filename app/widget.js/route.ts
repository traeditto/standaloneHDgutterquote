import { NextRequest, NextResponse } from "next/server"
import { resolvePublicTenant, tenantCompanyConfig } from "@/lib/tenant-context"
import { createWidgetToken } from "@/lib/widget-auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function parentOrigin(request: NextRequest) {
  const referrer = request.headers.get("referer")
  if (!referrer) return null
  try { return new URL(referrer).origin.toLowerCase() } catch { return null }
}

function javascript(message: string, status = 200) {
  return new NextResponse(message, { status, headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
}

export async function GET(request: NextRequest) {
  const tenant = await resolvePublicTenant(request)
  if (!tenant || !["active", "grace"].includes(tenant.access_state)) return javascript(`console.warn("HD Instant Gutter Quote widget is unavailable.");`, 404)
  const origin = parentOrigin(request)
  const config = await tenantCompanyConfig(tenant)
  if (!origin || !config.widgetAllowedOrigins.includes(origin)) return javascript(`console.warn("HD Instant Gutter Quote widget blocked: this website origin is not approved by the contractor.");`, 403)
  const token = createWidgetToken({ tenantId: tenant.tenant_id, parentOrigin: origin, expiresAt: Date.now() + 24 * 60 * 60 * 1000 })
  const frameUrl = `${new URL(request.url).origin}/embed?token=${encodeURIComponent(token)}`
  const defaultLabel = `Get an instant gutter quote`

  return javascript(`(() => {
    const script = document.currentScript;
    if (!script || script.dataset.roofQuoteLoaded === "true") return;
    script.dataset.roofQuoteLoaded = "true";
    const label = (script.dataset.label || ${JSON.stringify(defaultLabel)}).slice(0, 80);
    const color = /^#[0-9a-f]{6}$/i.test(script.dataset.color || "") ? script.dataset.color : ${JSON.stringify(config.primaryColor)};
    const accent = /^#[0-9a-f]{6}$/i.test(script.dataset.accent || "") ? script.dataset.accent : ${JSON.stringify(config.accentColor)};
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-haspopup", "dialog");
    Object.assign(button.style, { position:"fixed", right:"22px", bottom:"22px", zIndex:"2147483000", border:"0", borderRadius:"999px", padding:"15px 21px", background:color, color:"#fff", boxShadow:"0 12px 35px rgba(0,0,0,.25)", font:"700 15px system-ui,-apple-system,sans-serif", cursor:"pointer" });
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog"); overlay.setAttribute("aria-modal", "true"); overlay.setAttribute("aria-label", ${JSON.stringify(`${config.companyName} instant gutter quote`)});
    Object.assign(overlay.style, { display:"none", position:"fixed", inset:"0", zIndex:"2147483640", background:"rgba(10,24,20,.72)", padding:"clamp(8px,2vw,24px)", boxSizing:"border-box" });
    const shell = document.createElement("div");
    Object.assign(shell.style, { position:"relative", width:"min(1180px,100%)", height:"100%", margin:"0 auto", background:"#f4f6f2", borderRadius:"16px", overflow:"hidden", boxShadow:"0 25px 90px rgba(0,0,0,.38)" });
    const close = document.createElement("button"); close.type="button"; close.textContent="×"; close.setAttribute("aria-label","Close gutter quote");
    Object.assign(close.style, { position:"absolute", top:"10px", right:"12px", zIndex:"3", width:"38px", height:"38px", border:"0", borderRadius:"50%", background:color, color:accent, font:"30px/34px system-ui", cursor:"pointer", boxShadow:"0 5px 18px rgba(0,0,0,.2)" });
    const iframe = document.createElement("iframe"); iframe.src=${JSON.stringify(frameUrl)}; iframe.title=${JSON.stringify(`${config.companyName} instant gutter quote`)}; iframe.loading="eager"; iframe.allow="clipboard-write"; iframe.referrerPolicy="strict-origin";
    Object.assign(iframe.style, { width:"100%", height:"100%", border:"0", background:"#f4f6f2" });
    shell.append(close, iframe); overlay.append(shell); document.body.append(button, overlay);
    let previousOverflow="";
    const open = () => { previousOverflow=document.documentElement.style.overflow; document.documentElement.style.overflow="hidden"; overlay.style.display="block"; close.focus(); };
    const shut = () => { overlay.style.display="none"; document.documentElement.style.overflow=previousOverflow; button.focus(); };
    button.addEventListener("click", open); close.addEventListener("click", shut); overlay.addEventListener("click", e => { if (e.target === overlay) shut(); }); document.addEventListener("keydown", e => { if (e.key === "Escape" && overlay.style.display !== "none") shut(); });
  })();`)
}
