"use client"

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Check, LoaderCircle, MapPin, Move, Pencil } from "lucide-react"

const LOGICAL_WIDTH = 640
const LOGICAL_HEIGHT = 400
const ZOOM = 20

type Center = { lat: number; lon: number; zoom: number }

function project(lat: number, lon: number) {
  const sin = Math.min(Math.max(Math.sin((lat * Math.PI) / 180), -0.9999), 0.9999)
  return {
    x: 256 * (0.5 + lon / 360),
    y: 256 * (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)),
  }
}

function unproject(x: number, y: number) {
  const lon = (x / 256 - 0.5) * 360
  const lat = (Math.asin(Math.tanh(2 * Math.PI * (0.5 - y / 256))) * 180) / Math.PI
  return { lat, lon }
}

function pinCoordinates(center: Center, x: number, y: number) {
  const scale = 2 ** center.zoom
  const world = project(center.lat, center.lon)
  return unproject(
    world.x + ((x - 0.5) * LOGICAL_WIDTH) / scale,
    world.y + ((y - 0.5) * LOGICAL_HEIGHT) / scale,
  )
}

export function PropertyConfirmation({
  address,
  sessionId,
  addressToken,
  onConfirm,
  onEdit,
}: {
  address: string
  sessionId: string
  addressToken: string
  onConfirm: (coordinates?: { lat: number; lon: number }) => void
  onEdit: () => void
}) {
  const [center, setCenter] = useState<Center | null>(null)
  const [pin, setPin] = useState({ x: 0.5, y: 0.5 })
  const [loading, setLoading] = useState(true)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const frame = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    setImageLoaded(false)
    setPin({ x: 0.5, y: 0.5 })
    const query = new URLSearchParams({ sessionId, addressToken, format: "json", zoom: String(ZOOM) })
    fetch(`/api/aerial?${query}`)
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        if (!cancelled && typeof result?.lat === "number" && typeof result?.lon === "number") {
          setCenter({ lat: result.lat, lon: result.lon, zoom: result.zoom || ZOOM })
        } else if (!cancelled) setFailed(true)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [address, addressToken, sessionId])

  const updatePin = (event: ReactPointerEvent) => {
    const bounds = frame.current?.getBoundingClientRect()
    if (!bounds) return
    setPin({
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    })
  }

  const confirm = () => onConfirm(center ? pinCoordinates(center, pin.x, pin.y) : undefined)
  const imageUrl = center
    ? `/api/aerial?${new URLSearchParams({ sessionId, addressToken, lat: String(center.lat), lon: String(center.lon), zoom: String(center.zoom), pin: "off", w: String(LOGICAL_WIDTH), h: String(LOGICAL_HEIGHT) })}`
    : ""

  return <div className="property-confirmation">
    <header><span>Confirm your property</span><h2>Is this your home?</h2><p>Drag the pin onto your roof if it is on the wrong house, then confirm.</p></header>
    <div
      ref={frame}
      className={`property-aerial ${dragging ? "is-dragging" : ""}`}
      onPointerDown={(event) => { if (!center) return; setDragging(true); updatePin(event); event.currentTarget.setPointerCapture(event.pointerId) }}
      onPointerMove={(event) => { if (dragging) updatePin(event) }}
      onPointerUp={(event) => { setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    >
      {(loading || (center && !imageLoaded && !failed)) && <div className="property-aerial__loading"><LoaderCircle className="spin" size={25} /> Locating your roof…</div>}
      {imageUrl && !failed && <img src={imageUrl} alt={`Aerial view of ${address}`} onLoad={() => setImageLoaded(true)} onError={() => setFailed(true)} draggable={false} />}
      {center && imageLoaded && !failed && <button type="button" className="property-pin" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} aria-label="Property location pin"><MapPin size={32} fill="currentColor" /></button>}
      {center && imageLoaded && !failed && <span className="property-drag-hint"><Move size={14} /> Drag the pin if needed</span>}
      {failed && <div className="property-aerial__loading"><MapPin size={25} /> Aerial view unavailable. You can still continue.</div>}
    </div>
    <div className="property-confirmation__address"><MapPin size={18} /> {address}</div>
    <div className="property-confirmation__actions">
      <button type="button" className="quote-next" onClick={confirm} disabled={loading}><Check size={17} /> Yes, measure my roof</button>
      <button type="button" className="quote-outline" onClick={onEdit}><Pencil size={16} /> No, edit address</button>
    </div>
  </div>
}
